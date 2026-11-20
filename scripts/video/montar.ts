/**
 * Monta o video final: junta os MP4 dos trechos e refaz o audio inteiro (narracao + trilha continua + efeitos).
 *
 * Uso:
 *   bun run video:montar <id>                     video inteiro -> videos/<id>/final/<id>-final.mp4
 *   bun run video:montar <id> --trechos 01,12     so esses trechos (previa) -> final/<id>-previa-01-12.mp4
 *   bun run video:montar <id> --so-audio          gera so final/<id>-mix.wav (para ouvir/medir)
 *
 * Audio (padrao da casa, docs/padrao-edicao-ofurry.md):
 *   - narracao: o midia/narracao.wav de cada trecho (ja masterizada); nada de musica cantada por cima.
 *   - trilha: videos/<id>/trilha.json, UMA curva para o video todo. Cada faixa comeca num trecho (`desde`), toca
 *     ate a proxima e emenda em crossfade (`xfade`, padrao 6 s). Cada faixa e nivelada sozinha (loudnorm) para
 *     ficar `abaixoDaVoz` LU abaixo da narracao (padrao 21): sem "fim forte, comeco fraco" na troca.
 *   - efeitos: campo `sfx` de cada beats.json, com ancoras "@frase" (scripts/video/ancoras.ts). So em evento da
 *     cena; legenda entra sem som. Ganho padrao -16 dB.
 *   - mix final em -14 LUFS (loudnorm + limitador, pico real ~-1,5 dBTP).
 * Video: concat sem reencodar (todos os trechos saem da NVENC com os mesmos parametros do hf:render).
 * Final anterior vai para final/versoes-antigas/ com data. Musica do Infraction -> aviso de credito no fim.
 *
 * trilha.json: { "abaixoDaVoz": 21, "xfade": 6, "faixas": [ { "file": "@mus/...", "desde": "trecho-01", "from": 0, "ganho": 0 } ] }
 * sfx (no beats.json): [ { "at": "@máquina", "file": "@sfx/General/Cash Register.mp3", "gain": -16, "len": 1.2, "fadeOut": 0.3, "pico": 0.05 } ]
 *   `pico`: segundos do arquivo ate o ataque; a cue comeca antes para o pico cair na palavra.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readManifest, trechoDir, videoDir } from './lib';
import { resolveAnchorsDeep } from './ancoras';
import { parseWords } from '../../src/house/captions';

const ALIAS: Record<string, string> = {
  '@sfx/': 'D:/YT/!Assets/PACK - EFEITOS SONOROS/',
  '@sw/': 'D:/YT/!Assets/Swoosh effects/',
  '@mus/': 'D:/YT/!Assets/Musicas/',
};
const resolveFile = (f: string) => {
  for (const [k, v] of Object.entries(ALIAS)) if (f.startsWith(k)) return v + f.slice(k.length);
  return f;
};
const NORMALIZA = 'loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.75:attack=5:release=50:level=false';

const args = process.argv.slice(2);
const id = args[0];
const opt = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!id) {
  console.error('Uso: bun run video:montar <id> [--trechos 01,12] [--so-audio]');
  process.exit(1);
}
const m = readManifest(id);
const dir = videoDir(id);
const sel = opt('--trechos')?.split(',').map((s) => `trecho-${s.padStart(2, '0')}`);
const trechos = [...m.trechos].sort((a, b) => a.inicio - b.inicio).filter((t) => !sel || sel.includes(t.id));
if (!trechos.length) {
  console.error('nenhum trecho selecionado');
  process.exit(1);
}
const soAudio = args.includes('--so-audio');
const probeDur = (f: string) => Number(String(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout).trim());

// ---------------------------------------------------------------- linha do tempo de saida
type Seg = { id: string; out0: number; dur: number; wav: string; mp4: string; dir: string };
let acc = 0;
const segs: Seg[] = trechos.map((t) => {
  const td = trechoDir(id, t.id.replace('trecho-', ''));
  const wav = join(td, 'midia', 'narracao.wav');
  const mp4 = join(td, 'render', `${id}-${t.id}.mp4`);
  const dur = probeDur(soAudio || !existsSync(mp4) ? wav : mp4);
  const s = { id: t.id, out0: acc, dur, wav, mp4, dir: td };
  acc += dur;
  return s;
});
const total = acc;
if (!soAudio) {
  const faltam = segs.filter((s) => !existsSync(s.mp4));
  if (faltam.length) {
    console.error(`Faltam renders: ${faltam.map((s) => s.id).join(', ')} (bun run hf:render ${id} XX)`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- entradas de audio
const inputs: string[] = [];
const filters: string[] = [];
const labels: string[] = [];
const addInput = (file: string) => {
  inputs.push('-i', file);
  return inputs.length / 2 - 1;
};

// narracao
segs.forEach((s, i) => {
  const k = addInput(s.wav);
  filters.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${s.dur.toFixed(3)},adelay=${Math.round(s.out0 * 1000)}:all=1[n${i}]`);
  labels.push(`[n${i}]`);
});

// trilha
const trilhaPath = join(dir, 'trilha.json');
const infraction = new Set<string>();
if (existsSync(trilhaPath)) {
  const tr = JSON.parse(readFileSync(trilhaPath, 'utf8')) as { abaixoDaVoz?: number; xfade?: number; faixas: { file: string; desde: string; from?: number; ganho?: number }[] };
  const alvo = -14 - (tr.abaixoDaVoz ?? 21);
  const xf = tr.xfade ?? 6;
  // Cada trecho selecionado toca a ultima faixa cujo `desde` e <= ele. Trechos seguidos com a mesma faixa viram um
  // pedaco so; o ponto da musica vem da posicao ABSOLUTA no video (a previa soa igual ao final).
  const absStart = (tid: string) => m.trechos.find((t) => t.id === tid)?.inicio ?? 0;
  const faixaDe = (tid: string) => {
    let k = -1;
    tr.faixas.forEach((f, i) => { if (f.desde <= tid) k = i; });
    return k;
  };
  type Run = { k: number; a: number; b: number; abs: number };
  const runs: Run[] = [];
  for (const s of segs) {
    const k = faixaDe(s.id);
    if (k < 0) continue;
    const last = runs[runs.length - 1];
    if (last && last.k === k && Math.abs(last.b - s.out0) < 0.01) last.b = s.out0 + s.dur;
    else runs.push({ k, a: s.out0, b: s.out0 + s.dur, abs: absStart(s.id) });
  }
  runs.forEach((run, i) => {
    const f = tr.faixas[run.k];
    const file = resolveFile(f.file);
    if (!existsSync(file)) {
      console.error(`musica nao encontrada: ${file}`);
      process.exit(1);
    }
    if (/Infraction/i.test(file)) infraction.add(file.split('/').pop()!);
    const emenda = (j: number) => j >= 0 && j < runs.length && Math.abs(runs[j].a - (j > i ? run.b : runs[j].b)) < 0.01;
    const xIn = i > 0 && emenda(i - 1) ? xf : 0;
    const xOut = i < runs.length - 1 && emenda(i + 1) ? xf : 0;
    const a = Math.max(0, run.a - xIn / 2);
    const b = Math.min(total, run.b + xOut / 2);
    const len = b - a;
    const from = Math.max(0, (f.from ?? 0) + (run.abs - absStart(f.desde)) - xIn / 2);
    const fileDur = probeDur(file);
    const k = addInput(file);
    const loops = Math.max(0, Math.ceil((from + len) / Math.max(1, fileDur)) - 1);
    const src = loops ? `[${k}:a]aloop=loop=${loops}:size=${Math.round(fileDur * 48000)},` : `[${k}:a]`;
    const fin = xIn || 1.2;
    const fout = xOut || 2.5;
    filters.push(
      `${src}aresample=48000,aformat=channel_layouts=stereo,atrim=${from.toFixed(3)}:${(from + len).toFixed(3)},asetpts=PTS-STARTPTS,` +
        `loudnorm=I=${alvo}:LRA=6:TP=-9,aresample=48000,volume=${(f.ganho ?? 0).toFixed(1)}dB,` +
        `afade=t=in:st=0:d=${fin},afade=t=out:st=${Math.max(0, len - fout).toFixed(3)}:d=${fout},adelay=${Math.round(a * 1000)}:all=1[m${i}]`
    );
    labels.push(`[m${i}]`);
  });
}

// efeitos (sfx dos beats.json, com ancoras)
let nSfx = 0;
segs.forEach((s) => {
  const bp = join(s.dir, 'beats.json');
  if (!existsSync(bp)) return;
  const raw = JSON.parse(readFileSync(bp, 'utf8'));
  if (!raw.sfx?.length) return;
  const wp = join(s.dir, 'midia', 'narracao.json');
  const words = existsSync(wp) ? parseWords(readFileSync(wp, 'utf8')) : [];
  const errs: string[] = [];
  const list = resolveAnchorsDeep(raw.sfx, words, s.dur, errs) as { at: number; file: string; gain?: number; len?: number; fadeOut?: number; pico?: number; from?: number }[];
  if (errs.length) {
    console.error(`${s.id}: ancoras de sfx com problema:\n  ${errs.join('\n  ')}`);
    process.exit(1);
  }
  for (const fx of list) {
    const file = resolveFile(fx.file);
    if (!existsSync(file)) {
      console.warn(`  aviso: efeito nao encontrado (${s.id}): ${file}`);
      continue;
    }
    if (fx.at > s.dur + 0.01) continue;
    const at = Math.max(0, s.out0 + fx.at - (fx.pico ?? 0));
    const k = addInput(file);
    const trim = fx.len ? `atrim=${(fx.from ?? 0).toFixed(3)}:${((fx.from ?? 0) + fx.len).toFixed(3)},asetpts=PTS-STARTPTS,` : fx.from ? `atrim=start=${fx.from},asetpts=PTS-STARTPTS,` : '';
    const fo = fx.fadeOut ?? 0.08;
    const fade = fx.len ? `afade=t=out:st=${Math.max(0, fx.len - fo).toFixed(3)}:d=${fo},` : '';
    filters.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo,${trim}${fade}volume=${(fx.gain ?? -16).toFixed(1)}dB,adelay=${Math.round(at * 1000)}:all=1[s${nSfx}]`);
    labels.push(`[s${nSfx}]`);
    nSfx++;
  }
});

filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)},${NORMALIZA}[mix]`);

const outDir = join(dir, 'final');
mkdirSync(outDir, { recursive: true });
const fcPath = join(outDir, '.mix-filter.txt');
writeFileSync(fcPath, filters.join(';\n'));
const mixWav = join(outDir, `${id}-mix.wav`);
console.log(`> audio: ${segs.length} trecho(s), ${labels.length - segs.length - nSfx} faixa(s) de trilha, ${nSfx} efeito(s), ${total.toFixed(1)} s`);
let r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex_script', fcPath, '-map', '[mix]', '-ar', '48000', '-c:a', 'pcm_s24le', mixWav], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

if (!soAudio) {
  const nome = sel ? `${id}-previa-${sel.map((s) => s.replace('trecho-', '')).join('-')}` : `${id}-final`;
  const out = join(outDir, `${nome}.mp4`);
  if (existsSync(out) && !sel) {
    mkdirSync(join(outDir, 'versoes-antigas'), { recursive: true });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    renameSync(out, join(outDir, 'versoes-antigas', `${nome}-${stamp}.mp4`));
  }
  const lista = join(outDir, '.concat.txt');
  writeFileSync(lista, segs.map((s) => `file '${s.mp4.replace(/\\/g, '/')}'`).join('\n'));
  console.log('> video: juntando os trechos (sem reencodar)');
  r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-i', mixWav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log(`Pronto: ${out}`);
}
// medida final
const meas = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', mixWav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
const I = meas.stderr.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop();
const TP = meas.stderr.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop();
console.log(`Volume: ${I ?? '?'} · pico real ${TP ?? '?'}`);
if (infraction.size) {
  console.log('\n!!! MUSICA DO INFRACTION NESTE VIDEO: a descricao do YouTube PRECISA do credito (nome + link + texto do inaudio).');
  for (const f of infraction) console.log(`    - ${f}`);
  console.log('    Formato: D:\\YT\\!Assets\\Musicas\\Infraction - No Copyright Music\\readme.md');
}
