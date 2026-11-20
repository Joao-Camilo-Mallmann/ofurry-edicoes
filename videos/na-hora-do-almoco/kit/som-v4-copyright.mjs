/**
 * Som v4 (08/11): menos musica do clipe, por causa da reclamacao de audio da WMG no YouTube
 * (janelas 0:00-1:52, 2:42-2:55, 3:30-3:55, 7:06-7:14). Fica so o que o roteiro precisa:
 *   01  0:00-0:30  introducao instrumental (bloco A)
 *   02  0:35-1:02  verso "No centro da sala" cantado por baixo da citacao (bloco B)
 *   03  1:23-1:38  15 s sob "rabeca ... violino estridente" (mesmo ponto do clipe de antes)
 *   06  2:47-2:56  "Ei, moco" 9,5 s, com respiro depois do "e hora do almoco" do 05
 *   61  3:37-3:50  "coisa parecida" entra no corte seco dos 8 s (titulo abre so com vento)
 *   10  7:08-7:16  fim com 8 s em vez de 11
 * 04 (medo), 05 (sincronizado) e 07 (intro a -21 dB) nao mudam. So som: nenhum trecho precisa de re-render.
 * Idempotente: tira as cues do clipe desses trechos e recria. Backup em output/_backup-som-v4/.
 * Depois: bun kit/preparar.mjs 01 02 03 06 61 10 e bun kit/finalizar.mjs --sem-render
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const ORDEM = ['01', '02', '03', '04', '05', '06', '61', '07', '08', '09', '10'];
const abre = (t) => JSON.parse(readFileSync(join(OUT, `trecho-${t}`, 'sons.json'), 'utf8'));
const salva = (t, s) => writeFileSync(join(OUT, `trecho-${t}`, 'sons.json'), JSON.stringify(s, null, 1));
const dur = Object.fromEntries(ORDEM.map((t) => [t, Number(readFileSync(join(OUT, `trecho-${t}`, 'hf', 'index.html'), 'utf8').match(/id="root"[^>]*data-duration="([\d.]+)"/)[1])]));
const fala = (t) => { try { return JSON.parse(readFileSync(join(OUT, `trecho-${t}`, 'midia', 'narracao.json'), 'utf8')); } catch { return []; } };

// envelope que abaixa quando o narrador fala (base) e sobe nas pausas >= 0.9 s (pausa) - igual ao som-v3
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

const CLIPE = '@clipe/so-audio/clipe-so-audio.wav';
const EI_MOCO = '@clipe/trechos/06-ei-moco-audio.wav';
const COISA = '@clipe/trechos/07-coisa-parecida-audio.wav';
const ANB = '@mus/No.10 _A New Beginning - Esther Abrami.mp3';
const ehClipe = (c) => /clipe-so-audio|06-ei-moco|07-coisa-parecida/.test(c.file);

// backup (uma vez)
const BK = join(OUT, '_backup-som-v4');
mkdirSync(BK, { recursive: true });
for (const t of ORDEM) { const b = join(BK, `sons-${t}.json`); if (!existsSync(b)) copyFileSync(join(OUT, `trecho-${t}`, 'sons.json'), b); }

const so = {};
for (const t of ['01', '02', '03', '06', '61', '10']) { so[t] = abre(t); so[t].cues = so[t].cues.filter((c) => !ehClipe(c)); }

// 01: bloco A, introducao instrumental, 30 s e fade (abertura com a musica na frente, como antes)
so['01'].cues.push({ file: CLIPE, at: 0, from: 0, len: 30, fadeIn: 0.05, fadeOut: 2.5,
  env: [[0, -6], [2.9, -5], [3.3, -21], ...duck('01', 0, 30, -27, -21).filter(([a]) => a > 3.6)] });
// 02: bloco B, verso cantado entra em "Belchior canta:" (2.6 s) e vai ate o fim do trecho
so['02'].cues.push({ file: CLIPE, at: 2.6, from: 30.0, len: Math.round((dur['02'] - 2.6) * 10) / 10, fadeIn: 1.2, fadeOut: 3, env: duck('02', 2.6, dur['02'], -27, -21) });
// 03: 15 s sob rabeca/violino, mesmo ponto do clipe de antes (clipe = tempo do video: 61.7 + 21.5)
so['03'].cues.push({ file: CLIPE, at: 21.5, from: 83.2, len: 15, fadeIn: 1.2, fadeOut: 2.5, env: duck('03', 21.5, 36.5, -27, -21) });
// 06: "Ei, moco" 9,5 s, comecando 1,5 s depois para nao emendar com o sincronizado do 05
so['06'].cues.push({ file: EI_MOCO, at: 1.5, from: 1.5, len: 9.5, fadeIn: 2.0, fadeOut: 2.5, env: [[0, -20], [1.9, -22], [8.8, -22], [9.2, -24], [11, -24]] });
// 61: musica so do corte seco dos 8 s em diante (fadeIn 1.2 a partir de 6.9 = cheia em 8.1); vento como cama audivel (-14 dB; a -24 a abertura ficava muda)
so['61'].cues.push({ file: COISA, at: 6.9, from: 6.9, len: 13.1, fadeIn: 1.2, fadeOut: 3, gain: -9 });
for (const c of so['61'].cues) if (/Windy Desert/.test(c.file)) c.gain = -14;
// 10: fim com 8,3 s (mesma relacao from-at = 15.5 de antes); A New Beginning entrega para o clipe
so['10'].cues.push({ file: COISA, at: 44.3, from: 28.8, len: 8.3, fadeIn: 1.5, fadeOut: 2.8, gain: -9 });
for (const c of so['10'].cues) if (c.file === ANB) { c.len = 45.5; c.fadeOut = 2.5; c.env = [[0, -26], [40.77, -20], [45.5, -20]]; }

for (const t of Object.keys(so)) salva(t, so[t]);

// mapa da musica do clipe em mm:ss do video final
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let g = 0;
console.log('musica do clipe/camadas no video final:');
let total = 0;
for (const t of ORDEM) {
  const s = abre(t);
  for (const c of s.cues) {
    if (!/^@clipe\/|^@camadas\//.test(c.file)) continue;
    const len = c.len ?? (s.dur - (c.at || 0));
    const a = g + (c.at || 0), b = a + len;
    total += len;
    console.log(`  ${mmss(a)}-${mmss(b)}  ${String(len.toFixed(1)).padStart(5)} s  trecho-${t}  ${c.file.split('/').pop()}${c.gain ? ` (${c.gain} dB)` : ''}`);
  }
  g += dur[t];
}
console.log(`total: ${total.toFixed(1)} s de ${mmss(g)} | som v4 aplicado em 01 02 03 06 61 10`);
