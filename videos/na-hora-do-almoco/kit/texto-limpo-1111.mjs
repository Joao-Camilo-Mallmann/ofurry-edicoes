/**
 * Texto limpo (11/11): tira pontuacao dos textos de tela (pedido: "tirar virgula, ponto e tudo mais, bem clean").
 * So troca o texto; ids, tempos e animacoes ficam como estao. Idempotente: quem ja foi trocado e pulado.
 * Backup das composicoes em output/_backup-texto-limpo-1111/ (feito antes da primeira rodada).
 * Na folha da letra so os VERSOS (window.LETRA) mantem a pontuacao da musica. O cabecalho da folha ("Belchior 1974",
 * em kit/almoco.js) e a anotacao a mao do trecho 02 ("nao e so comida", em trecho-02/marcas.js) tambem foram limpos:
 * por isso 02, 04 e 08 (onde a anotacao aparece) precisam de --forcar, e 01 e 05 (onde nada disso aparece) de --marcar.
 * Nomes e arrobas ("J.C", "@J.C-12", "@Alves-d08") e hifens de palavra ("LATINO-AMERICANO") tambem ficam.
 * Depois: bun kit/preparar.mjs em todos os trechos (copia o kit e as marcas), bun kit/finalizar.mjs --marcar 01 05
 * e bun kit/finalizar.mjs --forcar 02 04 08 (03 06 61 07 09 10 entram sozinhos no render).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const BK = join(OUT, '_backup-texto-limpo-1111');

// arquivos fora de compositions/: [caminho a partir da pasta do video, de, para]
const FORA = [
  ['kit/almoco.js', "(o.sub || 'Belchior · 1974')", "(o.sub || 'Belchior 1974')"],
  ['output/trecho-02/marcas.js', "'não é só comida…'", "'não é só comida'"],
];
// [trecho, arquivo, de, para]
const TROCAS = [
  ['03', 'textos.html', '>SOBRAL · CEARÁ<', '>SOBRAL &nbsp;CEARÁ<'],
  ['06', 'textos.html', 'margin-right:0.2em">EI,</span>', 'margin-right:0.24em">EI</span>'],
  ['61', 'textos.html', '>COISA PARECIDA…<', '>COISA PARECIDA<'],
  ['07', 'textos.html', '>CLIPE · FANTÁSTICO<', '>CLIPE DO FANTÁSTICO<'],
  ['07', 'textos.html', '>VOCÊ SE IDENTIFICA?<', '>VOCÊ SE IDENTIFICA<'],
  ['07', 'textos.html', 'id="t7-aspas">“</div>', 'id="t7-aspas"></div>'],
  ['07', 'textos.html', '>SEGUNDO BELCHIOR, EM ENTREVISTAS<', '>SEGUNDO BELCHIOR EM ENTREVISTAS<'],
  ['09', 'midia.html', '<i>BELCHIOR · 1974</i>', '<i>BELCHIOR 1974</i>'],
  ['10', 'textos.html', '>COM ESSA MÚSICA…<', '>COM ESSA MÚSICA<'],
  ['10', 'textos.html', 'class="w">AMOR,</span> <span id="t10-a2" class="w">', 'class="w">AMOR</span> <span id="t10-a2" class="w" style="margin-left:0.12em">'],
  // "NAO MORRA. QUE ELE" + VIVA: sem o ponto a frase embola; vira duas linhas (a 2a emenda no VIVA grande)
  ['10', 'textos.html', '>NÃO MORRA. QUE ELE</div>', ' style="line-height:1.75">NÃO MORRA<br>QUE ELE</div>'],
  ['10', 'luzes.html', '>@J.C-12 · siga o editor<', '>@J.C-12<span style="margin-left:1.1em">siga o editor</span><'],
];

for (const t of new Set(TROCAS.map((x) => x[0]))) {
  const dir = join(OUT, `trecho-${t}`, 'hf', 'compositions');
  mkdirSync(join(BK, `trecho-${t}`), { recursive: true });
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
    const b = join(BK, `trecho-${t}`, f);
    if (!existsSync(b)) copyFileSync(join(dir, f), b);
  }
}

let feitas = 0, puladas = 0;
for (const [rel, de, para] of FORA) {
  const p = join(OUT, '..', rel);
  const b = join(BK, rel.replace(/[\/]/g, '__'));
  if (!existsSync(b)) copyFileSync(p, b);
  const src = readFileSync(p, 'utf8');
  if (!src.includes(de)) { if (!src.includes(para)) throw new Error(rel + ': nao achei o texto'); puladas++; continue; }
  writeFileSync(p, src.replace(de, para));
  console.log(rel + ': ' + de + '  ->  ' + para);
  feitas++;
}
for (const [t, arq, de, para] of TROCAS) {
  const p = join(OUT, `trecho-${t}`, 'hf', 'compositions', arq);
  const src = readFileSync(p, 'utf8');
  const n = src.split(de).length - 1;
  if (n === 0) {
    if (!src.includes(para)) throw new Error(`trecho-${t}/${arq}: nao achei nem "${de}" nem o texto novo`);
    puladas++; continue;
  }
  if (n > 1) throw new Error(`trecho-${t}/${arq}: "${de}" aparece ${n} vezes`);
  writeFileSync(p, src.replace(de, para));
  console.log(`trecho-${t}/${arq}: ${de}  ->  ${para}`);
  feitas++;
}
console.log(`texto limpo: ${feitas} trocas feitas, ${puladas} ja estavam feitas`);
