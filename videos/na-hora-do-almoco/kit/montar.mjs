/**
 * Junta os trechos renderizados num video so, com o audio de cada trecho (sons.json -> mix.wav)
 * normalizado em -14 LUFS.
 *
 * Uso: bun videos/na-hora-do-almoco/kit/montar.mjs <nome> <XX> [XX ...] [--final]
 *   sem --final: previa 1280x720 leve em 06-montagem/previas/<nome>.mp4
 *   com --final: 1920x1080 alta qualidade na RAIZ do projeto (D:/YT/Matheus (Alves)/hora do armoco/<nome>.mp4)
 */
import { closeSync, existsSync, mkdirSync, openSync, readSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encH264 } from './gpu.mjs';

const VIDEO = join(dirname(fileURLToPath(import.meta.url)), '..');
// loudnorm de uma passada deixa escapar pico no comeco do video (medido em 11/11: +0,2 dBTP aos 3 s, com alvo de -1,5).
// O limitador depois dele segura as amostras em -2,5 dBFS, o que deixa o pico real perto de -1,5 dBTP mesmo depois do AAC.
const NORMALIZA = 'loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.75:attack=5:release=50:level=false';
const MONTAGEM = 'D:/YT/Matheus (Alves)/hora do armoco/06-montagem';
const args = process.argv.slice(2);
const final = args.includes('--final');
const [nome, ...trechos] = args.filter((a) => !a.startsWith('--'));
if (!nome || !trechos.length) { console.error('Uso: bun kit/montar.mjs <nome> <XX> [XX ...] [--final]'); process.exit(1); }

// Assinatura do stream de video de cada trecho: encoder (o x264 grava "x264 - core" no comeco; a NVENC nao) + parametros
// do H.264. concat -c copy so e seguro se todas forem iguais; misturar x264 e NVENC (ou ajustes diferentes) corrompe a imagem.
function assinatura(mp4) {
  const fd = openSync(mp4, 'r'); const buf = Buffer.alloc(4 << 20);
  const n = readSync(fd, buf, 0, buf.length, 0); closeSync(fd);
  const enc = buf.subarray(0, n).includes('x264 - core') ? 'x264' : 'nvenc';
  const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=profile,level,has_b_frames,refs,pix_fmt,width,height,r_frame_rate', '-of', 'csv=p=0', mp4], { encoding: 'utf8' });
  return `${enc}|${p.stdout.trim()}`;
}
const mp4Trecho = (t) => { const n = t.padStart(2, '0'); return join(VIDEO, 'output', `trecho-${n}`, 'render', `na-hora-do-almoco-trecho-${n}.mp4`); };
let rapido = args.includes('--rapido');
if (rapido) {
  const ass = new Map(trechos.filter((t) => existsSync(mp4Trecho(t))).map((t) => [t, assinatura(mp4Trecho(t))]));
  if (new Set(ass.values()).size > 1) {
    console.log('> trechos com encoders/ajustes diferentes: montando com reencode na placa em vez de --rapido');
    for (const [t, a] of ass) console.log(`  ${t}: ${a}`);
    rapido = false;
  }
}

// --rapido: junta o video dos trechos SEM reencodar (concat -c copy) e so refaz o audio. ~1 min em vez de ~10.
if (rapido) {
  const lista = join(VIDEO, 'output', `montar-${nome}.lista.txt`);
  const wavs = [];
  writeFileSync(lista, trechos.map((t) => {
    const n = t.padStart(2, '0'); const dir = join(VIDEO, 'output', `trecho-${n}`);
    wavs.push(join(dir, 'hf', 'assets', 'audio', 'mix.wav'));
    return `file '${join(dir, 'render', `na-hora-do-almoco-trecho-${n}.mp4`).replace(/\\/g, '/')}'`;
  }).join('\n'));
  const outR = join(final ? join(MONTAGEM, '..') : join(MONTAGEM, 'previas'), `${nome}.mp4`);
  const aIns = wavs.flatMap((w) => ['-i', w]);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, ...aIns,
    '-filter_complex', `${wavs.map((_, i) => `[${i + 1}:a]aresample=48000[a${i}]`).join(';')};${wavs.map((_, i) => `[a${i}]`).join('')}concat=n=${wavs.length}:v=0:a=1,${NORMALIZA}[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', outR], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log('pronto (rapido):', outR);
  process.exit(0);
}

const ins = [];
const fc = [];
trechos.forEach((t, i) => {
  const n = t.padStart(2, '0');
  const dir = join(VIDEO, 'output', `trecho-${n}`);
  const mp4 = join(dir, 'render', `na-hora-do-almoco-trecho-${n}.mp4`);
  const wav = join(dir, 'hf', 'assets', 'audio', 'mix.wav');
  for (const f of [mp4, wav]) if (!existsSync(f)) { console.error('falta:', f); process.exit(1); }
  ins.push('-i', mp4, '-i', wav);
  fc.push(`[${i * 2}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=30[v${i}]`, `[${i * 2 + 1}:a]aresample=48000,asetpts=PTS-STARTPTS[a${i}]`);
});
const pares = trechos.map((_, i) => `[v${i}][a${i}]`).join('');
const escala = final ? '' : ',scale=1280:-2';
fc.push(`${pares}concat=n=${trechos.length}:v=1:a=1[vc][ac]`, `[vc]format=yuv420p${escala}[v]`, `[ac]${NORMALIZA}[a]`);

const outDir = final ? join(MONTAGEM, '..') : join(MONTAGEM, 'previas');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${nome}.mp4`);
const script = join(VIDEO, 'output', `montar-${nome}.filter`);
writeFileSync(script, fc.join(';\n'));
const enc = encH264(final ? 'final' : 'previa'); // NVENC na RTX (ou libx264 se ALMOCO_CPU=1 / sem placa)
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...ins, '-filter_complex_script', script, '-map', '[v]', '-map', '[a]', ...enc,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('pronto:', out);
