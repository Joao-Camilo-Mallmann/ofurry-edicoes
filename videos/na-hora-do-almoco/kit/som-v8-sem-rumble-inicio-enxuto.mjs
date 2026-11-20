/**
 * Som v8 (13/11), dois pedidos do usuario:
 *
 * A) "Low End Rumble 01.wav nao ficou legal, nao faz sentido com o video, devia ser um evento muito especifico;
 *    talvez algo mais suave no lugar". Era um grave puro de 1,25 s em 59 entradas de texto. Saem TODOS. No lugar,
 *    um baque suave de papel (Office Supplies/Hard Cover Book Close Cover 02.wav: 0,8 s, sem subgrave) so em 8
 *    entradas principais (texto com flash + pancada, a mais de 4 s de um Impact e a mais de 10 s da anterior).
 *
 * B) A reclamacao da WMG voltou no envio de 13/11 (0:00-1:43, 2:45-2:53, 3:27-3:39): a cama do karaoke casou inteira.
 *    Pedido: "diminuir o tempo que essa musica acontece, deixar os trechos que realmente forem precisos, onde le a
 *    letra; no comeco tem 1 minuto e 30, simplificar bastante; talvez um leve efeito por cima".
 *      01    0:00-0:06  so a abertura do clipe (musica na frente, como antes) e sai em fade
 *      01-03 0:03-1:50  cama LIVRE continua: Touching Moment (Wayne Jones), -26 dB sob a fala, -22 nas pausas
 *      02    0:34-0:44  verso "No centro da sala ... comida e tristeza" cantado junto com a citacao (10,6 s)
 *      03    1:24-1:36  12 s do instrumental sob "rabeca ... violino" (exemplo do que a narracao descreve)
 *      O karaoke continuo (0:52-1:50) e o clipe continuo (0:06-0:32, 0:44-0:53) saem: de 110 s para ~29 s.
 *    "fx": "radio" (ver preparar.mjs) nas pecas cantadas sob a narracao: verso (02), instrumental (03), medo (04),
 *    ei moco (06). E timbre, nao disfarce: nao muda o que o Content ID reconhece.
 *
 * Idempotente (as cues novas levam id "v8-..."). Backup em output/_backup-som-v8/. Rode DEPOIS de v4, v5, v6 e v7.
 * Depois: bun kit/preparar.mjs 01 02 03 04 05 06 07 08 09 e bun kit/finalizar.mjs --sem-render
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const ORDEM = ['01', '02', '03', '04', '05', '06', '61', '07', '08', '09', '10'];
const arq = (t) => join(OUT, `trecho-${t}`, 'sons.json');
const abre = (t) => JSON.parse(readFileSync(arq(t), 'utf8'));
const salva = (t, s) => writeFileSync(arq(t), JSON.stringify(s, null, 1));
const fala = (t) => { try { return JSON.parse(readFileSync(join(OUT, `trecho-${t}`, 'midia', 'narracao.json'), 'utf8')); } catch { return []; } };
const r2 = (x) => Math.round(x * 100) / 100;

const BK = join(OUT, '_backup-som-v8');
mkdirSync(BK, { recursive: true });
for (const t of ORDEM) if (!existsSync(join(BK, `sons-${t}.json`))) copyFileSync(arq(t), join(BK, `sons-${t}.json`));

// envelope que abaixa quando o narrador fala (base) e sobe nas pausas >= 0.9 s (pausa) - igual ao som-v3/v4
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
  return env.map(([a, b]) => [r2(a), b]).filter((p, i, arr) => i === 0 || p[0] > arr[i - 1][0]);
}
// abre um buraco na cama enquanto o clipe toca (a, b em s do trecho)
const buraco = (env, a, b, fundo, volta) => [...env.filter(([x]) => x < a - 0.6 || x > b + 0.6), [Math.max(0, a - 0.6), volta], [a, fundo], [b, fundo], [b + 0.6, volta]].sort((p, q) => p[0] - q[0]);

const so = Object.fromEntries(ORDEM.map((t) => [t, abre(t)]));
for (const t of ORDEM) so[t].cues = so[t].cues.filter((c) => !/^v8-/.test(c.id || ''));

// ---------- A) Rumble fora; baque suave de papel so nas entradas principais ----------
const BAQUE = '@sfx/Office Supplies/Hard Cover Book Close Cover 02.wav';
const ATAQUE = 0.22; // s ate o pico (medido em janelas de 10 ms)
const PRINCIPAIS = [['01', 19], ['03', 43.9], ['05', 6.18], ['07', 10.8], ['07', 36.7], ['07', 51.3], ['08', 3.44], ['08', 15.51]]; // [trecho, s local]
let rumbles = 0;
for (const t of ORDEM) { const n = so[t].cues.length; so[t].cues = so[t].cues.filter((c) => !/Low End Rumble 01\.wav$/.test(c.file)); rumbles += n - so[t].cues.length; }
for (const [t, em] of PRINCIPAIS) so[t].cues.push({ id: 'v8-baque', file: BAQUE, at: r2(em - ATAQUE), gain: -6, fadeIn: 0.01, fadeOut: 0.2 });

// ---------- B) inicio enxuto: abertura curta + cama livre + so as pecas que a narracao pede ----------
const CLIPE = '@clipe/so-audio/clipe-so-audio.wav';
const KARAOKE = '@clipe/karaoke/na-hora-do-almoco-karaoke-runy.m4a';
const CAMA = '@mus/Touching Moment - Wayne Jones(1).mp3';
const CAMA_INI = 1.6; // o arquivo abre com 1,6 s de silencio
for (const t of ['01', '02', '03']) so[t].cues = so[t].cues.filter((c) => !/clipe-so-audio\.wav$|karaoke/.test(c.file) && c.file !== CAMA);
const d = Object.fromEntries(['01', '02', '03'].map((t) => [t, so[t].dur]));

// 01: abertura do clipe na frente e fade; a cama entra por baixo
so['01'].cues.push({ id: 'v8-abertura', file: CLIPE, at: 0, from: 0, len: 6, fadeIn: 0.05, fadeOut: 2.6, env: [[0, -6], [2.9, -5], [3.4, -12], [6, -18]] });
const c1 = 3.2;
so['01'].cues.push({ id: 'v8-cama', file: CAMA, at: c1, from: CAMA_INI, len: r2(d['01'] - c1), fadeIn: 2.8, fadeOut: 0, env: duck('01', c1, d['01'], -26, -22) });
// 02: verso cantado so durante a citacao (voz do clipe entra em 39,8 s; narrador cita de 4,4 a 10,4 s do trecho)
const v0 = 1.6, vLen = 10.6;
so['02'].cues.push({ id: 'v8-verso', file: CLIPE, at: v0, from: 36.8 + v0, len: vLen, fadeIn: 1.2, fadeOut: 1.8, fx: 'radio', env: [[0, -22], [v0 + vLen, -22]] });
so['02'].cues.push({ id: 'v8-cama', file: CAMA, at: 0, from: r2(CAMA_INI + d['01'] - c1), len: d['02'], fadeIn: 0, fadeOut: 0, env: buraco(duck('02', 0, d['02'], -26, -22), v0 + 0.4, v0 + vLen - 1.2, -42, -26) });
// 03: 12 s do instrumental (karaoke = mesma gravacao sem voz, no mesmo ponto do v7) sob "rabeca ... violino"
const i0 = 22.6, iLen = 12;
so['03'].cues.push({ id: 'v8-instrumental', file: KARAOKE, at: i0, from: r2(70.657 + i0), len: iLen, fadeIn: 1.2, fadeOut: 2.5, fx: 'radio', env: [[i0, -22], [i0 + iLen, -22]] });
so['03'].cues.push({ id: 'v8-cama', file: CAMA, at: 0, from: r2(CAMA_INI + d['01'] - c1 + d['02']), len: d['03'], fadeIn: 0, fadeOut: 3, env: buraco(duck('03', 0, d['03'], -26, -22), i0 + 0.4, i0 + iLen - 1.5, -42, -26) });
// timbre de radio nas outras pecas cantadas sob a narracao
for (const [t, re] of [['04', /04-medo-audio\.wav$/], ['06', /06-ei-moco-audio\.wav$/]]) for (const c of so[t].cues) if (re.test(c.file)) c.fx = 'radio';

for (const t of ORDEM) salva(t, so[t]);

// ---------- mapa ----------
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let g = 0, total = 0;
console.log(`rumbles removidos nesta rodada: ${rumbles} | baques suaves: ${PRINCIPAIS.length}`);
console.log('audio do Belchior (clipe, karaoke, camadas) no video final:');
for (const t of ORDEM) {
  const s = so[t];
  for (const c of s.cues) {
    if (!/^@clipe\/|^@camadas\//.test(c.file)) continue;
    const len = c.len ?? (s.dur - (c.at || 0)); total += len;
    console.log(`  ${mmss(g + (c.at || 0))}-${mmss(g + (c.at || 0) + len)} ${len.toFixed(1).padStart(5)} s  trecho-${t}  ${c.file.split('/').pop()}${c.fx ? ' [radio]' : ''}${c.gain ? ` (${c.gain} dB)` : ''}`);
  }
  g += s.dur;
}
console.log(`total: ${total.toFixed(1)} s de ${mmss(g)}`);
