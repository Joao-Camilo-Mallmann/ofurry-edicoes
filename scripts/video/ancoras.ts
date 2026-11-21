/**
 * Ancoras por frase: o jeito de amarrar cenas a FALA, e nao a segundos fixos.
 *
 * Em qualquer campo de tempo do beats.json (at, until, from, eraseAt, strikeAt, items[].at, sfx[].at...)
 * pode ir uma string que comeca com "@" no lugar do numero. Ela e resolvida contra as palavras do trecho
 * (midia/narracao.json) na hora do build. Quando a narracao muda (regravacao), `video:sincronizar` recorta
 * os trechos e o proximo build ja cai no lugar certo, sem editar o beats.json.
 *
 *   "@64 reais"          inicio da primeira palavra da frase "64 reais"
 *   "@64 reais>"         FIM da ultima palavra da frase
 *   "@mil reais#2"       segunda ocorrencia da frase no trecho
 *   "@64 reais+0.3"      0,3 s depois do inicio (aceita -0.2 tambem)
 *   "@64 reais>-0.1"     combina tudo: fim da frase menos 0,1 s
 *   "@fim" / "@fim-0.5"  fim do trecho (duracao do audio)
 *   "@frase A|@frase B"  a primeira alternativa que existir (para frase que pode sair na regravacao)
 *
 * A comparacao ignora acento, caixa e pontuacao. A frase tem que bater 100%: se nao bater, o build para e
 * mostra o trecho mais parecido (quase sempre a regravacao trocou uma palavra; ajuste a ancora).
 */
import type { TimedWord } from '../../src/house/captions';
import { norm } from './lib';

// campos de texto e caminho de arquivo nunca sao ancoras ("@sfx/...", "@mus/...")
const TEXT_KEYS = new Set(['text', 'label', 'value', 'title', 'titulo', 'rotulo', 'file', 'pose', 'src', 'caption', 'texto']);
const RE = /^@(.+?)(?:#(\d+))?(>)?([+-]\d+(?:\.\d+)?)?$/;

export class AnchorError extends Error {}

export function resolveAnchor(spec: string, words: TimedWord[], duration: number): number {
  // alternativas: "@guarda esse número|@Então é agora" -> a primeira que existir (frase que pode sumir)
  if (spec.includes('|@')) {
    const alts = spec.split('|');
    for (let i = 0; i < alts.length; i++) {
      try {
        return resolveAnchor(alts[i], words, duration);
      } catch (e) {
        if (i === alts.length - 1) throw e;
      }
    }
  }
  const m = spec.trim().match(RE);
  if (!m) throw new AnchorError(`ancora invalida: ${spec}`);
  const [, phrase, nth, atEnd, off] = m;
  const offset = off ? Number(off) : 0;
  if (phrase.trim().toLowerCase() === 'fim') return round(duration + offset);
  if (phrase.trim().toLowerCase() === 'inicio') return round(Math.max(0, offset));
  const target = norm(phrase);
  const tokens = words.map((w) => norm(w.text).join(' '));
  // uma palavra transcrita pode virar 2 tokens ("0,56" -> "0 56"); compara pela sequencia achatada
  const flat: { tok: string; wi: number }[] = [];
  tokens.forEach((t, wi) => t.split(' ').filter(Boolean).forEach((tok) => flat.push({ tok, wi })));
  const want = Number(nth ?? 1);
  let seen = 0;
  for (let i = 0; i <= flat.length - target.length; i++) {
    let ok = true;
    for (let k = 0; k < target.length; k++) if (flat[i + k].tok !== target[k]) { ok = false; break; }
    if (!ok) continue;
    if (++seen < want) continue;
    const first = words[flat[i].wi];
    const last = words[flat[i + target.length - 1].wi];
    return round((atEnd ? last.end : first.start) + offset);
  }
  // nao achou: mostra a janela mais parecida para ajudar a corrigir
  let best = { i: -1, s: 0 };
  for (let i = 0; i <= flat.length - target.length; i++) {
    let s = 0;
    for (let k = 0; k < target.length; k++) if (flat[i + k].tok === target[k]) s++;
    if (s > best.s) best = { i, s };
  }
  const hint = best.i >= 0 ? words.slice(flat[best.i].wi, flat[best.i].wi + target.length + 2).map((w) => w.text).join(' ') : '(nada parecido)';
  throw new AnchorError(`ancora "${spec}" nao achada${seen ? ` (so ${seen} ocorrencia(s))` : ''}. Mais parecido: "${hint}"`);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Troca, recursivamente, toda string "@..." por segundos. Devolve a lista de ancoras que falharam. */
export function resolveAnchorsDeep<T>(value: T, words: TimedWord[], duration: number, errors: string[] = []): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string' && v.startsWith('@')) {
      try {
        return resolveAnchor(v, words, duration);
      } catch (e) {
        errors.push((e as Error).message);
        return 0;
      }
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) o[k] = TEXT_KEYS.has(k) ? x : walk(x);
      return o;
    }
    return v;
  };
  return walk(value) as T;
}

/**
 * Le um beats.json e devolve a folha com as ancoras resolvidas (e `duration` = duracao do audio do trecho quando
 * omitida ou "@fim"). Usado pelo hf:build, pelo house:lint e pelo video:montar.
 */
export function loadResolvedSheet(beatsPath: string): { sheet: any; errors: string[]; words: TimedWord[] } {
  // imports locais para nao pesar em quem so usa resolveAnchor
  const { existsSync, readFileSync } = require('node:fs') as typeof import('node:fs');
  const { dirname, join } = require('node:path') as typeof import('node:path');
  const { spawnSync } = require('node:child_process') as typeof import('node:child_process');
  const { parseWords } = require('../../src/house/captions') as typeof import('../../src/house/captions');
  const baseDir = dirname(beatsPath);
  const raw = JSON.parse(readFileSync(beatsPath, 'utf8'));
  const wp = join(baseDir, 'midia', 'narracao.json');
  const words = existsSync(wp) ? parseWords(readFileSync(wp, 'utf8')) : [];
  if (raw.duration === undefined || typeof raw.duration === 'string') {
    const a = raw.audio ? join(baseDir, raw.audio) : '';
    if (a && existsSync(a)) {
      const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a]);
      raw.duration = Math.round(Number(String(r.stdout).trim()) * 1000) / 1000;
    } else raw.duration = words.length ? words[words.length - 1].end + 0.3 : 0;
  }
  const errors: string[] = [];
  // Itens com "opcional": true (batidas, sfx, fundos, janelas de legenda) somem se a ancora nao existir mais
  // (ex.: frase cortada na regravacao) em vez de travar o build.
  const dropped: string[] = [];
  for (const key of ['beats', 'sfx', 'backdrops', 'captions']) {
    if (!Array.isArray(raw[key])) continue;
    raw[key] = raw[key].filter((item: any) => {
      if (!item?.opcional) return true;
      const errs: string[] = [];
      resolveAnchorsDeep(item, words, raw.duration, errs);
      if (errs.length) dropped.push(`${key}: ${item.kind ?? item.file ?? item.backdrop ?? ''} (${errs[0]})`);
      return !errs.length;
    });
  }
  if (dropped.length) console.warn(`  ${dropped.length} item(ns) opcional(is) removido(s), a frase nao existe mais:\n    ${dropped.join('\n    ')}`);
  const sheet = resolveAnchorsDeep(raw, words, raw.duration, errors);
  // "cauda": segundos de tela final DEPOIS da narracao (assinatura + cards do YouTube); use "@fim+N" nas batidas
  if (typeof sheet.cauda === 'number' && sheet.cauda > 0) sheet.duration = Math.round((sheet.duration + sheet.cauda) * 1000) / 1000;
  for (const b of sheet.beats ?? []) b.until = Math.min(b.until, sheet.duration);
  return { sheet, errors, words };
}
