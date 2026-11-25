/**
 * Monta o video final: junta os MP4 dos trechos e refaz o audio inteiro (narracao + trilha continua + efeitos).
 *
 * Uso:
 *   bun run video:montar <id>                     video inteiro -> videos/<id>/final/<id>-final.mp4
 *   bun run video:montar <id> --trechos 01,12     so esses trechos (previa) -> final/<id>-previa-01-12.mp4
 *   bun run video:montar <id> --so-audio          gera so final/<id>-mix.wav (para ouvir/medir)
 *   bun run video:montar <id> --so-partes         refaz so final/partes.md (mapa das partes + capitulos do YouTube)
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

if (args.includes('--so-partes')) {
  // so refaz final/partes.md (mapa das partes + capitulos), sem mexer em audio nem video
  escreverPartes();
  process.exit(0);
}

// ---------------------------------------------------------------- entradas de audio
const inputs: string[] = [];
const filters: string[] = [];
const labels: string[] = [];
const addInput = (file: string) => {
  inputs.push('-i', file);
  return inputs.length / 2 - 1;
};

// narracao: a trilha e os efeitos sao nivelados contando com a voz em -14 LUFS. Narracao mais baixa (ex.: Adobe
// Enhance puro, -22,8 LUFS) ganha so um ganho LINEAR para chegar la; sem EQ nem compressao na voz (Joao, 21/11/2026,
// nao gostou da versao tratada). Os picos que passam de 0 dB sao segurados pelo limitador do mix final (NORMALIZA).
const vozGanho = (() => {
  const full = join(dir, 'midia', 'narracao.wav');
  if (!existsSync(full)) return 0;
  const m = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', full, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const Iv = Number(m.stderr.slice(m.stderr.lastIndexOf('Summary')).match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  if (!Number.isFinite(Iv)) return 0;
  const g = -14 - Iv;
  console.log(`Narracao em ${Iv.toFixed(1)} LUFS${Math.abs(g) > 0.3 ? ` -> ganho linear de ${g >= 0 ? '+' : ''}${g.toFixed(1)} dB na voz` : ''}`);
  return Math.abs(g) > 0.3 ? g : 0;
})();
// Efeito pontual na voz, pedido na cena: "vozEfeito": [{ "de": "@frase", "ate": "@frase", "tipo": "radio" }] no beats.json.
// "radio": radio velho (faixa estreita e saturada, SEM mudar o tom: Joao achou a voz grave ruim). O resto da fala segue
// sem nenhum tratamento.
const vozEfeitos = (s: Seg): { de: number; ate: number }[] => {
  const bp = join(s.dir, 'beats.json');
  if (!existsSync(bp)) return [];
  const raw = JSON.parse(readFileSync(bp, 'utf8')) as { vozEfeito?: unknown[] };
  if (!raw.vozEfeito?.length) return [];
  const wp = join(s.dir, 'midia', 'narracao.json');
  const words = parseWords(readFileSync(wp, 'utf8'));
  const errs: string[] = [];
  const list = resolveAnchorsDeep(raw.vozEfeito, words, s.dur, errs) as { de: number; ate: number }[];
  if (errs.length) {
    console.error(`${s.id}: vozEfeito com ancora quebrada: ${errs.join(' | ')}`);
    process.exit(1);
  }
  return list;
};
segs.forEach((s, i) => {
  const k = addInput(s.wav);
  const base = `[${k}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${s.dur.toFixed(3)},asetpts=PTS-STARTPTS,volume=${vozGanho.toFixed(2)}dB`;
  const delay = `adelay=${Math.round(s.out0 * 1000)}:all=1`;
  const efeitos = vozEfeitos(s);
  if (!efeitos.length) {
    filters.push(`${base},${delay}[n${i}]`);
  } else {
    // rampa de 15 ms nas emendas para nao estalar
    const r = efeitos.map((e) => `clip(min((t-${e.de.toFixed(3)})/0.015,(${e.ate.toFixed(3)}-t)/0.015),0,1)`).join('+');
    filters.push(`${base},asplit=2[nd${i}][nw${i}]`);
    filters.push(`[nd${i}]asetnsamples=n=32,volume='1-(${r})':eval=frame[ndd${i}]`);
    filters.push(`[nw${i}]highpass=f=550,lowpass=f=2700,volume=6dB,asoftclip=type=tanh,volume=-1dB,asetnsamples=n=32,volume='${r}':eval=frame[nww${i}]`);
    filters.push(`[ndd${i}][nww${i}]amix=inputs=2:normalize=0:duration=first,${delay}[n${i}]`);
  }
  labels.push(`[n${i}]`);
});

// trilha
const trilhaPath = join(dir, 'trilha.json');
const infraction = new Set<string>();
/**
 * Final do video (padrao do canal, pedido do Joao em 21/11/2026): a trilha CORTA antes da assinatura ("eu sou o Furry"),
 * os efeitos param, a voz fica pura, e depois da ultima palavra entra uma musica mais dramatica sobre a tela final.
 * trilha.json: "final": { "trecho": "trecho-21", "corteEm": "@Bom eu sou", "entraEm": "@por aí>", "musica": "@mus/...",
 *                          "from": 60, "nivel": -18, "ganho": 0 }
 */
type Final = { trecho: string; corteEm: string; entraEm: string; musica: string; from?: number; nivel?: number; ganho?: number };
let corteAbs = Infinity;
let finalCfg: (Final & { entraAbs: number }) | undefined;
if (existsSync(trilhaPath)) {
  const f = (JSON.parse(readFileSync(trilhaPath, 'utf8')) as { final?: Final }).final;
  const seg = f && segs.find((x) => x.id === f.trecho);
  if (f && seg) {
    const wp = join(seg.dir, 'midia', 'narracao.json');
    const words = existsSync(wp) ? parseWords(readFileSync(wp, 'utf8')) : [];
    const errs: string[] = [];
    const r = resolveAnchorsDeep({ c: f.corteEm, e: f.entraEm }, words, seg.dur, errs) as { c: number; e: number };
    if (errs.length) {
      console.error(`final da trilha: ${errs.join('; ')}`);
      process.exit(1);
    }
    corteAbs = seg.out0 + r.c;
    finalCfg = { ...f, entraAbs: seg.out0 + r.e };
  }
}
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
    const corta = corteAbs < run.b + xOut / 2 && corteAbs > a;
    const b = corta ? corteAbs : Math.min(total, run.b + xOut / 2);
    const len = b - a;
    const from = Math.max(0, (f.from ?? 0) + (run.abs - absStart(f.desde)) - xIn / 2);
    const fileDur = probeDur(file);
    const k = addInput(file);
    const loops = Math.max(0, Math.ceil((from + len) / Math.max(1, fileDur)) - 1);
    const src = loops ? `[${k}:a]aloop=loop=${loops}:size=${Math.round(fileDur * 48000)},` : `[${k}:a]`;
    const fin = xIn || 1.2;
    const fout = corta ? 0.6 : xOut || 2.5;
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
    if (at >= corteAbs) continue; // na assinatura a voz fica pura
    const k = addInput(file);
    const trim = fx.len ? `atrim=${(fx.from ?? 0).toFixed(3)}:${((fx.from ?? 0) + fx.len).toFixed(3)},asetpts=PTS-STARTPTS,` : fx.from ? `atrim=start=${fx.from},asetpts=PTS-STARTPTS,` : '';
    const fo = fx.fadeOut ?? 0.08;
    const fade = fx.len ? `afade=t=out:st=${Math.max(0, fx.len - fo).toFixed(3)}:d=${fo},` : '';
    // "radio": true passa o efeito/musica pelo filtro de radio velho
    const radio = (fx as { radio?: boolean }).radio ? 'highpass=f=500,lowpass=f=2800,volume=6dB,asoftclip=type=tanh,' : '';
    filters.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo,${trim}${radio}${fade}volume=${(fx.gain ?? -16).toFixed(1)}dB,adelay=${Math.round(at * 1000)}:all=1[s${nSfx}]`);
    labels.push(`[s${nSfx}]`);
    nSfx++;
  }
});

// musica dramatica do final, sobre a tela final (depois da ultima palavra)
if (finalCfg && finalCfg.entraAbs < total) {
  const file = resolveFile(finalCfg.musica);
  if (!existsSync(file)) {
    console.error(`musica do final nao encontrada: ${file}`);
    process.exit(1);
  }
  if (/Infraction/i.test(file)) infraction.add(file.split('/').pop()!);
  const len = total - finalCfg.entraAbs;
  const from = finalCfg.from ?? 0;
  const k = addInput(file);
  filters.push(
    `[${k}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=${from.toFixed(3)}:${(from + len).toFixed(3)},asetpts=PTS-STARTPTS,` +
      `loudnorm=I=${finalCfg.nivel ?? -18}:LRA=8:TP=-3,aresample=48000,volume=${(finalCfg.ganho ?? 0).toFixed(1)}dB,` +
      `afade=t=in:st=0:d=0.15,afade=t=out:st=${Math.max(0, len - 3.5).toFixed(3)}:d=3.5,adelay=${Math.round(finalCfg.entraAbs * 1000)}:all=1[mfinal]`
  );
  labels.push('[mfinal]');
}

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
  if (!sel) escreverPartes();
}

/**
 * final/partes.md: mapa "minuto do video -> parte (trecho)", para achar e refazer so uma parte
 * (bun run video:produzir <id> --trechos XX), e os capitulos prontos para a descricao do YouTube.
 */
function escreverPartes() {
  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const info = (id: string) => m.trechos.find((t) => t.id === id)!;
  let md = `# ${m.titulo}: partes do vídeo\n\nGerado pelo \`video:montar\` em ${new Date().toLocaleString('pt-BR')}. `;
  md += `Cada parte é renderizada sozinha e o final só junta as partes.\n\n`;
  md += `**Para mexer numa parte:** edite \`output/trecho-XX/beats.json\` e rode \`bun run video:produzir ${id} --trechos XX\` `;
  md += `(renderiza só essa parte e junta o vídeo de novo).\n\n`;
  md += `| Parte | Começa | Termina | Duração | Bloco | O que é |\n|---|---|---|---|---|---|\n`;
  for (const s of segs) {
    const t = info(s.id);
    md += `| ${s.id.replace('trecho-', '')} | ${mmss(s.out0)} | ${mmss(s.out0 + s.dur)} | ${s.dur.toFixed(0)} s | ${t.bloco ?? ''} | ${t.titulo ?? ''} |\n`;
  }
  // capitulos: o 1o trecho de cada bloco do roteiro (YouTube: 1o em 0:00, minimo 3, cada um com 10 s ou mais)
  const caps: { t: number; nome: string }[] = [];
  for (const s of segs) {
    const t = info(s.id);
    const prev = caps.length ? info(segs.find((x) => x.out0 === caps[caps.length - 1].t)!.id) : undefined;
    if (prev && prev.bloco === t.bloco) continue;
    // bloco com varias partes: o nome do bloco ("A jornada dos 10 anos"); parte unica: o titulo dela
    const variasPartes = m.trechos.filter((x) => x.bloco && x.bloco === t.bloco).length > 1;
    const bloco = (t.bloco ?? '').toLowerCase();
    const nome = variasPartes && bloco ? bloco : (t.titulo ?? t.bloco ?? s.id).replace(/^[^:]+:\s*/, '');
    if (caps.length && s.out0 - caps[caps.length - 1].t < 10) continue;
    caps.push({ t: s.out0, nome: nome.charAt(0).toUpperCase() + nome.slice(1) });
  }
  md += `\n## Capítulos para a descrição do YouTube\n\nRevise os nomes antes de colar (são os títulos internos das partes).\n\n\`\`\`text\n`;
  md += caps.map((c) => `${mmss(c.t)} ${c.nome}`).join('\n') + '\n```\n';
  mkdirSync(join(dir, 'final'), { recursive: true });
  writeFileSync(join(dir, 'final', 'partes.md'), md);
  console.log(`Mapa das partes e capitulos: ${join(dir, 'final', 'partes.md')}`);
}
// medida final
// framelog=quiet: sem uma linha por quadro (estourava o buffer e o resumo vinha vazio)
const meas = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', mixWav, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const resumo = meas.stderr.slice(meas.stderr.lastIndexOf('Summary'));
const I = resumo.match(/I:\s+(-?[\d.]+) LUFS/)?.[1];
const TP = resumo.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1];
console.log(`Volume: ${I ?? '?'} LUFS · pico real ${TP ?? '?'} dBFS`);
if (infraction.size) {
  console.log('\n!!! MUSICA DO INFRACTION NESTE VIDEO: a descricao do YouTube PRECISA do credito (nome + link + texto do inaudio).');
  for (const f of infraction) console.log(`    - ${f}`);
  console.log('    Formato: D:\\YT\\!Assets\\Musicas\\Infraction - No Copyright Music\\readme.md');
}
