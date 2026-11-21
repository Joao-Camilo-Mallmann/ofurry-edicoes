/**
 * Som v5 (11/11): correcoes da auditoria geral de audio (medidas com kit/auditoria-som.mjs e kit/medir-final.mjs).
 * So som: nenhum trecho precisa de re-render por causa deste script. NAO acrescenta audio do clipe do Belchior.
 *
 * Emendas
 *   07->08 (5:00.8)  Storyteller era cortada seca no fim do 07 (a -37 dBFS, sozinha): ganha fade de 2,4 s
 *   04->05 (2:25.9)  Emergence caia 18 dB de uma vez na emenda (-24 -> -42): agora desce em rampa (1,5 s no 04 + 1,2 s no 05)
 *   01->02 (0:32.4)  o vento do fim do 01 era cortado no corte: continua 4,4 s no 02, ate o verso cantado entrar
 *   02->03 (1:01.7)  o whoosh de transicao sumia em fade no proprio pico: a cauda agora segue 0,38 s dentro do 03
 * Buracos sem cama deixados pelo som v4 (so voz + efeitos, pausas em silencio digital)
 *   0:58-1:25  vento baixo (Windy Desert, -24 dB efetivos, ~22 LU abaixo da voz) do fim do 02 ate o clipe voltar no 03
 * Niveis
 *   21 graves (Low End Rumble 01) e 1 Heartbeat chegavam a menos de 7 LU da voz: baixados para 7 LU (de -0,5 a -3,5 dB)
 *   15 efeitos em nivel de sussurro (-57 a -61 LUFS: marca-texto, interruptores, reverse do MORTE) sobem 8 dB
 *   14 efeitos mortos saem (13 x "14. Whoosh Swoosh" de 0,16 s com pico de -63 dBFS e 1 Reverse 03 a -116 dBFS)
 *   09: A New Beginning comecava inaudivel (-54 LUFS nos primeiros 5 s): abre em -17/-20 dB e assenta em -26 aos 16 s
 * Trecho 10
 *   o 1 s de silencio total depois de "SO NAO FIQUE EM SILENCIO" (13,45-14,45) tinha musica desde o som v3: volta a ser silencio
 *
 * Ordem: se o som-v4-copyright.mjs rodar de novo, rode este em seguida (o v4 regrava o envelope da A New Beginning no 10
 * e o silencio de 1 s volta a ter musica). Nao rode o som-v3.mjs.
 * Idempotente: valores absolutos; as cues novas levam "id": "v5-..." e sao recriadas a cada rodada.
 * Backup em output/_backup-som-v5/. Depois: bun kit/preparar.mjs 01 02 03 04 05 06 07 08 09 10 e bun kit/finalizar.mjs --sem-render
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const ORDEM = ['01', '02', '03', '04', '05', '06', '61', '07', '08', '09', '10'];
const abre = (t) => JSON.parse(readFileSync(join(OUT, `trecho-${t}`, 'sons.json'), 'utf8'));
const salva = (t, s) => writeFileSync(join(OUT, `trecho-${t}`, 'sons.json'), JSON.stringify(s, null, 1));

// backup (uma vez)
const BK = join(OUT, '_backup-som-v5');
mkdirSync(BK, { recursive: true });
for (const t of ORDEM) { const b = join(BK, `sons-${t}.json`); if (!existsSync(b)) copyFileSync(join(OUT, `trecho-${t}`, 'sons.json'), b); }

const so = Object.fromEntries(ORDEM.map((t) => [t, abre(t)]));
for (const t of ORDEM) so[t].cues = so[t].cues.filter((c) => !String(c.id || '').startsWith('v5-'));
const acha = (t, re, at) => so[t].cues.filter((c) => re.test(c.file) && (at == null || Math.abs((c.at || 0) - at) < 0.011));
const um = (t, re, at) => { const r = acha(t, re, at); if (r.length !== 1) throw new Error(`trecho-${t}: esperava 1 cue ${re} em ${at ?? '*'}, achei ${r.length}`); return r[0]; };
const log = [];

// --- efeitos mortos (nao soam): saem ---------------------------------------------------------------------------------
for (const t of ORDEM) {
  const antes = so[t].cues.length;
  so[t].cues = so[t].cues.filter((c) => !(/\/14\. Whoosh Swoosh\.wav$/.test(c.file) && (c.len || 9) <= 0.2) && !(t === '08' && /Reverse 03\.mp3$/.test(c.file)));
  if (antes !== so[t].cues.length) log.push(`trecho-${t}: ${antes - so[t].cues.length} efeito(s) mudo(s) removido(s)`);
}

// --- ganhos (valor do sons.json; o preparar ainda tira 4 dB de todo efeito) -----------------------------------------------
const RUMBLE = /Low End Rumble 01\.wav$/;
const GANHOS = [
  // graves a menos de 7 LU da voz -> 7 LU
  ['01', RUMBLE, 6.66, -12.5], ['01', RUMBLE, 8.74, -13], ['01', RUMBLE, 12.98, -13],
  ['02', RUMBLE, 13.38, -14], ['02', RUMBLE, 15.38, -14],
  ['04', RUMBLE, 3.64, -14],
  ['06', RUMBLE, 7.82, -13.5], ['06', RUMBLE, 13.66, -13.5], ['06', RUMBLE, 22.95, -14], ['06', RUMBLE, 33.11, -13.5], ['06', RUMBLE, 36.39, -14],
  ['07', RUMBLE, 10.78, -14], ['07', RUMBLE, 17.08, -14], ['07', RUMBLE, 36.68, -14], ['07', RUMBLE, 51.28, -14], ['07', RUMBLE, 58.98, -14],
  ['08', RUMBLE, 13, -14.5], ['08', RUMBLE, 15.49, -14.5], ['08', RUMBLE, 17.33, -14.5], ['08', RUMBLE, 29.01, -14.5],
  ['09', /Heartbeat\.wav$/, 24.3, -16],
  // sussurros (-57 a -61 LUFS) -> +8 dB
  ['02', /Magic Marker 01/, 4.25, -7], ['02', /Magic Marker 02/, 5.9, -7], ['02', /Magic Marker 01/, 7.45, -7], ['02', /Magic Marker 02/, 8.9, -7],
  ['04', /Magic Marker 01/, 8.95, -8],
  ['05', /Magic Marker 01/, 7.45, -9], ['05', /Magic Marker 02/, 9.6, -9], ['05', /Magic Marker 01/, 11.6, -9], ['05', /Magic Marker 02/, 13.1, -10], ['05', /Magic Marker 01/, 14.95, -9],
  ['06', /Reverse 05\.mp3$/, 14.6, -6],
  ['07', /Magic Marker 01/, 43.3, -10], ['07', /Light Switch 01/, 59.05, -18], ['07', /Light Switch 02/, 60.3, -19], ['07', /Light Switch 01/, 61.6, -20],
];
for (const [t, re, at, g] of GANHOS) um(t, re, at).gain = g;
log.push(`${GANHOS.length} ganhos de efeito ajustados (21 graves + 1 heartbeat para 7 LU abaixo da voz; 15 sussurros +8 dB)`);

// --- emendas -------------------------------------------------------------------------------------------------------------
// 07 -> 08: Storyteller sai em fade (a narracao do 07 acaba em 68,0 s; o trecho em 70,5 s)
um('07', /Storyteller/).fadeOut = 2.4;

// 04 -> 05: Emergence desce em rampa atraves da emenda (a narracao do 04 acaba em 33,4 s; a do 05 comeca em 1,38 s)
{
  const e4 = um('04', /Emergence/);
  const base = e4.env.filter(([a]) => a < 33.85); // tira os pontos finais desta rodada ou de uma anterior
  const [ta, ga] = base[base.length - 1], [tb, gb] = [34.31, -24]; // rampa original: (9, -29) -> (34.31, -24)
  const em339 = Math.round((ga + (gb - ga) * (33.9 - ta) / (tb - ta)) * 100) / 100;
  if (base[base.length - 1][0] !== 9) throw new Error('trecho-04: envelope da Emergence diferente do esperado');
  e4.env = [...base, [33.9, em339], [35.4, -34]];
  const e5 = um('05', /Emergence/);
  e5.env = [[0, -34], [1.2, -42], [19.3, -42]];
  log.push(`04->05: Emergence ${em339} dB em 33,9 s -> -34 no corte -> -42 em 1,2 s do 05 (era -24 -> -42 seco)`);
}

// 01 -> 02: o vento do fim do 01 atravessa o corte e some quando o verso cantado entra (2,6 s + fade)
const VENTO = '@sfx/Ambiente SFX/Windy Desert.mp3';
{
  const v1 = um('01', /Windy Desert/, 22.6);          // from 40, len 9.8 -> acaba em 49.8 do arquivo, no fim do trecho
  v1.fadeOut = 0.001;                                  // sem o fade automatico de 0,25 s no corte
  so['02'].cues.push({ id: 'v5-vento-01-02', file: VENTO, at: 0, from: 49.8, len: 4.4, fadeIn: 0.001, fadeOut: 2.4, gain: v1.gain });
}

// 02 -> 03: o whoosh de transicao (28,8 s do 02) tem o pico 80 ms antes do corte e era cortado seco ali; a cauda segue no 03
{
  const w = um('02', /\/2\. Whoosh Swoosh\.wav$/, 28.8);
  const resto = Math.round((so['02'].dur - 28.8) * 1000) / 1000;       // 0,5 s tocam no 02
  so['03'].cues.push({ id: 'v5-whoosh-02-03', file: w.file, at: 0, from: resto, len: 0.38, fadeIn: 0.001, fadeOut: 0.12, gain: w.gain });
}

// --- cama de ambiente no buraco de 0:58 a 1:25 (clipe sai no fim do 02 e so volta em 21,5 s do 03) -------------------------
{
  const d2 = so['02'].dur;
  so['02'].cues.push({ id: 'v5-vento-buraco', file: VENTO, at: 26, from: 52, len: Math.round((d2 - 26) * 100) / 100, fadeIn: 2.5, fadeOut: 0.001, gain: -20 });
  so['03'].cues.push({ id: 'v5-vento-buraco', file: VENTO, at: 0, from: Math.round((52 + d2 - 26) * 100) / 100, len: 23.7, fadeIn: 0.001, fadeOut: 3, gain: -20 });
  // o vento antigo do 03 (18,2 s, 5,2 s, -26 dB: -55 dBFS, inaudivel) fica coberto pelo novo
  const antes = so['03'].cues.length;
  so['03'].cues = so['03'].cues.filter((c) => !(/Windy Desert/.test(c.file) && !c.id && Math.abs((c.at || 0) - 18.2) < 0.011));
  log.push(`buraco 0:58-1:25: vento a -20 dB (json) do 02 (26 s) ao 03 (23,7 s)${antes !== so['03'].cues.length ? '; vento antigo do 03 (18,2 s) removido' : ''}`);
}

// --- 09: A New Beginning abre audivel e assenta (o comeco da faixa e muito baixo) -------------------------------------------
um('09', /A New Beginning/).env = [[0, -17], [1.01, -17], [1.31, -20], [9, -21], [16, -26], [38.26, -26]];

// --- 10: 1 s de silencio total (13,45-14,45) depois de "so nao fique em silencio" ------------------------------------------
{
  const m = um('10', /A New Beginning/);
  const em = (x) => Math.round((-26 + 6 * x / 40.77) * 100) / 100;     // rampa original: -26 em 0 -> -20 em 40,77
  m.env = [[0, -26], [13.3, em(13.3)], [13.44, -80], [14.43, -80], [14.75, em(14.75)], [40.77, -20], [45.5, -20]];
}

for (const t of ORDEM) salva(t, so[t]);
for (const l of log) console.log(l);
console.log('07->08: fade de 2,4 s na Storyteller | 01->02: vento atravessa o corte | 02->03: cauda do whoosh no 03');
console.log('09: A New Beginning -17/-20 dB no comeco -> -26 aos 16 s | 10: silencio de 1 s em 13,45-14,45');
console.log('som v5 aplicado. Agora: bun kit/preparar.mjs em 01 02 03 04 05 06 07 08 09 10 e bun kit/finalizar.mjs --sem-render');
