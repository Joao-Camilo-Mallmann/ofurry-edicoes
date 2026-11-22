/**
 * Som v3 (06/11): trilhas longas (>= 45 s cada), musica do clipe continua no inicio, sem "dark slam",
 * impactos com o pico alinhado. Edita output/trecho-XX/sons.json (rode uma vez; e idempotente).
 * Depois: bun kit/preparar.mjs XX de cada trecho.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const ORDEM = ['01', '02', '03', '04', '05', '06', '61', '07', '08', '09', '10'];
const abre = (t) => JSON.parse(readFileSync(join(OUT, `trecho-${t}`, 'sons.json'), 'utf8'));
const salva = (t, s) => writeFileSync(join(OUT, `trecho-${t}`, 'sons.json'), JSON.stringify(s, null, 1));
const dur = Object.fromEntries(ORDEM.map((t) => [t, Number(readFileSync(join(OUT, `trecho-${t}`, 'hf', 'index.html'), 'utf8').match(/id="root"[^>]*data-duration="([\d.]+)"/)[1])]));
const fala = (t) => { try { return JSON.parse(readFileSync(join(OUT, `trecho-${t}`, 'midia', 'narracao.json'), 'utf8')); } catch { return []; } };

// envelope que abaixa quando o narrador fala (base) e sobe nas pausas >= 0.9 s (pausa)
function duck(t, ini, fim, base, pausa) {
  const w = fala(t).filter((x) => x.end > ini && x.start < fim);
  const env = [[ini, w.length && w[0].start - ini < 0.9 ? base : pausa]];
  let ultimo = ini;
  for (const x of w) {
    if (x.start - ultimo >= 0.9) { env.push([ultimo + 0.25, pausa], [x.start - 0.3, pausa], [x.start, base]); }
    ultimo = Math.max(ultimo, x.end);
  }
  if (fim - ultimo >= 0.9) env.push([ultimo + 0.25, pausa]);
  env.push([fim, env[env.length - 1][1]]);
  return env.map(([a, b]) => [Math.round(a * 100) / 100, b]).filter((p, i, arr) => i === 0 || p[0] > arr[i - 1][0]);
}
const MUS = { emergence: '@mus/Infraction - No Copyright Music/Cinematic Classical Orchestra Dark Epic Trailer by Cold Cinema [No Copyright Music] ⧸ Emergence.mp4', anb: '@mus/No.10 _A New Beginning - Esther Abrami.mp3' };
const ehMusica = (c) => /^@mus\/|^@clipe\/so-audio\/|01-intro-instrumental|02-no-centro-da-sala/.test(c.file);

// ataque medido (s ate o pico) dos impactos
const ATAQUE = { 'Impact (1)': 0.961, 'Impact (2)': 0.103, 'Impact (3)': 0.003, 'Impact (4)': 0.208, 'Impact (5)': 0.026 };
const so = {};
for (const t of ORDEM) so[t] = abre(t);

// 1) impactos: sem dark slam / screeching riser; impactos com o pico no momento marcado
for (const t of ORDEM) {
  const s = so[t];
  s.cues = s.cues.filter((c) => !/dark slam|screeching riser|dark riser short/.test(c.file));
  for (const c of s.cues) {
    const m = c.file.match(/Impacts\/(Impact \(\d\))/);
    if (!m || c._alinhado) continue;
    const a = ATAQUE[m[1]];
    c.at = Math.round((c.at - a + 0.02) * 1000) / 1000;
    if (c.at < 0) { c.from = -c.at; c.at = 0; }
    c._alinhado = true;
  }
}
// os 2 impactos "de verdade", baixos: "um FIM" (06) e o "MEDO" (04, onde estava o slam)
so['06'].cues.push({ file: '@sfx/Impacts/Impact (4).wav', at: 42.97 - 0.208 + 0.02, gain: -19, fadeOut: 1.2, _alinhado: true });
so['04'].cues.push({ file: '@sfx/Impacts/Impact (4).wav', at: 21.96 + 0.1 - 0.208, gain: -20, fadeOut: 1.2, _alinhado: true });

// 2) bloco 01-03: musica do clipe inteira e continua (tempo do clipe = tempo do video)
let g = 0;
for (const t of ['01', '02', '03']) {
  const s = so[t]; const d = dur[t];
  s.cues = s.cues.filter((c) => !ehMusica(c));
  let env = duck(t, 0, d, -27, -21);
  if (t === '01') env = [[0, -6], [2.9, -5], [3.3, -21], ...env.filter(([a]) => a > 3.6)]; // abertura com a musica na frente
  s.cues.push({ file: '@clipe/so-audio/clipe-so-audio.wav', at: 0, from: Math.round(g * 1000) / 1000, len: d, fadeIn: t === '01' ? 0.05 : 0, fadeOut: t === '03' ? 3 : 0, env });
  g += d;
}
// 3) bloco 04-06: Emergence continua; abre espaco quando o clipe canta
const sung = { '04': [[2.4, 8.4]], '05': [[0, dur['05']]], '06': [[0, 11]] };
g = 0;
for (const t of ['04', '05', '06']) {
  const s = so[t]; const d = dur[t];
  s.cues = s.cues.filter((c) => !/^@mus\//.test(c.file));
  let env = duck(t, 0, d, -29, -24);
  for (const [a, b] of sung[t]) env = [...env.filter(([x]) => x < a - 0.6 || x > b + 0.6), [Math.max(0, a - 0.6), -29], [a, -42], [b, -42], [b + 0.6, -29]].sort((p, q) => p[0] - q[0]);
  s.cues.push({ file: MUS.emergence, at: 0, from: Math.round(g * 1000) / 1000, len: d, fadeIn: t === '04' ? 2 : 0, fadeOut: t === '06' ? 3 : 0, env });
  g += d;
}
// 4) bloco 09-10: A New Beginning continua (09 sai do preto; no fim do 10 entra o "coisa parecida")
g = 0;
for (const t of ['09', '10']) {
  const s = so[t]; const d = t === '10' ? 43.4 : dur[t];
  s.cues = s.cues.filter((c) => !/^@mus\//.test(c.file));
  s.cues.push({ file: MUS.anb, at: 0, from: Math.round(g * 1000) / 1000, len: d, fadeIn: t === '09' ? 2 : 0, fadeOut: t === '10' ? 2.5 : 0, env: duck(t, 0, d, -26, -20) });
  g += dur[t];
}
for (const t of ORDEM) salva(t, so[t]);
console.log('ok: som v3 aplicado em', ORDEM.join(' '));
