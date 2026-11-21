/**
 * Re-sincroniza um video inteiro com a narracao (atual ou nova), sem mexer em plano.md nem beats.json.
 *
 * Uso:
 *   bun run video:sincronizar <id>                         recorta os trechos pela narracao atual
 *   bun run video:sincronizar <id> --audio nova.wav        troca a narracao, transcreve e recorta
 *   bun run video:sincronizar <id> --sem-transcrever       so reaplica revisao.json e recorta
 *
 * Como funciona:
 *   1. (com --audio) copia a narracao nova para midia/narracao.wav e roda video:transcrever.
 *   2. Guarda a transcricao crua em midia/transcricao.bruta.json e aplica midia/revisao.json (correcoes de
 *      TEXTO: nomes, numeros; os tempos nunca mudam). Correcao que nao bate mais (frase regravada) e ignorada.
 *   3. Cada trecho do video.json tem `de`: a frase que abre o trecho. O inicio vira o meio do silencio antes
 *      dessa frase; o fim e o inicio do trecho seguinte (o ultimo vai ate o fim do audio).
 *   4. Recorta audio + palavras de cada trecho (midia/narracao.wav|json|vtt) e imprime o que mudou.
 * As cenas usam ancoras "@frase" (scripts/video/ancoras.ts), entao o proximo `hf:build` ja cai no lugar.
 * Depois: `bun run video:produzir <id>` (build + render so do que mudou + montagem).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { findPhrase, fmt, loadWords, norm, readManifest, toVtt, trechoDir, videoDir, writeManifest } from './lib';
import type { TimedWord } from '../../src/house/captions';

const args = process.argv.slice(2);
const id = args[0];
const opt = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!id) {
  console.error('Uso: bun run video:sincronizar <id> [--audio nova.wav] [--sem-transcrever]');
  process.exit(1);
}
const dir = videoDir(id);
const m = readManifest(id);
const midia = join(dir, 'midia');
const narr = join(dir, m.narracao ?? 'midia/narracao.wav');

// 1. narracao nova
const audio = opt('--audio');
if (audio) {
  const src = resolve(audio);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  mkdirSync(join(midia, 'versoes-antigas'), { recursive: true });
  if (existsSync(narr)) copyFileSync(narr, join(midia, 'versoes-antigas', `narracao-${stamp}.wav`));
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s24le', narr], { stdio: 'inherit' });
  console.log(`Narracao nova copiada (a anterior foi para midia/versoes-antigas/narracao-${stamp}.wav)`);
}
// texto revisado da narracao anterior: herdado onde a fala nao mudou (ver herdaTexto)
const anteriorPath = join(midia, 'transcricao.anterior.json');
if (audio && existsSync(join(midia, 'transcricao.json'))) copyFileSync(join(midia, 'transcricao.json'), anteriorPath);
if ((audio || !existsSync(join(midia, 'transcricao.bruta.json'))) && !args.includes('--sem-transcrever')) {
  if (audio || !m.transcricao) {
    const r = spawnSync('bun', ['run', join(import.meta.dir, 'transcrever.ts'), id], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(1);
  }
  copyFileSync(join(midia, 'transcricao.json'), join(midia, 'transcricao.bruta.json'));
}

// 2. revisao de texto
const raw: (TimedWord & { id?: string })[] = JSON.parse(readFileSync(join(midia, 'transcricao.bruta.json'), 'utf8'));
let words = raw.map((w) => ({ ...w }));
let herdou = false; // com texto herdado, a maioria das revisoes ja esta aplicada: nao listar as "sem efeito"
if (audio && existsSync(anteriorPath)) {
  const antes: TimedWord[] = JSON.parse(readFileSync(anteriorPath, 'utf8'));
  const h = herdaTexto(antes, words);
  words = h.words;
  herdou = true;
  console.log(`Alinhamento com a narracao anterior: ${h.herdadas} palavras mantem o texto revisado, ${h.novas} vem da transcricao nova (trechos regravados)`);
}
const revPath = join(midia, 'revisao.json');
const revisoes: { de: string; para: string; nota?: string }[] = existsSync(revPath) ? JSON.parse(readFileSync(revPath, 'utf8')) : [];
let aplicadas = 0;
for (const r of revisoes) {
  const de = norm(r.de);
  const para = r.para.split(/\s+/);
  let hit = 0;
  for (let i = 0; i + de.length <= words.length; i++) {
    let ok = true;
    for (let k = 0; k < de.length; k++) if (norm(words[i + k].text).join(' ') !== de[k]) { ok = false; break; }
    if (!ok) continue;
    // mantem pontuacao final da ultima palavra
    const tail = (words[i + de.length - 1].text.match(/[.,!?;:]+$/) ?? [''])[0];
    const span = words.slice(i, i + de.length);
    const t0 = span[0].start;
    const t1 = span[span.length - 1].end;
    const novas = para.map((p, k) => ({ text: k === para.length - 1 ? p.replace(/[.,!?;:]+$/, '') + tail : p, start: +(t0 + ((t1 - t0) * k) / para.length).toFixed(3), end: +(t0 + ((t1 - t0) * (k + 1)) / para.length).toFixed(3) }));
    words.splice(i, de.length, ...novas);
    hit++;
    i += novas.length - 1;
  }
  if (hit) aplicadas += hit;
  else if (!herdou) console.log(`  revisao sem efeito (frase nao existe mais): "${r.de}"`);
}
writeFileSync(join(midia, 'transcricao.json'), JSON.stringify(words.map((w, i) => ({ id: `w${i}`, text: w.text, start: w.start, end: w.end })), null, 1) + '\n');
writeFileSync(join(midia, 'transcricao.vtt'), toVtt(words));
console.log(`Revisao: ${aplicadas} troca(s) de texto aplicada(s) de ${revisoes.length}`);

// 3. limites dos trechos
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', narr]);
const total = Number(String(probe.stdout).trim()) || words[words.length - 1].end + 0.5;
const trechos = [...m.trechos].sort((a, b) => a.inicio - b.inicio);
let from = 0;
const starts: number[] = [];
for (const t of trechos) {
  const de = (t as { de?: string }).de;
  if (!de) {
    console.error(`${t.id} sem "de" (frase de abertura) no video.json`);
    process.exit(1);
  }
  const f = findPhrase(words, de, from);
  if (!f || f.score < 0.8) {
    console.error(`${t.id}: nao achei a frase de abertura "${de}" (melhor ${(f?.score ?? 0) * 100}%: "${f ? words.slice(f.index, f.index + 8).map((w) => w.text).join(' ') : ''}")`);
    process.exit(1);
  }
  const w = words[f.index];
  const prevEnd = f.index > 0 ? words[f.index - 1].end : 0;
  starts.push(f.index === 0 ? 0 : +Math.max(prevEnd, Math.min(w.start - 0.05, (prevEnd + w.start) / 2)).toFixed(3));
  from = f.index + 1;
}
console.log('');
console.log('Trecho      inicio     fim        dur    (antes)');
trechos.forEach((t, i) => {
  const inicio = starts[i];
  const fim = i < trechos.length - 1 ? starts[i + 1] : +total.toFixed(3);
  const antes = `${(t.fim - t.inicio).toFixed(2)}`;
  const mudou = Math.abs(t.inicio - inicio) > 0.02 || Math.abs(t.fim - fim) > 0.02;
  t.inicio = inicio;
  t.fim = fim;
  // 4. recorte
  const td = trechoDir(id, t.id.replace('trecho-', ''));
  mkdirSync(join(td, 'midia'), { recursive: true });
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(inicio), '-to', String(fim), '-i', narr, '-ac', '2', '-ar', '48000', join(td, 'midia', 'narracao.wav')]);
  const tw = words
    .filter((x) => (x.start + x.end) / 2 >= inicio && (x.start + x.end) / 2 < fim)
    .map((x, k) => ({ id: `w${k}`, text: x.text, start: Math.max(0, +(x.start - inicio).toFixed(3)), end: +(Math.min(fim, x.end) - inicio).toFixed(3) }));
  writeFileSync(join(td, 'midia', 'narracao.json'), JSON.stringify(tw, null, 1) + '\n');
  writeFileSync(join(td, 'midia', 'narracao.vtt'), toVtt(tw));
  console.log(`${t.id}  ${fmt(inicio)}  ${fmt(fim)}  ${(fim - inicio).toFixed(2).padStart(6)}  (${antes})${mudou ? '  <- mudou' : ''}`);
});
m.trechos = trechos;
writeManifest(m);
console.log(`\n${trechos.length} trechos recortados. Proximo: bun run video:produzir ${id}`);

/**
 * Re-transcrever a narracao inteira cria erros novos onde nada mudou (teste de 20/11/2026: "500" virou "50").
 * Entao alinha a transcricao nova com a anterior (ja revisada) por LCS de palavras normalizadas:
 *  - palavra igual nas duas: texto antigo (revisado), tempo novo;
 *  - troca curta de mesmo tamanho (1-3 palavras): ruido de transcricao -> texto antigo, tempo novo;
 *  - o resto (frase regravada com outras palavras): texto novo.
 */
function herdaTexto(antes: TimedWord[], novas: TimedWord[]) {
  const A = antes.map((w) => norm(w.text).join(' '));
  const B = novas.map((w) => norm(w.text).join(' '));
  const n = A.length, mm = B.length;
  const dp = new Int32Array((n + 1) * (mm + 1));
  const at = (i: number, j: number) => i * (mm + 1) + j;
  for (let i = n - 1; i >= 0; i--)
    for (let j = mm - 1; j >= 0; j--)
      dp[at(i, j)] = A[i] === B[j] ? dp[at(i + 1, j + 1)] + 1 : Math.max(dp[at(i + 1, j)], dp[at(i, j + 1)]);
  const pares: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < mm; ) {
    if (A[i] === B[j]) { pares.push([i, j]); i++; j++; }
    else if (dp[at(i + 1, j)] >= dp[at(i, j + 1)]) i++;
    else j++;
  }
  const out = novas.map((w) => ({ ...w }));
  let herdadas = 0;
  const herda = (i: number, j: number) => { out[j].text = antes[i].text; herdadas++; };
  let pi = -1, pj = -1;
  for (const [i, j] of [...pares, [n, mm] as [number, number]]) {
    const gi = i - pi - 1, gj = j - pj - 1;
    if (gi > 0 && gi === gj && gi <= 3) for (let k = 1; k <= gi; k++) herda(pi + k, pj + k);
    if (i < n) herda(i, j);
    pi = i; pj = j;
  }
  return { words: out, herdadas, novas: mm - herdadas };
}
