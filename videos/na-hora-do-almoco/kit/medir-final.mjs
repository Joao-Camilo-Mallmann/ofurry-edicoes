/**
 * Mede o audio de um video final (11/11): nao muda nada.
 *   - LUFS integrado, faixa (LRA) e pico real do arquivo inteiro
 *   - por trecho: LUFS integrado, maior e menor loudness de curto prazo (3 s), pico real
 *   - ganho que o normalizador do montar.mjs aplicou ao longo do tempo (final contra a soma dos mix.wav):
 *     se o ganho varia muito, o loudnorm esta "bombeando" (sobe trechos quietos, abaixa os fortes)
 * Uso: bun videos/na-hora-do-almoco/kit/medir-final.mjs [video.mp4] [--json saida.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const ORDEM = ['01', '02', '03', '04', '05', '06', '61', '07', '08', '09', '10'];
const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const video = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--json') || 'D:/YT/Matheus (Alves)/hora do armoco/na-hora-do-almoco-final.mp4';
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const durs = ORDEM.map((t) => JSON.parse(readFileSync(join(OUT, `trecho-${t}`, 'sons.json'), 'utf8')).dur);

function ebur(file, extra = []) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...extra, '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const log = r.stderr;
  const serie = [...log.matchAll(/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf|nan)\s+S:\s*(-?[\d.]+|-inf|nan)/g)].map((m) => ({ t: Number(m[1]), M: Number(m[2]), S: Number(m[3]) }));
  const fim = log.slice(log.lastIndexOf('Summary:'));
  const num = (re) => { const m = fim.match(re); return m ? Number(m[1]) : NaN; };
  return { I: num(/I:\s*(-?[\d.]+) LUFS/), LRA: num(/LRA:\s*(-?[\d.]+) LU/), TP: num(/Peak:\s*(-?[\d.]+) dBFS/), serie };
}
function pcm(file, extra = []) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...extra, '-i', file, '-map', '0:a:0', '-f', 'f32le', '-ac', '1', '-ar', '8000', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4));
}

const tudo = ebur(video);
console.log(`arquivo: ${video}`);
console.log(`inteiro: ${tudo.I.toFixed(1)} LUFS integrado | LRA ${tudo.LRA.toFixed(1)} LU | pico real ${tudo.TP.toFixed(1)} dBTP`);
const rel = { video, I: tudo.I, LRA: tudo.LRA, TP: tudo.TP, trechos: {} };

// ganho do normalizador: RMS do final / RMS da soma dos mix.wav em janelas de 1 s
const fin = pcm(video);
let g0 = 0;
console.log('\ntrecho  inicio   LUFS   S max   S min(fala)  pico    ganho do normalizador (dB): medio  min  max');
ORDEM.forEach((t, i) => {
  const d = durs[i];
  const e = ebur(video, ['-ss', String(g0), '-t', String(d)]);
  const S = tudo.serie.filter((x) => x.t >= g0 + 3 && x.t <= g0 + d && Number.isFinite(x.S));
  const sMax = Math.max(...S.map((x) => x.S));
  const sAlto = S.map((x) => x.S).filter((x) => x > -40).sort((a, b) => a - b);
  const sMin = sAlto.length ? sAlto[Math.floor(sAlto.length * 0.05)] : NaN;
  const mix = pcm(join(OUT, `trecho-${t}`, 'hf', 'assets', 'audio', 'mix.wav'));
  const ganhos = [];
  for (let s = 0; s + 1 <= d; s++) {
    let a = 0, b = 0;
    for (let k = 0; k < 8000; k++) { const x = mix[s * 8000 + k] || 0, y = fin[Math.round((g0 + s) * 8000) + k] || 0; a += x * x; b += y * y; }
    if (a / 8000 > 1e-5) ganhos.push(10 * Math.log10(b / a)); // so janelas com sinal (acima de -50 dBFS)
  }
  const med = ganhos.reduce((x, y) => x + y, 0) / (ganhos.length || 1);
  const R = { ini: g0, dur: d, I: e.I, TP: e.TP, sMax, sMin, ganhoMedio: med, ganhoMin: Math.min(...ganhos), ganhoMax: Math.max(...ganhos) };
  rel.trechos[t] = R;
  console.log(`  ${t}    ${mmss(g0).padStart(5)}  ${e.I.toFixed(1).padStart(6)}  ${sMax.toFixed(1).padStart(6)}  ${sMin.toFixed(1).padStart(8)}     ${e.TP.toFixed(1).padStart(5)}    ${med.toFixed(1).padStart(6)} ${R.ganhoMin.toFixed(1).padStart(6)} ${R.ganhoMax.toFixed(1).padStart(6)}`);
  g0 += d;
});
const Is = Object.values(rel.trechos).map((r) => r.I);
console.log(`\nespalhamento entre trechos: ${Math.min(...Is).toFixed(1)} a ${Math.max(...Is).toFixed(1)} LUFS (${(Math.max(...Is) - Math.min(...Is)).toFixed(1)} LU)`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rel, null, 1));
