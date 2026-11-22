/**
 * Som v7 (13/11): cama instrumental continua de 0:00 a 1:50 (trechos 01 a 03), pedido do usuario em 12/11:
 * "deixa so o beat batendo de fundo e o roteiro falando, sem a voz do cara; quando precisar, transicao pra musica com a voz".
 *
 * O instrumental e o karaoke que ele mandou (03-clipe-belchior/karaoke/na-hora-do-almoco-karaoke-runy.m4a, canal Runy
 * Karaoke & Lyrics). Medicao: e a MESMA gravacao do Belchior sem a voz, entao troca com a versao cantada em sincronia:
 *   tempo no karaoke = tempo no clipe + 4,4734 + 0,001474 x tempo no clipe   (ataques de 3 bandas, erro de 1 a 3 ms)
 * Por ser a mesma gravacao, o Content ID da gravadora tende a pegar o instrumental tambem (o usuario foi avisado e aprovou).
 *
 *   01  0:00-0:32  introducao do clipe (nao tem voz) ate o fim do trecho, com fade de 2 s (parava em 0:30)
 *   02  0:32-0:54  versos "No centro da sala" e "A gente se olha" CANTADOS, junto com a citacao (igual ao som v6)
 *       0:52-1:01  troca para o karaoke em 1,5 s, antes do "medo, medo"
 *   03  1:01-1:50  karaoke continuo e baixo (-28 dB; -25 dB enquanto o narrador fala de rabeca e violino), fade de 3 s no fim.
 *       O pedaco cantado de 15 s que tocava em 1:23-1:38 saiu: o audio CANTADO do clipe diminuiu.
 *   O vento posto no buraco pelo som v5 (0:54-1:25) sai, porque a musica agora e continua.
 * Idempotente (valores absolutos; a cue nova leva "id": "v7-karaoke"). Backup em output/_backup-som-v7/.
 * Ordem: som-v4-copyright.mjs -> som-v5-auditoria.mjs -> som-v6-foco-na-narracao.mjs -> este.
 * Depois: bun kit/preparar.mjs 01 02 03 e bun kit/finalizar.mjs --sem-render
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const arq = (t) => join(OUT, `trecho-${t}`, 'sons.json');
const abre = (t) => JSON.parse(readFileSync(arq(t), 'utf8'));
const salva = (t, s) => writeFileSync(arq(t), JSON.stringify(s, null, 1));
const r3 = (x) => Math.round(x * 1000) / 1000;
const um = (s, t, re) => { const r = s.cues.filter((c) => re.test(c.file)); if (r.length !== 1) throw new Error(`trecho-${t}: esperava 1 cue ${re}, achei ${r.length}`); return r[0]; };
const BK = join(OUT, '_backup-som-v7');
mkdirSync(BK, { recursive: true });
for (const t of ['01', '02', '03']) if (!existsSync(join(BK, `sons-${t}.json`))) copyFileSync(arq(t), join(BK, `sons-${t}.json`));

const CLIPE = /clipe-so-audio\.wav$/;
const KARAOKE = '@clipe/karaoke/na-hora-do-almoco-karaoke-runy.m4a';
const noKaraoke = (tClipe) => tClipe + 4.4734 + 0.001474 * tClipe;
const limpa = (s) => { s.cues = s.cues.filter((c) => !/^v7-|^v5-vento-buraco$/.test(c.id || '')); };

// 01: a introducao segue ate o fim do trecho
const s1 = abre('01');
Object.assign(um(s1, '01', CLIPE), { at: 0, from: 0, len: s1.dur, fadeIn: 0.05, fadeOut: 2.0, env: [[0, -6], [2.9, -5], [3.3, -21], [s1.dur, -21]] });
salva('01', s1);

// 02: versos cantados (clipe = trecho + 36,8, como no v6) e troca para o karaoke antes do "medo, medo" (clipe 58,4 s)
const s2 = abre('02');
limpa(s2);
const TROCA = 20.0, FADE = 1.5, OFF = 36.8;             // troca em 20,0-21,5 s do trecho = clipe 56,8-58,3 s
Object.assign(um(s2, '02', CLIPE), { at: 0, from: OFF, len: TROCA + FADE, fadeIn: 1.5, fadeOut: FADE, env: [[0, -24], [10.6, -24], [11.4, -28], [TROCA + FADE, -28]] });
const k2 = { id: 'v7-karaoke', file: KARAOKE, at: TROCA, from: r3(noKaraoke(OFF + TROCA)), len: r3(s2.dur - TROCA), fadeIn: FADE, fadeOut: 0, env: [[TROCA, -28], [s2.dur, -28]] };
s2.cues.push(k2);
salva('02', s2);

// 03: karaoke continua de onde o 02 parou; um pouco mais presente enquanto o narrador fala dos instrumentos (18,2-36,5 s)
const s3 = abre('03');
limpa(s3);
s3.cues = s3.cues.filter((c) => !CLIPE.test(c.file));   // o pedaco cantado de 15 s (21,5-36,5 s) sai
s3.cues.push({ id: 'v7-karaoke', file: KARAOKE, at: 0, from: r3(k2.from + k2.len), len: s3.dur, fadeIn: 0, fadeOut: 3, env: [[0, -28], [17.6, -28], [18.4, -25], [36.5, -25], [37.5, -28], [s3.dur, -28]] });
salva('03', s3);

console.log(`trecho-01: introducao do clipe ate ${s1.dur} s (fade de 2 s)`);
console.log(`trecho-02: clipe cantado 0-${TROCA + FADE} s; karaoke a partir de ${TROCA} s (arquivo ${k2.from} s), troca de ${FADE} s`);
console.log(`trecho-03: karaoke continuo (arquivo ${r3(k2.from + k2.len)} s em diante), -28 dB e -25 dB na parte dos instrumentos; pedaco cantado e vento do buraco removidos`);
console.log('som v7 aplicado. Agora: bun kit/preparar.mjs 01 02 03 e bun kit/finalizar.mjs --sem-render');
