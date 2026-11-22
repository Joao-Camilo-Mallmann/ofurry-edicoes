/**
 * Som v11 (16/11): trilha continua e sem whoosh. Retorno do Matheus sobre o final de 13/11:
 *   "a musica de fundo, eu gostei, mas de vez em quando ela para em momentos que fica estranho ela parar"
 *   "[o whoosh] por mim nao tem tanta necessidade de colocar"
 * Resposta do J.C: "vou deixar mais suaves as transicoes das musicas". As 5 musicas ficam; muda como elas tocam.
 *
 * O que a medicao da V1 mostrou:
 *   - a cama caia para -42 dB em 0,6 s a cada peca do clipe (o maior buraco: 2:24 a 3:04) e as 4 trocas de musica eram
 *     "sai em fade, quase silencio, entra a outra" (em 5:33, 1 s de silencio total);
 *   - as musicas comecam fracas e crescem de 13 a 17 dB ate o ponto em que saem (Storyteller: -28 -> -11 LUFS). Com
 *     ganho fixo, toda troca era "fim forte de uma, comeco fraco da outra": so um crossfade nao resolveria.
 *
 * O que este script faz (so nos sons.json; preparar.mjs e montar.mjs nao mudam):
 *   A) tira os whoosh/whip/swish/zing (85). Ficam os sons ligados a cena (papel, caneta, talher, pratos, agulha...).
 *   B) refaz as cues das 5 musicas (@mus/) a partir de UMA curva em tempo do video, fatiada por trecho:
 *      - ganho que acompanha o volume medido de cada musica: a cama fica ABAIXO_DA_VOZ LU abaixo da narracao na fala
 *        e PAUSA dB acima nas pausas entre capitulos;
 *      - sob as pecas do clipe a cama desce SOB_CLIPE dB em RAMPA s e volta, em vez de sumir;
 *      - as 4 trocas viram crossfade de XFADE s centrado no corte (potencia constante): a musica que entra comeca
 *        XFADE/2 antes do fim do trecho anterior e a que sai tem uma cauda de XFADE/2 no trecho seguinte;
 *      - a Emergence segue baixa sob o clipe do trecho 61 (eram 10 s sem cama).
 *      Por causa do crossfade, cada musica fica deslocada 3 s em relacao a V1 (comeca 3 s antes do corte).
 *   C) regenera efeitos-sonoros-em-ordem.md.
 *
 * Idempotente (as cues novas levam id "v11-cama"). Backup em output/_backup-som-v11/. Rode DEPOIS do som-v10.
 * Depois: bun kit/preparar.mjs XX (os 11 trechos) e bun kit/montar.mjs <nome> 01 02 03 04 05 06 61 07 08 09 10 --final --rapido
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ---------- ajustes (mexa aqui depois de ouvir) ----------
const VOZ = -24.5;          // LUFS da narracao nos mix.wav (auditoria-som.mjs, 16/11: -23,4 a -25,1)
const ABAIXO_DA_VOZ = 21;   // LU: distancia da cama para a voz durante a fala (a V1 ficava em 19 a 20 nos trechos sem clipe)
const PAUSA = 3;            // dB a mais nas pausas de 1,2 s ou mais (sao as viradas de capitulo)
const SOB_CLIPE = -8;       // dB: quanto a cama desce enquanto uma peca do clipe do Belchior toca
const RAMPA = 2.5;          // s: descida e subida em volta do clipe
const XFADE = 6;            // s: crossfade nas trocas de musica (metade antes, metade depois do corte)
const SUBIDA_FINAL = 6;     // dB: a A New Beginning cresce ao longo do encerramento, como na V1
const ALIVIO_08 = -6;       // dB: a Yacoby alivia em "se fechar para os outros" (na V1 ia a -60)
const PISO = -32;           // LUFS: abaixo disso a musica e tratada como -32 (nao amplifica silencio)

const KIT = dirname(fileURLToPath(import.meta.url));
const VIDEO = join(KIT, '..');
const OUT = join(VIDEO, 'output');
const MUSICAS = 'D:/YT/!Assets/Musicas/';
const ORDEM = ['01', '02', '03', '04', '05', '06', '61', '07', '08', '09', '10'];
const arq = (t) => join(OUT, `trecho-${t}`, 'sons.json');
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const mmss = (s) => { const x = Math.round(s * 10) / 10; return `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, '0')}`; };

const BK = join(OUT, '_backup-som-v11');
mkdirSync(BK, { recursive: true });
for (const t of ORDEM) if (!existsSync(join(BK, `sons-${t}.json`))) copyFileSync(arq(t), join(BK, `sons-${t}.json`));

const so = Object.fromEntries(ORDEM.map((t) => [t, JSON.parse(readFileSync(arq(t), 'utf8'))]));
const dur = Object.fromEntries(ORDEM.map((t) => [t, so[t].dur]));
const ini = {};
{ let g = 0; for (const t of ORDEM) { ini[t] = r3(g); g += dur[t]; } }
const TOTAL = r3(ini['10'] + dur['10']);

// valor de uma curva [[x, y], ...] em x (linear por partes; fora das pontas vale a ponta)
const val = (pts, x) => {
  if (!pts || !pts.length) return 0;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return x1 - x0 < 1e-9 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return pts[pts.length - 1][1];
};

// ---------- A) whoosh fora ----------
const ehWhoosh = (f) => f.startsWith('@sw/') || /Transitional Elements\/Whip/.test(f) || /\/Swishes\//.test(f);
let whoosh = 0;
for (const t of ORDEM) { const n = so[t].cues.length; so[t].cues = so[t].cues.filter((c) => !ehWhoosh(c.file)); whoosh += n - so[t].cues.length; }

// ---------- B) a cama em tempo do video ----------
// confere as pecas do clipe de que as descidas dependem (se um script anterior mudou alguma, os numeros abaixo mudam junto)
const peca = (t, re, at, len) => { const c = so[t].cues.filter((c) => re.test(c.file)); if (c.length !== 1 || c[0].at !== at || c[0].len !== len) throw new Error(`trecho-${t}: esperava 1 cue ${re} em ${at} s com ${len} s`); };
peca('02', /clipe-so-audio\.wav$/, 1.6, 10.6);
peca('03', /karaoke/, 22.6, 12);
peca('04', /04-medo-audio\.wav$/, 2.4, 6);
peca('05', /hora-do-almoco-sincronizado\.wav$/, 0, 17.3);
peca('06', /06-ei-moco-audio\.wav$/, 1.5, 19);
peca('61', /07-coisa-parecida-audio\.wav$/, 0, 10);
peca('07', /01-intro-instrumental-audio\.wav$/, 18.75, 5.5);

// descidas: [inicio do fundo, fim do fundo, rampa de descida, rampa de subida, dB], em tempo do video.
// fundo = do fim do fade-in ao comeco do fade-out da peca (o preparar.mjs forca fade-in >= 1,2 s e fade-out >= 1,5 s nas @clipe/)
const DESCIDAS = [
  [ini['02'] + 2.8, ini['02'] + 10.4, RAMPA, RAMPA, SOB_CLIPE],   // 0:35 verso cantado
  [ini['03'] + 23.8, ini['03'] + 32.1, RAMPA, RAMPA, SOB_CLIPE],  // 1:25 instrumental "rabeca, violino"
  [ini['04'] + 3.6, ini['04'] + 6.9, RAMPA, RAMPA, SOB_CLIPE],    // 1:54 "medo, medo"
  [ini['05'] + 9.6, ini['06'] + 18.3, RAMPA, RAMPA, SOB_CLIPE],   // 2:35 "e hora do almoco" (a voz so entra aos 9,1 s do trecho 05) + "Ei, moco" ate 3:01
  [ini['61'] + 1.2, ini['61'] + 7.4, RAMPA, RAMPA, SOB_CLIPE],    // 3:29 clipe "coisa parecida" em tela cheia
  [ini['07'] + 19, ini['07'] + 24, 0.4, 0.6, -8],                 // 3:57 TV de 1974: igual a V1
];

// fala em tempo do video (narracao.json esta no tempo do arquivo da narracao; a cue @narr diz onde ele entra no trecho)
const fala = [];
for (const t of ORDEM) {
  let w = [];
  try { w = JSON.parse(readFileSync(join(OUT, `trecho-${t}`, 'midia', 'narracao.json'), 'utf8')); } catch { /* trecho sem narracao */ }
  const n = so[t].cues.find((c) => c.file === '@narr');
  const d = n ? (n.at || 0) - (n.from || 0) : 0;
  for (const x of w) {
    const a = ini[t] + x.start + d, b = ini[t] + Math.min(x.end + d, dur[t]);
    if (x.start + d >= dur[t]) continue;
    if (fala.length && a - fala[fala.length - 1][1] < 0.35) fala[fala.length - 1][1] = Math.max(fala[fala.length - 1][1], b);
    else fala.push([a, b]);
  }
}
// respiro: 0 dB na fala, +PAUSA nas pausas longas
let respiro = [[0, 0]];
const pausas = [];
{
  let u = 0;
  for (const [a, b] of [...fala, [Infinity, Infinity]]) {
    if (a - u >= 1.2) {
      pausas.push([u, Math.min(a, TOTAL)]);
      respiro.push([u + 0.1, 0], [u + 0.7, PAUSA]);
      if (Number.isFinite(a)) respiro.push([a - 0.5, PAUSA], [a - 0.1, 0]);
    }
    u = b;
  }
  respiro = respiro.filter((p, i, arr) => i === 0 || p[0] > arr[i - 1][0] + 1e-6);
}
for (const [a, b, rd, ru, d] of DESCIDAS) {
  const v0 = val(respiro, a - rd), v1 = val(respiro, b + ru);
  respiro = [...respiro.filter(([x]) => x < a - rd || x > b + ru), [a - rd, v0], [a, d], [b, d], [b + ru, v1]].sort((p, q) => p[0] - q[0]);
}

// as 5 musicas: g0 = instante do video em que o arquivo esta em f0
const nome = (re) => { for (const t of ORDEM) for (const c of JSON.parse(readFileSync(join(BK, `sons-${t}.json`), 'utf8')).cues) if (c.file.startsWith('@mus/') && re.test(c.file)) return c.file; throw new Error(`musica nao encontrada: ${re}`); };
const H = XFADE / 2;
const c1 = ini['04'], c2 = ini['07'], c3 = ini['08'], c4 = ini['09'];
const SAI = [[0, 0], [0.25, -0.69], [0.5, -3.01], [0.75, -8.34], [0.9, -16.1], [1, -60]];   // cos(x * 90 graus), em dB
const ENTRA = SAI.map(([x, d]) => [1 - x, d]).reverse();
const curva = (c, forma) => forma.map(([x, d]) => [c - H + x * XFADE, d]);
const TRILHA = [
  { k: 'Touching Moment', file: nome(/Touching Moment/), g0: 3.2, f0: 1.6, de: 3.2, ate: c1 + H, fadeIn: 2.8, xf: curva(c1, SAI) },
  { k: 'Emergence', file: nome(/Emergence/), g0: c1 - H, f0: 0, de: c1 - H, ate: c2 + H, xf: [...curva(c1, ENTRA), ...curva(c2, SAI)] },
  { k: 'Storyteller', file: nome(/Storyteller/), g0: c2 - H, f0: 0, de: c2 - H, ate: c3 + H, xf: [...curva(c2, ENTRA), ...curva(c3, SAI)] },
  { k: 'Yacoby', file: nome(/Yacoby/), g0: c3 - H, f0: 0, de: c3 - H, ate: c4 + H, xf: [...curva(c3, ENTRA), ...curva(c4, SAI)],
    extra: [[c4 - 7.4, 0], [c4 - 5, ALIVIO_08]] },
  { k: 'A New Beginning', file: nome(/A New Beginning/), g0: c4 - H, f0: 0, de: c4 - H, ate: r3(ini['10'] + 44.5), fadeOut: 2.5, xf: curva(c4, ENTRA),
    extra: [[ini['10'], 0], [ini['10'] + 39.77, SUBIDA_FINAL]] },
];

// volume de cada musica ao longo do arquivo: curto prazo (3 s) do ebur128, suavizado numa janela de ~9 s, um ponto a cada 3 s
function perfil(file, ate) {
  const path = MUSICAS + file.slice('@mus/'.length);
  if (!existsSync(path)) throw new Error(`arquivo nao encontrado: ${path}`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-t', String(ate + 8), '-i', path, '-map', '0:a:0',
    '-af', 'aformat=sample_rates=48000:channel_layouts=stereo,ebur128', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const S = [...r.stderr.matchAll(/t:\s*([\d.]+)\s+TARGET:.*?S:\s*(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]).filter(([, s]) => Number.isFinite(s) && s > -100);
  if (S.length < 30) throw new Error(`nao consegui medir ${path}`);
  const pts = [];
  for (let x = 0; x <= ate + 3; x += 3) {
    // S(t) cobre de t-3 a t: os S entre x-1,5 e x+4,5 cobrem de x-4,5 a x+4,5
    const w = S.filter(([t]) => t >= x - 1.5 && t <= x + 4.5);
    const e = w.reduce((a, [, s]) => a + 10 ** (s / 10), 0) / (w.length || 1);
    pts.push([x, Math.max(PISO, w.length ? 10 * Math.log10(e) : PISO)]);
  }
  return pts;
}
for (const m of TRILHA) m.perfil = perfil(m.file, m.f0 + m.ate - m.g0);

const ALVO = VOZ - ABAIXO_DA_VOZ;
const ganho = (m, g) => ALVO - val(m.perfil, m.f0 + g - m.g0) + val(respiro, g) + val(m.extra, g) + val(m.xf, g);

// tira pontos que a reta entre os vizinhos ja descreve (tolerancia em dB)
function enxuga(pts, tol = 0.2) {
  if (pts.length < 3) return pts;
  let pior = 0, ip = -1;
  const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(pts[i][1] - (y0 + (y1 - y0) * (pts[i][0] - x0) / (x1 - x0))); if (d > pior) { pior = d; ip = i; } }
  if (pior <= tol) return [pts[0], pts[pts.length - 1]];
  return [...enxuga(pts.slice(0, ip + 1), tol).slice(0, -1), ...enxuga(pts.slice(ip), tol)];
}

for (const t of ORDEM) so[t].cues = so[t].cues.filter((c) => !c.file.startsWith('@mus/'));
const mapa = [];
for (const m of TRILHA) for (const t of ORDEM) {
  const a = Math.max(m.de, ini[t]), b = Math.min(m.ate, r3(ini[t] + dur[t]));
  if (b - a < 0.05) continue;
  const xs = new Set([a, b]);
  for (let k = 0; ; k++) { const x = m.g0 + 3 * k - m.f0; if (x >= b) break; if (x > a) xs.add(x); }
  for (const [x] of [...respiro, ...(m.extra || []), ...m.xf]) if (x > a && x < b) xs.add(x);
  const pts = enxuga([...xs].sort((p, q) => p - q).map((x) => [x, ganho(m, x)]));
  const env = pts.map(([x, y]) => [r2(x - ini[t]), r2(y)]).filter((p, i, arr) => i === 0 || p[0] > arr[i - 1][0]);
  const at = r2(a - ini[t]), len = r2(b - a);
  const comeca = Math.abs(a - m.de) < 1e-6, acaba = Math.abs(b - m.ate) < 1e-6;
  so[t].cues.push({
    id: 'v11-cama', file: m.file, at, from: r2(m.f0 + a - m.g0), len,
    fadeIn: comeca ? (m.fadeIn ?? 1.2) : 0,        // entrada no meio do trecho: o preparar.mjs forca 1,2 s de qualquer jeito
    fadeOut: acaba ? (m.fadeOut ?? 1.5) : 0,       // cauda: idem, 1,5 s
    env,
  });
  mapa.push(`  ${mmss(a)}-${mmss(b)}  trecho-${t}  ${m.k.padEnd(16)} arquivo ${String(r2(m.f0 + a - m.g0)).padStart(6)} s  ${String(env.length).padStart(2)} pontos  ${Math.min(...env.map((p) => p[1])).toFixed(0)} a ${Math.max(...env.map((p) => p[1])).toFixed(0)} dB`);
}

for (const t of ORDEM) writeFileSync(arq(t), JSON.stringify(so[t], null, 1));

// ---------- C) lista de efeitos ----------
const LISTA = join(VIDEO, 'efeitos-sonoros-em-ordem.md');
const titulos = Object.fromEntries([...readFileSync(LISTA, 'utf8').matchAll(/^## Trecho (\d\d): (.*)$/gm)].map((m) => [m[1], m[2].trim()]));
const linhas = [];
let toques = 0;
const efeitos = new Set();
for (const t of ORDEM) {
  const cues = so[t].cues.filter((c) => c.file.startsWith('@sfx/') || c.file.startsWith('@sw/')).sort((p, q) => (p.at || 0) - (q.at || 0));
  if (!cues.length) continue;
  linhas.push('', `## Trecho ${t}: ${titulos[t] || ''}`.trimEnd(), '', '| Tempo | Efeito | Pasta | Volume | Duração |', '|---|---|---|---|---|');
  for (const c of cues) {
    const partes = c.file.replace(/^@sfx\//, 'PACK - EFEITOS SONOROS/').replace(/^@sw\//, 'Swoosh effects/').split('/');
    const f = partes.pop();
    efeitos.add(c.file); toques++;
    linhas.push(`| ${mmss(ini[t] + (c.at || 0))} | ${f} | ${partes.join('/')} | ${c.gain ?? 0} dB | ${c.len ? c.len.toFixed(1) + ' s' : 'inteiro'} |`);
  }
}
writeFileSync(LISTA, [
  '# Efeitos sonoros de "Na Hora do Almoço", em ordem de aparição',
  '',
  `Gerado em 16/11/2026 (som v11) a partir dos sons.json (final de ${Math.floor(TOTAL / 60)}:${String(Math.floor(TOTAL % 60)).padStart(2, '0')}). ${toques} toques de ${efeitos.size} efeitos.`,
  'Pastas de origem: D:/YT/!Assets/PACK - EFEITOS SONOROS/ e D:/YT/!Assets/Swoosh effects/.',
  'Volume = ganho da cue em dB (o mix ainda tira 4 dB de todo efeito). O Low End Rumble 01.wav saiu do vídeo em 13/11; os whooshes, whips e swishes saíram em 16/11.',
  ...linhas, '',
].join('\n'));

// ---------- mapa ----------
console.log(`whooshes removidos nesta rodada: ${whoosh}`);
console.log(`alvo da cama: ${ALVO} LUFS na fala (voz ${VOZ} - ${ABAIXO_DA_VOZ} LU), +${PAUSA} dB nas pausas, ${SOB_CLIPE} dB sob o clipe`);
console.log('pausas (cama sobe):', pausas.map(([a, b]) => `${mmss(a)}-${mmss(b)}`).join('  '));
console.log('descidas (fundo):  ', DESCIDAS.map(([a, b]) => `${mmss(a)}-${mmss(b)}`).join('  '));
console.log('trocas (crossfade):', [c1, c2, c3, c4].map((c) => `${mmss(c - H)}-${mmss(c + H)}`).join('  '));
console.log('cues da cama:');
for (const l of mapa) console.log(l);
console.log(`lista de efeitos: ${toques} toques de ${efeitos.size} efeitos -> ${LISTA}`);
