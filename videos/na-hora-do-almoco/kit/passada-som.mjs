/**
 * Passada de som (feedback de 05/11): whooshes mais leves e curtos, pico no corte, "arranhado" so onde e pedido.
 *
 * Uso: bun videos/na-hora-do-almoco/kit/passada-som.mjs 01 08 09 ...
 * Reescreve output/trecho-XX/sons.json (guarde um backup antes). Depois rode o preparar.mjs de cada trecho.
 *
 * 1. Whooshes pesados (muito grave, 0,6-2 s) viram um rodizio de sons leves da pasta de assets, com o PICO de
 *    cada som caindo no momento do corte e volume calculado pelo RMS de cada arquivo (alvo ~7 dB abaixo do atual).
 * 2. "Glitch Static" (o arranhado) sai do video. Nos pontos de GLITCH_OK entra no lugar um clique de camera
 *    fotografica (seco, sem grave, combina com o flash branco), com o clique caindo no momento da cue.
 * 3. Trecho 01: o rebobinar de 0:14 (tique-taque + prato invertido) vira um swish suave que bate junto com o "1970".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VIDEO = join(dirname(fileURLToPath(import.meta.url)), '..');

// sons leves, medidos com ffmpeg (ataque = tempo ate o pico; rms do trecho audivel)
const LEVES = [
  { file: '@sfx/Transitional Elements/Whip 01.wav', ataque: 0.06, dur: 0.17, rms: -16.3 },
  { file: '@sw/2. Whoosh Swoosh.wav', ataque: 0.30, dur: 0.83, rms: -24.9 },
  { file: '@sw/14. Whoosh Swoosh.wav', ataque: 0.02, dur: 0.11, rms: -16.5 },
  { file: '@sfx/Swishes/Fast zing.mp3', ataque: 0.11, dur: 0.77, rms: -33.9 },
  { file: '@sfx/Transitional Elements/Whip 03.wav', ataque: 0.09, dur: 0.19, rms: -20.1 },
  { file: '@sw/18. Whoosh Swoosh.wav', ataque: 0.16, dur: 0.42, rms: -29.5 },
  { file: '@sfx/Swishes/Golden swish.mp3', ataque: 0.35, dur: 1.08, rms: -30.1 },
];
const ALVO_RMS = -44; // rms do arquivo + ganho da cue (o preparar.mjs ainda tira 4 dB dos efeitos)

// ataque dos whooshes atuais (para achar o momento que cada cue queria marcar)
const ATAQUE_ANTIGO = {
  'Smooth Zoom.mp3': 0.25, '2. Whoosh Swoosh.wav': 0.3, '3. Whoosh Swoosh.wav': 0.08, '5. Whoosh Swoosh.wav': 0.43,
  '6. Whoosh Swoosh.wav': 0.27, '7. Whoosh Swoosh.wav': 1.2, '8. Whoosh Swoosh.wav': 0.84, '10. Whoosh Swoosh.wav': 0.38,
  '11. Whoosh Swoosh.wav': 0.06, '12. Whoosh Swoosh.wav': 1.0, '13. Whoosh Swoosh.wav': 0.52, '14. Whoosh Swoosh.wav': 0.02,
  '15. Whoosh Swoosh.wav': 0.33, '17. Whoosh Swoosh.wav': 0.43, '18. Whoosh Swoosh.wav': 0.16, '19. Whoosh Swoosh.wav': 0.09,
  '20. Whoosh Swoosh.wav': 0.55, '21. Whoosh Swoosh.wav': 0.22, '22. Whoosh Swoosh.wav': 0.6, '23. Whoosh Swoosh.wav': 0.45,
  '24. Whoosh Swoosh.wav': 0.31, '25. Whoosh Swoosh.wav': 0.14, '26. Whoosh Swoosh.wav': 0.34, '27. Whoosh Swoosh.wav': 0.49,
  '28. Whoosh Swoosh.wav': 0.28, '29. Whoosh Swoosh.wav': 0.24, '30. Whoosh Swoosh.wav': 0.07, 'Whoosh Swoosh.wav': 0.33,
  'Whoosh Swoosh 2.wav': 0.31, 'Whoosh and Hit (2).mp3': 0.46, 'Whoosh and Hit (3).wav': 0.52, 'Whoosh and Hit (3)_1.wav': 0.52,
  'Whoosh and Hit (4).wav': 0.59, 'Whoosh and Hit (5).wav': 0.43, '9. Whooosh Swoosh.wav': 0.07, '1. Whoosh Swoosh.wav': 0.95,
};
const ehWhooshPesado = (f) => f.startsWith('@sw/') && !LEVES.some((l) => l.file === f);

// onde o "arranhado" vira clique de camera (trecho -> tempos em segundos do trecho); no resto ele so sai
const GLITCH_OK = { '01': [4.44], '10': [] };

const r2 = (v) => Math.round(v * 100) / 100;
for (const n of process.argv.slice(2).map((t) => t.padStart(2, '0'))) {
  const p = join(VIDEO, 'output', `trecho-${n}`, 'sons.json');
  const s = JSON.parse(readFileSync(p, 'utf8'));
  let rod = 0, trocados = 0, glitchFora = 0;
  const cues = [];
  for (const c of s.cues) {
    const nome = c.file.split('/').pop();
    if (ehWhooshPesado(c.file)) {
      const l = LEVES[rod++ % LEVES.length];
      const momento = (c.at || 0) + Math.min(ATAQUE_ANTIGO[nome] ?? 0.2, 0.15);
      cues.push({ file: l.file, at: r2(Math.max(0, momento - l.ataque)), len: r2(l.dur + 0.05), fadeIn: 0.02,
        fadeOut: r2(Math.min(0.12, l.dur / 3)), gain: r2(Math.max(-30, Math.min(2, ALVO_RMS - l.rms))) });
      trocados++;
      continue;
    }
    if (/Glitch Static/.test(c.file)) {
      const ok = (GLITCH_OK[n] || []).some((t) => Math.abs(t - (c.at || 0)) < 0.15);
      if (!ok) { glitchFora++; continue; }
      cues.push({ file: '@sfx/General/-camera-shutter.wav', at: r2(Math.max(0, (c.at || 0) + 0.1 - 0.04)), len: 0.45, fadeIn: 0.01, fadeOut: 0.1, gain: -12 });
      continue;
    }
    if (n === '01' && (/Clock ticking fast/.test(c.file) || /Reverse 03/.test(c.file))) continue;
    cues.push(c);
  }
  if (n === '01') cues.push({ file: '@sfx/Swishes/Golden swish.mp3', at: 15.03, len: 1.1, fadeIn: 0.05, fadeOut: 0.25, gain: -12 });
  s.cues = cues;
  writeFileSync(p, JSON.stringify(s, null, 1));
  console.log(`trecho-${n}: ${trocados} whooshes trocados, ${glitchFora} arranhados removidos`);
}
