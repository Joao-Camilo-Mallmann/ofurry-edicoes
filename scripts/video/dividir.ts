/**
 * Divide a narracao em partes (trechos) de forma inteligente e propoe o video.json.
 *
 * Uso:
 *   bun run video:dividir <id>                      mostra a proposta (nao grava nada)
 *   bun run video:dividir <id> --aplicar            grava os trechos no video.json (so se nenhum beats.json tem cena)
 *   bun run video:dividir <id> --min 20 --alvo 40 --max 55
 *
 * Regras (padrao de edicao, secao 8):
 *   1. Cada SECAO do roteiro.md ("## [NOME]") e no minimo uma parte: parte nunca mistura duas ideias do roteiro.
 *      A secao e achada na transcricao pela primeira frase dela.
 *   2. Secao maior que --max (55 s) e cortada em fim de frase, na PAUSA MAIS LONGA entre --min e --max segundos
 *      desde o ultimo corte (preferindo perto do --alvo). Nenhuma parte fica com menos de --min.
 *   3. Secao curta demais (< 12 s) se junta a seguinte.
 *   4. Cada parte comeca numa frase (`de`): e por ela que o video:sincronizar recorta quando a narracao muda.
 * Por que partes: cada uma renderiza sozinha (~1 min na placa) e o final so junta; mexer numa parte e
 * `bun run video:produzir <id> --trechos XX`.
 * Depois de aplicar: bun run video:sincronizar <id>
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findPhrase, fmt, loadWords, readManifest, trechoDir, videoDir, writeManifest } from './lib';
import type { TimedWord } from '../../src/house/captions';

const args = process.argv.slice(2);
const id = args[0];
const num = (k: string, d: number) => {
  const i = args.indexOf(k);
  return i >= 0 ? Number(args[i + 1]) : d;
};
if (!id) {
  console.error('Uso: bun run video:dividir <id> [--aplicar] [--min 20] [--alvo 40] [--max 55]');
  process.exit(1);
}
const MIN = num('--min', 20), ALVO = num('--alvo', 40), MAX = num('--max', 55), CURTA = 12;
const m = readManifest(id);
const dir = videoDir(id);
if (!m.transcricao) {
  console.error(`Sem transcricao. Rode: bun run video:transcrever ${id}`);
  process.exit(1);
}
const words: TimedWord[] = loadWords(join(dir, m.transcricao));
const total = words[words.length - 1].end + 0.3;

// 1. secoes do roteiro
const roteiro = readFileSync(join(dir, 'roteiro.md'), 'utf8');
const secoes: { nome: string; texto: string }[] = [];
for (const bloco of roteiro.split(/^##\s+/m).slice(1)) {
  const [cab, ...resto] = bloco.split('\n');
  const nome = cab.replace(/\(.*?\)\s*$/, '').replace(/[[\]]/g, '').trim();
  const texto = resto.join(' ').replace(/[*_>#`]/g, ' ').replace(/\s+/g, ' ').trim();
  if (texto) secoes.push({ nome, texto });
}
if (!secoes.length) {
  console.error('roteiro.md sem secoes "## NOME". Uma secao por bloco do roteiro.');
  process.exit(1);
}
let from = 0;
const ini: { nome: string; i: number }[] = [];
for (const s of secoes) {
  // a fala nunca e identica ao roteiro: tenta janelas de 6 palavras deslocadas no inicio da secao e fica com a melhor
  const ws = s.texto.split(/\s+/);
  const frase = ws.slice(0, 7).join(' ');
  let f: { index: number; score: number } | null = null;
  for (let o = 0; o <= Math.min(8, Math.max(0, ws.length - 6)); o += 2) {
    const g = findPhrase(words, ws.slice(o, o + 6).join(' '), from);
    if (!g) continue;
    // volta o deslocamento: a secao comeca ~o palavras antes do trecho achado
    const cand = { index: Math.max(from, g.index - o), score: g.score };
    if (!f || cand.score > f.score) f = cand;
    if (g.score === 1) break;
  }
  if (!f || f.score < 0.6) {
    console.warn(`  aviso: secao "${s.nome}" nao achada na fala ("${frase}..."); fica junto da anterior`);
    continue;
  }
  // encaixa no comeco da frase: anda ate 3 palavras para frente ate a palavra anterior terminar em . ! ?
  let i0 = f.index;
  for (let k = 0; k < 3 && i0 > 0 && !/[.!?…]$/.test(words[i0 - 1].text); k++) {
    if (/[.!?…]$/.test(words[i0].text)) { i0++; break; }
    i0++;
  }
  if (i0 > 0 && !/[.!?…]$/.test(words[i0 - 1].text)) i0 = f.index;
  ini.push({ nome: s.nome, i: i0 });
  from = f.index + 1;
}
if (!ini.length || ini[0].i !== 0) ini.unshift({ nome: ini.length ? 'ABERTURA' : secoes[0].nome, i: 0 });

// secao abaixo do minimo se junta a SEGUINTE quando as duas cabem numa parte (ex.: CTA + gancho final)
const durSec = (k: number) => (k < ini.length - 1 ? words[ini[k + 1].i].start : total) - words[ini[k].i].start;
const juntaComProxima = new Set<number>();
for (let k = 0; k < ini.length - 1; k++) if (durSec(k) >= CURTA && durSec(k) < MIN && durSec(k) + durSec(k + 1) <= MAX && !juntaComProxima.has(k - 1)) juntaComProxima.add(k);

// 2. cortes dentro das secoes longas
const fimFrase = (k: number) => k > 0 && /[.!?…]$/.test(words[k - 1].text);
const pausa = (k: number) => words[k].start - words[k - 1].end;
type Parte = { i: number; bloco: string; n: number };
const partes: Parte[] = [];
for (let s = 0; s < ini.length; s++) {
  const a = ini[s].i;
  const fimSec = juntaComProxima.has(s) ? s + 2 : s + 1;
  const b = fimSec < ini.length ? ini[fimSec].i : words.length;
  const tA = words[a].start, tB = b < words.length ? words[b].start : total;
  if (tB - tA < CURTA && partes.length) continue; // secao curtinha: junta na parte anterior
  if (juntaComProxima.has(s - 1)) continue; // a anterior era curta e engoliu esta
  partes.push({ i: a, bloco: ini[s].nome, n: 1 });
  let cur = a, n = 1;
  while (true) {
    const tCur = words[cur].start;
    if (tB - tCur <= MAX) break;
    let best = -1, bestScore = -Infinity;
    for (let k = cur + 1; k < b; k++) {
      const t = words[k].start - tCur;
      if (t < MIN) continue;
      if (t > MAX) break;
      if (tB - words[k].start < MIN) break;
      if (!fimFrase(k)) continue;
      const score = pausa(k) * 10 - Math.abs(t - ALVO) / 10;
      if (score > bestScore) { bestScore = score; best = k; }
    }
    if (best < 0) break; // sem fim de frase no intervalo: parte fica maior, avisa
    partes.push({ i: best, bloco: ini[s].nome, n: ++n });
    cur = best;
  }
}

// 3. proposta
const trechos = partes.map((p, k) => {
  const t0 = k === 0 ? 0 : words[p.i].start;
  const t1 = k < partes.length - 1 ? words[partes[k + 1].i].start : total;
  const nPartes = partes.filter((x) => x.bloco === p.bloco).length;
  const nome = p.bloco.charAt(0) + p.bloco.slice(1).toLowerCase();
  return {
    id: `trecho-${String(k + 1).padStart(2, '0')}`,
    titulo: nPartes > 1 ? `${nome} (${p.n}/${nPartes})` : nome,
    inicio: +t0.toFixed(3),
    fim: +t1.toFixed(3),
    bloco: p.bloco,
    de: words.slice(p.i, p.i + 6).map((w) => w.text).join(' '),
  };
});
console.log(`\n${trechos.length} partes (min ${MIN} s, alvo ${ALVO} s, max ${MAX} s):\n`);
for (const t of trechos) {
  const d = t.fim - t.inicio;
  const aviso = d > MAX + 0.5 ? '  <- longa (sem fim de frase para cortar)' : d < MIN - 0.5 ? '  <- curta' : '';
  console.log(`${t.id}  ${fmt(t.inicio)}  ${d.toFixed(1).padStart(5)} s  ${t.bloco.padEnd(24)} "${t.de}..."${aviso}`);
}

if (args.includes('--aplicar')) {
  const comCena = m.trechos.filter((t) => {
    const p = join(trechoDir(id, t.id.replace('trecho-', '')), 'beats.json');
    return existsSync(p) && (JSON.parse(readFileSync(p, 'utf8')).beats ?? []).length > 0;
  });
  if (comCena.length && !args.includes('--forcar')) {
    console.error(`\nNao apliquei: ${comCena.length} parte(s) ja tem cenas (${comCena.map((t) => t.id).join(', ')}). Renumerar quebraria os beats.json.`);
    console.error('Para um video ja editado, divida uma parte a mao: copie o beats.json e ajuste o "de" no video.json.');
    process.exit(1);
  }
  m.trechos = trechos;
  writeManifest(m);
  console.log(`\nvideo.json atualizado. Proximo: bun run video:sincronizar ${id}`);
} else console.log(`\nSo proposta. Para gravar: bun run video:dividir ${id} --aplicar`);
