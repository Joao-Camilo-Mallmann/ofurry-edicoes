/**
 * Pedido de 07/11: impacto "no maximo uma ou duas vezes, em cenas muito especificas, bem baixinho".
 * Deixa so 2 Impacts/ no video todo, a -18 dB, e tira os outros. Idempotente (pode rodar de novo).
 * Backup dos sons.json em output/_backup-impactos-2/ (feito na primeira vez).
 *   bun kit/impactos-2.mjs            aplica
 *   bun kit/impactos-2.mjs --plano    so mostra
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUT = resolve(import.meta.dir, '..', 'output');
const BK = join(OUT, '_backup-impactos-2');
const plano = process.argv.includes('--plano');
// os dois que ficam: trecho, arquivo, inicio (s) -> ganho
const FICAM = [
  { t: '01', file: '@sfx/Impacts/Impact (2).wav', at: 10.337, gain: -18 }, // "...apenas um rapaz latino-americano" -> virada para 1970
  { t: '06', file: '@sfx/Impacts/Impact (2).wav', at: 15.577, gain: -18 }, // "Se nao chega a MORTE ou coisa parecida"
];
const ORDEM = ['01', '02', '03', '04', '05', '06', '61', '07', '08', '09', '10'];
const mudou = [];
for (const t of ORDEM) {
  const f = join(OUT, `trecho-${t}`, 'sons.json');
  const s = JSON.parse(readFileSync(f, 'utf8'));
  const antes = s.cues.length;
  const fica = (c) => FICAM.find((k) => k.t === t && k.file === c.file && Math.abs(k.at - c.at) < 0.01);
  let ganho = false;
  s.cues = s.cues.filter((c) => !/\/Impacts\//.test(c.file) || fica(c));
  for (const c of s.cues) { const k = fica(c); if (k && c.gain !== k.gain) { c.gain = k.gain; ganho = true; } }
  const tirou = antes - s.cues.length;
  if (!tirou && !ganho) continue;
  mudou.push(t);
  console.log(`trecho ${t}: -${tirou} impacto(s)${ganho ? ', ganho ajustado' : ''}`);
  if (plano) continue;
  mkdirSync(join(BK, `trecho-${t}`), { recursive: true });
  const bk = join(BK, `trecho-${t}`, 'sons.json');
  if (!existsSync(bk)) copyFileSync(f, bk);
  writeFileSync(f, JSON.stringify(s, null, 1) + '\n');
}
console.log(mudou.length ? `mudaram: ${mudou.join(' ')}` : 'nada a mudar');
