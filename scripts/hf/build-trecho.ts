/**
 * Gera um projeto HyperFrames (HTML + GSAP) a partir do beats.json de um trecho, no estilo da casa.
 *
 * Uso:
 *   bun run hf:build <video> <trecho>          -> videos/<video>/output/trecho-<XX>/beats.json
 *   bun run hf:build <caminho/beats.json>
 *
 * Saida: <pasta-do-trecho>/hf/  (index.html, compositions/*.html, assets/)
 * Depois: bun run hf:render <video> <trecho>   (check + MP4 pronto; --alpha para gerar tambem o MOV transparente)
 *
 * O HTML gerado e um primeiro corte editavel: ajuste a mao no app do HyperFrames ou nos arquivos,
 * seguindo a skill ofurry-fazer-cenas. Rodar o build de novo SOBRESCREVE compositions/.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Backdrop, Beat, BeatSheet, CaptionWindow } from '../../src/house/beats';
import { CaptionCard, cardsFromSubtitle } from '../../src/house/captions';
import { House, HouseTone, toneColor, toneFromValue } from '../../src/house/theme';
import { lintBeatSheet } from '../../src/house/lint';
import { iconSvg } from './lucide-svg';
import { loadResolvedSheet } from '../video/ancoras';

const ROOT = resolve(import.meta.dir, '..', '..');
const KIT = join(ROOT, 'hf', 'kit');
const W = 1920;
const H = 1080;
const FPS = 30;
const HF_VERSION = '0.8.193';
const ASSETS_PC = process.env.OFURRY_ASSETS ?? 'D:/YT/!Assets';
// hash deterministico por trecho (variar escolhas sem aleatorio)
const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
function resolveBeatsPath(args: string[]): string {
  if (args[0]?.endsWith('.json')) return resolve(args[0]);
  const [video, trecho] = args;
  if (!video || !trecho) {
    console.error('Uso: bun run hf:build <video> <trecho>  |  bun run hf:build <beats.json>');
    process.exit(1);
  }
  return join(ROOT, 'videos', video, 'output', `trecho-${trecho.padStart(2, '0')}`, 'beats.json');
}

const beatsPath = resolveBeatsPath(process.argv.slice(2));
if (!existsSync(beatsPath)) {
  console.error(`Nao achei ${beatsPath}`);
  process.exit(1);
}
const baseDir = dirname(beatsPath);
// Ancoras "@frase" (scripts/video/ancoras.ts): resolvidas contra as palavras do trecho antes de tudo.
const loaded = loadResolvedSheet(beatsPath);
if (loaded.errors.length) {
  console.error(`${loaded.errors.length} ancora(s) com problema em ${beatsPath}:`);
  for (const e of loaded.errors) console.error('  ' + e);
  process.exit(1);
}
const sheet = loaded.sheet as BeatSheet;
const OUT = join(baseDir, 'hf');
const COMP = join(OUT, 'compositions');
const ASSETS = join(OUT, 'assets');

const subtitle = sheet.subtitle ?? (sheet.subtitlePath ? readFileSync(join(baseDir, sheet.subtitlePath), 'utf8') : '');
const cards: CaptionCard[] = subtitle ? cardsFromSubtitle(subtitle, sheet.cardOptions).filter((c) => c.start < sheet.duration) : [];

// Emenda sem vazio (20/11/2026): o trecho e cortado no meio do silencio antes da 1a palavra, entao a 1a batida ou o
// 1o cartao de legenda comecam 0,1-0,6 s depois do quadro 0 e a emenda com o trecho anterior "pisca" so o fundo.
// O que aparece primeiro e puxado para o quadro 0 quando comeca em ate 0,8 s.
{
  const LIM = 0.8;
  const firstBeat = sheet.beats.length ? Math.min(...sheet.beats.map((b) => b.at)) : Infinity;
  const wins = sheet.captions ?? [{ from: 0, until: sheet.duration }];
  const inWin = (c: CaptionCard) => wins.find((x) => c.start >= x.from - 0.15 && c.start < x.until - 0.1);
  const firstCard = cards.find((c) => inWin(c));
  const cardStart = firstCard ? firstCard.start : Infinity;
  if (firstBeat > 0 && firstBeat <= LIM && firstBeat <= cardStart) {
    for (const b of sheet.beats) if (b.at === firstBeat) b.at = 0;
  } else if (firstCard && cardStart > 0 && cardStart <= LIM && cardStart < firstBeat) {
    const w = inWin(firstCard);
    if (w && w.from > 0) w.from = 0;
    firstCard.start = 0;
  }
}

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const js = (v: unknown) => JSON.stringify(v);
const copied = new Map<string, string>();

/** Copia um arquivo referenciado pela folha para assets/media e devolve o caminho root-relative. */
function asset(rel: string | undefined, opts: { blur?: number } = {}): string | undefined {
  if (!rel) return undefined;
  // "@assets/..." aponta para a despensa do PC (D:/YT/!Assets): overlays, fundos, B-roll organizado
  const src = rel.startsWith('@assets/') ? join(ASSETS_PC, rel.slice('@assets/'.length)) : join(baseDir, rel);
  const key = `${src}|${opts.blur ?? 0}`;
  if (copied.has(key)) return copied.get(key);
  if (!existsSync(src)) {
    console.warn(`  aviso: arquivo nao encontrado, usando marcador: ${rel}`);
    copied.set(key, '');
    return undefined;
  }
  mkdirSync(join(ASSETS, 'media'), { recursive: true });
  const name = opts.blur ? `${basename(rel, extname(rel))}-blur${opts.blur}.jpg` : basename(rel);
  const dest = join(ASSETS, 'media', name);
  if (opts.blur) {
    // desfoque gravado na imagem (o contrato do HyperFrames proibe filtro CSS em footage)
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=${opts.blur},eq=brightness=-0.18`, '-q:v', '3', dest]);
  } else copyFileSync(src, dest);
  const out = `assets/media/${name}`;
  copied.set(key, out);
  return out;
}

function scene(id: string, css: string, markup: string, script: string): string {
  // house.css e house-runtime.js sao carregados uma vez no index.html (assets/house/)
  return `<template>
  <style>
    #root { position: absolute; inset: 0; }
${css}
  </style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}">
${markup}
  </div>
  <script>
    (function () {
      var tl = gsap.timeline({ paused: true });
      var $ = function (id) { return document.getElementById(id); };
${script}${script.includes('/*async*/') ? '' : `      window.__timelines["${id}"] = tl;`}
    })();
  </script>
</template>
`;
}

const glow = (color: string, size: number) => `filter: drop-shadow(0 0 ${Math.round(size / 10)}px ${color}aa);`;

// ---------------------------------------------------------------------------
// Fundo
// ---------------------------------------------------------------------------
function buildBackdrops(): string {
  const bds = [...sheet.backdrops].sort((a, b) => a.at - b.at);
  let markup = '';
  let script = '';
  let css = `
    .fundo-black { position: absolute; inset: 0; background: #000; }
    .fundo-plane-wrap { position: absolute; left: ${-W}px; width: ${W * 3}px; top: ${Math.round(H * 0.55)}px; height: ${Math.round(H * 2.2)}px;
      transform-origin: 50% 0%; transform: perspective(700px) rotateX(72deg);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 35%, black 100%); mask-image: linear-gradient(to bottom, transparent 0%, black 35%, black 100%); opacity: 0.22; }
    .fundo-plane { position: absolute; inset: 0;
      background-image: linear-gradient(#fff 1.5px, transparent 1.5px), linear-gradient(90deg, #fff 1.5px, transparent 1.5px); background-size: 90px 90px; }
    .fundo-plate { position: absolute; inset: 0; width: ${W}px; height: ${H}px; object-fit: cover; }
    .fundo-glow { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(255,153,0,0.10) 0%, transparent 38%), radial-gradient(circle, rgba(46,224,74,0.06) 0%, transparent 34%); background-size: 160% 160%, 150% 150%; background-repeat: no-repeat; }
    #fundo-vinheta { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%); z-index: 50; }
  `;
  // base preta fixa embaixo de tudo: o "grade-video" (video a 55%) sem ela deixava o fundo CINZA (Joao, 21/11/2026:
  // "o fundo aqui ficou cinza, o original e preto")
  markup += `    <div class="fundo-black" data-layout-ignore></div>\n`;
  bds.forEach((b, i) => {
    const start = b.at;
    const end = i < bds.length - 1 ? bds[i + 1].at : sheet.duration;
    const dur = r3(end - start);
    const id = `fundo-s${i + 1}`;
    const kind: Backdrop = b.backdrop;
    let inner = '';
    // "black" agora e preto VIVO: luz ambiente da marca andando devagar (o Joao achou "muito fundo preto").
    // "preto-puro" mantem o preto chapado (respiro raro). "grade-video": grade em perspectiva filmada.
    const glow = `<div class="fundo-glow" id="${id}-glow"></div>`;
    if (kind === 'preto-puro') inner = `<div class="fundo-black"></div>`;
    else if (kind === 'black') {
      inner = `<div class="fundo-black"></div>${glow}`;
      script += `      House.drive(tl, ${r3(start)}, ${dur}, function (t) { var T = t + ${r3(start)}; $("${id}-glow").style.backgroundPosition = (50 + Math.sin(T * 0.21) * 22).toFixed(2) + "% " + (40 + Math.cos(T * 0.17) * 18).toFixed(2) + "%, " + (50 - Math.sin(T * 0.13) * 25).toFixed(2) + "% " + (60 + Math.sin(T * 0.19) * 15).toFixed(2) + "%"; });\n`;
    }
    else if (kind === 'grade-video') {
      const src = asset('@assets/Overlays/fundos/grade-perspectiva.mp4');
      // o video e o proprio clip (sem pai temporizado: regra do extrator de quadros)
      markup += src ? `    <video id="${id}-v" class="clip" src="${src}" muted playsinline data-start="${r3(start)}" data-duration="${dur}" data-media-start="${r3(start % 40)}" data-track-index="${i + 40}" style="position:absolute;inset:0;width:${W}px;height:${H}px;object-fit:cover;opacity:0.55"></video>\n` : '';
      inner = glow;
    }
    else if (kind === 'grid') {
      inner = `<div class="fundo-black"></div><div class="fundo-plane-wrap" data-layout-ignore><div id="${id}-plano" class="fundo-plane"></div></div>`;
      script += `      tl.fromTo($("${id}-plano"), { backgroundPosition: "0px 0px" }, { backgroundPosition: "0px ${r3(dur * 0.35 * 90)}px", duration: ${dur}, ease: "none" }, ${r3(start)});\n`;
    } else if (kind === 'stars') {
      const rnd = mulberry(`stars-${i}`);
      const stars = Array.from({ length: 220 }, (_, k) => ({ x: rnd() * W, y: rnd() * H, r: 0.6 + rnd() * 1.6, l: 1 + Math.floor(rnd() * 3), p: rnd() * Math.PI * 2, k }));
      inner = `<div class="fundo-black"></div><svg id="${id}-ceu" width="${W}" height="${H}" style="position:absolute;inset:0">${stars
        .map((s) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${((s.r * s.l) / 2).toFixed(2)}" fill="#fff" data-l="${s.l}" data-p="${s.p.toFixed(3)}" data-x="${s.x.toFixed(1)}"/>`)
        .join('')}</svg>`;
      script += `      (function () {
        var cs = Array.prototype.slice.call($("${id}-ceu").querySelectorAll("circle"));
        House.drive(tl, ${r3(start)}, ${dur}, function (t) {
          for (var k = 0; k < cs.length; k++) {
            var c = cs[k], l = +c.getAttribute("data-l"), p = +c.getAttribute("data-p"), x0 = +c.getAttribute("data-x");
            c.setAttribute("cx", ((x0 + t * 6 * l) % ${W}).toFixed(1));
            c.setAttribute("opacity", ((0.25 + 0.65 * (Math.sin(t * 1.6 + p) * 0.5 + 0.5)) * (0.35 + l * 0.2)).toFixed(3));
          }
        });
      })();\n`;
    } else if (kind !== 'transparent') {
      const src = asset(kind.blur, { blur: 18 });
      inner = src ? `<img class="fundo-plate" src="${src}" alt="">` : `<div class="fundo-black"></div>`;
    }
    markup += `    <div id="${id}" class="clip" data-start="${r3(start)}" data-duration="${dur}" data-track-index="${i}" style="position:absolute;inset:0">${inner}</div>\n`;
  });
  markup += `    <div id="fundo-vinheta" data-layout-ignore></div>\n`;
  return scene('fundo', css, markup, script);
}

function mulberry(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Poeira de pelicula (por cima de tudo, some no modo transparente)
// ---------------------------------------------------------------------------
function buildDust(): string {
  const markup = `    <canvas id="poeira-canvas" class="clip" data-start="0" data-duration="${r3(sheet.duration)}" data-track-index="0" width="${W}" height="${H}" style="position:absolute;inset:0;opacity:0.5" data-layout-ignore></canvas>\n`;
  const script = `      (function () {
        var cv = $("poeira-canvas"), cx = cv.getContext("2d");
        House.drive(tl, 0, ${r3(sheet.duration)}, function (t) {
          var f = Math.floor(t * 15), rnd = House.rng("poeira-" + f);
          cx.clearRect(0, 0, ${W}, ${H});
          cx.fillStyle = "#fff";
          for (var i = 0; i < 26; i++) {
            var x = rnd() * ${W}, y = rnd() * ${H}, r = 0.6 + rnd() * 2.2;
            cx.globalAlpha = 0.35 + rnd() * 0.5;
            cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
          }
          if (rnd() > 0.7) { var sx = rnd() * ${W}; cx.globalAlpha = 0.18; cx.fillRect(sx, 0, 1.2, ${H}); }
          cx.globalAlpha = 1;
        });
      })();\n`;
  return scene('poeira', '', markup, script);
}

// ---------------------------------------------------------------------------
// Legenda cinetica (um unico host de legendas)
// ---------------------------------------------------------------------------
// estilo 'invertida' vai num host proprio com mix-blend-mode:difference NO HOST (dentro da sub-composicao o blend
// so enxergaria o vazio); 'tarja' e as normais ficam no host 'legendas'.
function buildCaptions(invertidas = false): string {
  const windows = sheet.captions ?? [{ from: 0, until: sheet.duration }];
  let markup = '';
  let script = '';
  let n = 0;
  cards.forEach((c, idx) => {
    // o cartao comeca ~0,05 s antes da palavra (leadIn): janela ancorada em "@frase" nao pode perder o 1o cartao,
    // e cartao que comecaria a menos de 0,1 s do fim da janela so piscaria: fica de fora
    const w = windows.find((x) => c.start >= x.from - 0.15 && c.start < x.until - 0.1);
    if (!w) return;
    n++;
    const estilo = estiloDe(w);
    if ((estilo === 'invertida') !== invertidas) return;
    const id = `${invertidas ? 'legi' : 'leg'}-${String(n).padStart(3, '0')}`;
    const start = Math.max(w.from, c.start);
    const end = Math.min(w.until, Math.max(c.end, start + 1 / FPS));
    const words = c.text.toUpperCase().split(/\s+/);
    const emph = c.emphasis?.toUpperCase();
    const html = words
      .map((wd) => (emph && wd.replace(/[.,!?;:]/g, '') === emph ? `<span class="house-emph">${esc(wd)}</span>` : esc(wd)))
      .join(' ');
    const entry = w.entry ?? 'pop';
    const top = Math.round((w.y ?? House.layout.captionY) * H - 52);
    const cls = `house-caption${w.whisper ? ' is-whisper' : ''}${estilo ? ` is-${estilo}` : ''}`;
    const slices =
      entry === 'glitch'
        ? [0, 1, 2, 3]
            .map((k) => `<span class="house-slice ${cls}" style="clip-path: inset(${k * 25}% 0 ${100 - (k + 1) * 25}% 0); color: ${k % 2 ? 'var(--highlight)' : 'var(--text)'}">${html}</span>`)
            .join('')
        : '';
    markup += `    <div id="${id}" class="clip house-center" data-start="${r3(start)}" data-duration="${r3(end - start)}" data-track-index="0" style="top:${top}px"><span style="position:relative;display:inline-block">${slices}<span id="${id}-txt" class="${cls} house-inline">${html}</span></span></div>\n`;
    script += `      House.fit($("${id}-txt"), ${w.whisper ? House.sizes.whisper : House.sizes.caption}, 1600, "Montserrat", ${w.whisper ? 300 : 800});\n`;
    script += `      House.entry(tl, $("${id}-txt"), "${entry}", ${r3(start)}, { dir: ${idx % 2 ? -1 : 1} });\n`;
  });
  return scene(invertidas ? 'legendas-inv' : 'legendas', '', markup, script);
}
// A invertida (blend difference) inverteria as cores do Furry por baixo do bloco: com ele GRANDE na tela vira tarja.
function estiloDe(w: CaptionWindow): CaptionWindow['estilo'] {
  if (w.estilo !== 'invertida') return w.estilo;
  const furryGrande = sheet.beats.some((b) => {
    if (b.kind !== 'mascot') return false;
    const pl = (b as { placement?: string }).placement;
    if (pl === 'corner-left' || pl === 'corner-right') return false;
    const fim = (b as { shrinkAt?: number }).shrinkAt ?? b.until;
    return b.at < w.until && fim > w.from;
  });
  return furryGrande ? 'tarja' : 'invertida';
}
const temInvertida = () => (sheet.captions ?? []).some((w) => estiloDe(w) === 'invertida');

// ---------------------------------------------------------------------------
// Batidas
// ---------------------------------------------------------------------------
async function iconBlock(prefix: string, icon: string, size: number, tone: HouseTone | undefined, label: string | undefined, animated: boolean | undefined, start: number, dur: number) {
  const color = toneColor(tone);
  const { svg, animated: isAnim } = await iconSvg(icon, size, animated !== false);
  const markup = `<div id="${prefix}-in" style="display:flex;flex-direction:column;align-items:center">
        <div id="${prefix}-svg" class="house-icon" style="color:${color};${glow(color, size)}">${svg}</div>
        ${label ? `<div class="house-label">${esc(label)}</div>` : ''}
      </div>`;
  let script = `      House.entry(tl, $("${prefix}-in"), "pop", ${r3(start)});\n`;
  if (isAnim) script += `      House.lucide(tl, $("${prefix}-svg"), ${r3(start)}, ${r3(dur)}, { delay: ${r3(4 / FPS)} });\n`;
  return { markup, script };
}

function strike(prefix: string, size: number, at: number) {
  return {
    markup: `<svg id="${prefix}-risco" width="${size}" height="${size}" viewBox="0 0 100 100" style="position:absolute;left:50%;top:0;margin-left:${-size / 2}px;overflow:visible"><line x1="8" y1="92" x2="92" y2="8" stroke="${House.colors.loss}" stroke-width="9" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></svg>`,
    script: `      tl.fromTo($("${prefix}-risco").querySelector("line"), { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: ${r3(6 / FPS)}, ease: "power2.out" }, ${r3(at)});\n`,
  };
}

let mascotes = 0;
async function buildBeat(beat: Beat, id: string): Promise<string> {
  const dur = r3(beat.until - beat.at);
  const rel = (s: number) => r3(s - beat.at);
  let css = '';
  let markup = '';
  let script = '';

  switch (beat.kind) {
    case 'type-on': {
      const text = beat.text.toUpperCase();
      markup = `    <div id="${id}-txt" class="clip house-center house-caption" data-start="0" data-duration="${dur}" data-track-index="0" style="top:${Math.round(H / 2 - 52)}px${beat.italic ? ';font-style:italic;font-weight:600' : ''}">${esc(text)}</div>\n`;
      const erase = beat.eraseAt !== undefined ? rel(beat.eraseAt) : -1;
      script = `      (function () {
        var el = $("${id}-txt"), full = ${js(text)};
        House.drive(tl, 0, ${dur}, function (t) {
          var typed = Math.floor(t * 22), erased = ${erase} >= 0 && t > ${erase} ? Math.floor((t - ${erase}) * 22 * 1.6) : 0;
          var n = Math.max(0, Math.min(full.length, typed) - erased);
          var caret = Math.floor(t * 2) % 2 === 0 ? "|" : "\\u00a0";
          el.textContent = full.slice(0, n) + caret;
        });
      })();\n`;
      break;
    }
    case 'icon': {
      const size = 380;
      const x = Math.round((beat.x ?? 0.5) * W);
      const y = Math.round((beat.y ?? 0.45) * H);
      const ib = await iconBlock(`${id}-ic`, beat.icon, size, beat.tone, beat.label, beat.animated, 0, dur);
      const st = beat.strikeAt !== undefined ? strike(`${id}-ic`, size, rel(beat.strikeAt)) : { markup: '', script: '' };
      markup = `    <div id="${id}-ic" class="clip" data-start="0" data-duration="${dur}" data-track-index="0" style="position:absolute;left:${x - 400}px;width:800px;top:${y - size / 2}px;display:flex;justify-content:center">
      <div style="position:relative">${ib.markup}${st.markup}</div>
    </div>\n`;
      script = ib.script + st.script;
      break;
    }
    case 'icons': {
      const n = beat.items.length;
      const size = n > 3 ? 200 : n === 3 ? 260 : 320;
      const y = Math.round((beat.y ?? 0.42) * H);
      for (let i = 0; i < n; i++) {
        const it = beat.items[i];
        const x = Math.round((n === 1 ? 0.5 : 0.2 + (0.6 * i) / (n - 1)) * W);
        const pid = `${id}-i${i + 1}`;
        const start = rel(it.at);
        const ib = await iconBlock(pid, it.icon, size, it.tone, it.label, (it as { animated?: boolean }).animated, start, r3(dur - start));
        const st = it.strikeAt !== undefined ? strike(pid, size, rel(it.strikeAt)) : { markup: '', script: '' };
        markup += `    <div id="${pid}" class="clip" data-start="${start}" data-duration="${r3(dur - start)}" data-track-index="${i}" style="position:absolute;left:${x - 300}px;width:600px;top:${y - size / 2}px;display:flex;justify-content:center">
      <div style="position:relative">${ib.markup}${st.markup}</div>
    </div>\n`;
        script += ib.script + st.script;
        if (beat.relation && i > 0) {
          const rx = Math.round((0.2 + (0.6 * (i - 0.5)) / (n - 1)) * W);
          const rid = `${id}-r${i}`;
          markup += `    <div id="${rid}" class="clip" data-start="${start}" data-duration="${r3(dur - start)}" data-track-index="${n + i}" style="position:absolute;left:${rx - 100}px;width:200px;top:${y - 80}px;text-align:center"><span id="${rid}-in" class="house-number house-inline" style="font-size:140px;color:var(--text)">${esc(beat.relation)}</span></div>\n`;
          script += `      House.entry(tl, $("${rid}-in"), "pop", ${start});\n`;
        }
      }
      break;
    }
    case 'number': {
      const tone = beat.tone ?? toneFromValue(beat.value);
      const color = toneColor(tone);
      markup = `    <div id="${id}-num" class="clip house-center" data-start="0" data-duration="${dur}" data-track-index="0" style="top:${Math.round(H * 0.48 - 150)}px">
      <div id="${id}-num-in" style="display:inline-block">
        <div id="${id}-num-txt" class="house-number" style="color:${color};text-shadow:0 0 32px ${color}99, 0 0 86px ${color}44">${esc(beat.value)}</div>
        ${beat.caption ? `<div class="house-number-caption">${esc(beat.caption)}</div>` : ''}
      </div>
    </div>\n`;
      script = `      House.entry(tl, $("${id}-num-in"), "pop", 0);\n`;
      if (beat.countFrom !== undefined) {
        const m = beat.value.match(/-?[\d.,]+/);
        const target = m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : 0;
        const decimals = m ? (m[0].split(',')[1] ?? '').length : 0;
        script += `      (function () {
        var el = $("${id}-num-txt"), tpl = ${js(beat.value)}, token = ${js(m ? m[0] : '')};
        House.drive(tl, 0, ${dur}, function (t) {
          var p = Math.min(1, t / 0.8), e = 1 - Math.pow(1 - p, 3);
          var v = ${beat.countFrom} + (${target} - ${beat.countFrom}) * e;
          var s = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: ${decimals}, maximumFractionDigits: ${decimals} });
          el.textContent = token ? tpl.replace(token, (v < 0 ? "-" : "") + s) : tpl;
        });
      })();\n`;
      }
      break;
    }
    case 'mascot': {
      // Joao, 21/11/2026: "centraliza ele de preferencia em todas as cenas... quando for ele maior tem que ficar sempre
      // centralizado no meio do video, nao pelas laterais. Ele pode ficar menor nas laterais so quando for algo pequeno
      // ou nao for o foco da cena, meio que para complementar ela."
      // -> grande = SEMPRE no centro. "left-third"/"right-third" viram: centro se ele e o foco (nada mais na tela),
      //    ou canto pequeno daquele lado se outra cena divide a tela com ele (>40% do tempo dele).
      mascotes++;
      const pedido = (beat.placement as string | undefined) ?? 'auto';
      let final = pedido === 'auto' ? 'center' : pedido;
      if (final === 'left-third' || final === 'right-third') {
        const visual = (b: Beat) => b !== beat && b.kind !== 'mascot' && b.kind !== 'section' && !(b.kind === 'cena' && (b as { tipo?: string }).tipo === 'piada');
        // so o tempo em que ele esta GRANDE (antes de encolher para o canto por cima da cena seguinte)
        const fim = (beat as { shrinkAt?: number }).shrinkAt ?? beat.until;
        const junto = sheet.beats.filter(visual).reduce((acc, b) => acc + Math.max(0, Math.min(b.until, fim) - Math.max(b.at, beat.at)), 0);
        final = junto > 0.4 * (fim - beat.at) ? (final === 'left-third' ? 'corner-left' : 'corner-right') : 'center';
      }
      (beat as { placement?: string }).placement = final;
      // NUNCA espelhar o Furry (Joao, 21/11/2026: "proibido usar o personagem espelhado"): a roupa e o logo dele tem lado
      (beat as { flip?: boolean }).flip = false;
      const place = { center: 0.5, 'left-third': 0.3, 'right-third': 0.7, 'corner-left': 0.11, 'corner-right': 0.89 }[beat.placement ?? 'center'];
      const small = beat.placement === 'corner-left' || beat.placement === 'corner-right';
      const h = Math.round(H * (small ? 0.34 : 0.88));
      const poses = beat.poses?.length ? beat.poses : [{ at: beat.at, pose: beat.pose }];
      let posesHtml = '';
      poses.forEach((p, i) => {
        const s = rel(Math.max(beat.at, p.at));
        const e = i < poses.length - 1 ? rel(poses[i + 1].at) : dur;
        // Mascote animado: se existir o loop .webm (alfa) ao lado do PNG, usa o loop (pedido do João, 20/11/2026:
        // "usar os animados dele, nao os png"). O loop e 1920x1080 com a raposa no centro do quadro.
        const webmRel = p.pose?.replace(/\.png$/i, '.webm');
        const loop = p.pose?.toLowerCase().endsWith('.webm') ? asset(p.pose) : webmRel && webmRel !== p.pose && existsSync(join(baseDir, webmRel)) ? asset(webmRel) : undefined;
        const src = loop ? undefined : asset(p.pose);
        const pid = `${id}-pose${i + 1}`;
        if (loop) {
          const vw = Math.round((h * 16) / 9);
          posesHtml += `<video id="${pid}" class="clip" src="${loop}" muted playsinline data-start="${s}" data-duration="${r3(e - s)}" data-track-index="${i + 1}" style="position:absolute;bottom:0;left:50%;height:${h}px;width:${vw}px;margin-left:${-Math.round(vw / 2)}px${beat.flip ? ';transform:scaleX(-1)' : ''}"></video>`;
          return;
        }
        posesHtml += src
          ? `<img id="${pid}" class="clip" src="${src}" alt="" data-start="${s}" data-duration="${r3(e - s)}" data-track-index="${i + 1}" style="position:absolute;bottom:0;left:50%;height:${h}px;width:${h}px;margin-left:${-Math.round(h / 2)}px;object-fit:contain${beat.flip ? ';transform:scaleX(-1)' : ''}">`
          : `<div id="${pid}" class="clip house-placeholder" data-start="${s}" data-duration="${r3(e - s)}" data-track-index="${i + 1}" style="position:absolute;bottom:0;left:50%;height:${h}px;width:${Math.round(h * 0.62)}px;margin-left:${-Math.round(h * 0.31)}px;border-radius:40% 40% 8% 8%;font-size:${Math.max(18, Math.round(h / 22))}px">MASCOTE ${i + 1}</div>`;
      });
      // wrapper SEM data-start: o extrator de quadros do HyperFrames nao soma o offset de um pai temporizado a um <video>
      markup = `    <div id="${id}-m" style="position:absolute;inset:0" data-layout-allow-overflow>
      <div id="${id}-pos" style="position:absolute;left:${Math.round(place * W - 300)}px;width:600px;bottom:0;height:${h}px">
        <div id="${id}-enter" style="position:absolute;inset:0">
          <div id="${id}-sway" style="position:absolute;inset:0">${posesHtml}</div>
        </div>
      </div>
      ${beat.nameTag ? `<div id="${id}-tag" class="clip" data-start="0.4" data-duration="${r3(Math.max(0.3, Math.min(2.3, (beat.shrinkAt !== undefined ? rel(beat.shrinkAt) : dur) - 0.4)))}" data-track-index="9" style="position:absolute;left:${Math.round(place * W - 300)}px;width:600px;text-align:center;top:${H - Math.round(h * 0.16) - 30}px"><span id="${id}-tag-in" class="house-inline" style="background:#fff;color:#B35C00;font-family:var(--font-caption);font-weight:800;font-size:30px;padding:8px 28px;border-radius:40px">OFurry</span></div>` : ''}
    </div>\n`;
      // SEM 3D no Furry (Joao, 21/11/2026: "nas cenas do meu personagem nao usar 3D nele, apenas nos outros elementos;
      // ele pode ficar mais parado no centro ou do outro lado"): entra subindo ou deslizando reto e fica parado
      // (o loop .webm ja respira e mexe o rabo).
      const ENTRADAS = ['rise', 'lado'];
      const pedida = (beat as { entra?: string }).entra;
      const entra = pedida === 'lado' || pedida === 'rise' ? pedida : ENTRADAS[(hashStr(sheet.id) + mascotes) % ENTRADAS.length];
      const lado = place > 0.5 ? 1 : -1;
      if (entra === 'lado') script = `      tl.fromTo($("${id}-enter"), { x: ${lado * 520}, opacity: 0.2 }, { x: 0, opacity: 1, duration: ${r3(10 / FPS)}, ease: "expo.out" }, 0);
`;
      else script = `      House.entry(tl, $("${id}-enter"), "rise", 0, { distance: 260, frames: 8 });
`;
      if (beat.nameTag) script += `      House.entry(tl, $("${id}-tag-in"), "pop", 0.4);\n`;
      if (beat.shrinkAt !== undefined) {
        const tx = Math.round(0.89 * W - place * W);
        script += `      tl.fromTo($("${id}-pos"), { x: 0, scale: 1 }, { x: ${tx}, scale: 0.38, transformOrigin: "50% 100%", duration: ${r3(8 / FPS)}, ease: "power3.out" }, ${rel(beat.shrinkAt)});\n`;
      }
      break;
    }
    case 'proof': {
      const src = asset(beat.src);
      const w = Math.round(W * 0.62);
      const hl = beat.highlight;
      const hlAt = beat.highlightAt !== undefined ? rel(beat.highlightAt) : 0.8;
      markup = `    <div id="${id}-p" class="clip" data-start="0" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center" data-layout-allow-overflow>
      <div id="${id}-card" style="position:relative;width:${w}px;box-shadow:0 0 0 2px rgba(255,255,255,.35),0 30px 120px rgba(255,255,255,.12);background:#111">
        ${src ? `<img src="${src}" alt="" style="width:100%;display:block">` : `<div class="house-placeholder" style="width:100%;aspect-ratio:16/10;font-size:40px">PRINT DE PROVA</div>`}
        ${hl ? `<div id="${id}-hl" style="position:absolute;left:${hl[0] * 100}%;top:${hl[1] * 100}%;width:${hl[2] * 100}%;height:${hl[3] * 100}%;border:6px solid var(--loss);border-radius:6px;box-shadow:0 0 18px #e3141b88;clip-path:inset(-12px 100% -12px -12px)"></div>` : ''}
      </div>
    </div>\n`;
      script = `      var card = $("${id}-card");
      tl.fromTo(card, { rotationY: -30, rotationX: 14, transformPerspective: 1400, opacity: 0, filter: "blur(18px)", scale: 1.06 },
        { rotationY: -6, rotationX: 4, opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.33, ease: "power3.out" }, 0);
      tl.fromTo(card, { rotationY: -6 }, { rotationY: -1, scale: 1.04, duration: ${r3(Math.max(0.1, dur - 0.43))}, ease: "power1.inOut", immediateRender: false }, 0.33);
      tl.fromTo(card, { x: 28, filter: "hue-rotate(90deg) saturate(3)" }, { x: -22, filter: "hue-rotate(90deg) saturate(3)", duration: ${r3(2 / FPS)}, immediateRender: false }, ${r3(dur - 3 / FPS)});
      tl.fromTo(card, { opacity: 1 }, { opacity: 0, duration: ${r3(1 / FPS)}, immediateRender: false }, ${r3(dur - 1 / FPS)});\n`;
      if (hl) script += `      tl.fromTo($("${id}-hl"), { clipPath: "inset(-12px 100% -12px -12px)" }, { clipPath: "inset(-12px 0% -12px -12px)", duration: 0.33, ease: "power2.out" }, ${hlAt});\n`;
      break;
    }
    case 'chapter': {
      markup = `    <div id="${id}-c" class="clip" data-start="1" data-duration="${r3(Math.max(0.1, dur - 1))}" data-track-index="0" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:48px">
      <div id="${id}-num" class="house-chapter-num">${esc(String(beat.number))}</div>
      <div id="${id}-tit" class="house-chapter-title">${esc(beat.title)}</div>
    </div>\n`;
      script = `      House.entry(tl, $("${id}-num"), "blur", 1, { frames: 8 });
      tl.fromTo($("${id}-tit"), { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.27, ease: "expo.out" }, 1.2);\n`;
      break;
    }
    case 'section': {
      markup = `    <div id="${id}-s" class="clip house-center" data-start="0" data-duration="${dur}" data-track-index="0" style="top:70px"><span id="${id}-s-in" class="house-section house-inline">${esc(beat.text)}</span></div>\n`;
      script = `      House.entry(tl, $("${id}-s-in"), "rise", 0, { dir: -1, distance: 40 });\n`;
      break;
    }
    case 'thumb': {
      const src = asset(beat.src);
      markup = `    <div id="${id}-t" class="clip" data-start="0" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0">
      <div id="${id}-t-in" style="position:absolute;inset:0">${src ? `<img src="${src}" alt="" style="width:${W}px;height:${H}px;object-fit:cover">` : `<div class="house-placeholder" style="position:absolute;inset:0;font-size:60px">THUMBNAIL</div>`}</div>
    </div>\n`;
      script = `      tl.fromTo($("${id}-t-in"), { opacity: 0, scale: 1 }, { opacity: 1, scale: 1.02, duration: 1, ease: "power2.out" }, 0);
      tl.fromTo($("${id}-t-in"), { scale: 1.02 }, { scale: 1.08, duration: ${r3(Math.max(0.1, dur - 1))}, ease: "none", immediateRender: false }, 1);
      tl.fromTo($("${id}-t-in"), { opacity: 1 }, { opacity: 0, duration: 0.66, ease: "power2.in", immediateRender: false }, ${r3(Math.max(0, dur - 0.7))});\n`;
      break;
    }
    case 'cena': {
      // Cena de dados/metafora do kit ofurry-cenas.js: funcao pura do tempo (OF.<tipo>)
      const { kind: _k, at: _a, until: _u, tipo, opcional: _o, ...params } = beat as Record<string, any>;
      // arquivos citados pela cena (foto3d: src/depth) vao para assets/media
      for (const key of ['src', 'depth']) if (typeof params[key] === 'string') params[key] = asset(params[key]) ?? '';
      // icones Lucide citados pela cena (palco: atores[].icone, fluxos[].icone) viram SVG estatico injetado
      for (const list of [params.atores, params.fluxos]) {
        if (!Array.isArray(list)) continue;
        for (const it of list) if (typeof it.icone === 'string') it.svg = (await iconSvg(it.icone, it.tam ?? (list === params.fluxos ? 100 : 260), false)).svg;
      }
      markup = `    <div id="${id}-cena" class="clip" data-start="0" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0" data-layout-allow-overflow></div>
`;
      if (tipo === 'foto3d') {
        // assincrona: a timeline so e registrada depois que imagem e mapa carregam
        script = `      /*async*/ OF.foto3d($("${id}-cena"), ${js(params)}, ${r3(beat.at)}, ${dur}).then(function (render) { House.drive(tl, 0, ${dur}, render); }).catch(function (e) { console.error(e); }).then(function () { window.__timelines["${id}"] = tl; });
`;
      } else script = `      House.drive(tl, 0, ${dur}, OF.${tipo}($("${id}-cena"), ${js(params)}, ${r3(beat.at)}, ${dur}));
`;
      break;
    }
    case 'broll': {
      // B-roll real (videos/<id>/acervo/broll, tratado por `bun run broll:preparar`). Nunca parado: zoom lento
      // (Ken Burns) no involucro (sem filtro CSS no video: contrato do HyperFrames), entrada da casa e escurecimento para a legenda ler por cima.
      // Campos: src, video (default: pelo .mp4/.webm), de (segundo do clipe onde comeca), zoom [de, ate] (1.0->1.08),
      //   entra: 'flash' | 'zoom' | 'whip' | 'corte' (default 'corte'), moldura (quadro inclinado com borda, 0.72 da tela),
      //   escurece 0..1 (default 0.25), x/y (centro do quadro na moldura, 0..1)
      const b = beat as typeof beat & { de?: number; zoom?: [number, number]; entra?: string; moldura?: boolean; escurece?: number; x?: number; y?: number };
      const src = asset(beat.src);
      const isVideo = beat.video ?? /\.(mp4|webm|mov)$/i.test(beat.src);
      const [z0, z1] = b.zoom ?? [1.0, 1.08];
      const mold = !!b.moldura;
      const fw = mold ? Math.round(W * 0.72) : W, fh = mold ? Math.round(H * 0.72) : H;
      const fx = mold ? Math.round((b.x ?? 0.5) * W - fw / 2) : 0, fy = mold ? Math.round((b.y ?? 0.5) * H - fh / 2) : 0;
      const media = !src
        ? `<div class="house-placeholder" style="position:absolute;inset:0;font-size:60px">B-ROLL</div>`
        : isVideo
          ? `<video id="${id}-v" class="clip" src="${src}" muted playsinline data-start="0" data-duration="${dur}"${b.de ? ` data-media-start="${b.de}"` : ''} data-track-index="0" style="position:absolute;left:0;top:0;width:${fw}px;height:${fh}px;object-fit:cover"></video>`
          : `<img id="${id}-v" src="${src}" alt="" style="position:absolute;left:0;top:0;width:${fw}px;height:${fh}px;object-fit:cover">`;
      const esc = b.escurece ?? 0.25;
      markup = `    <div id="${id}-quadro" style="position:absolute;left:${fx}px;top:${fy}px;width:${fw}px;height:${fh}px;overflow:hidden;${mold ? 'border:6px solid #fdfdfd;box-shadow:0 30px 90px rgba(0,0,0,.8),0 0 40px rgba(255,255,255,.12);' : ''}" data-layout-allow-overflow>
      <div id="${id}-z" style="position:absolute;inset:0">${media}</div>
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(0,0,0,${(esc * 0.4).toFixed(2)}) 40%, rgba(0,0,0,${Math.min(0.9, esc * 2.2).toFixed(2)}) 100%), linear-gradient(to bottom, transparent 55%, rgba(0,0,0,${Math.min(0.85, esc * 2).toFixed(2)}) 100%)"></div>
      <div id="${id}-flash" style="position:absolute;inset:0;background:#fff;opacity:0"></div>
    </div>\n`;
      script = `      tl.fromTo($("${id}-z"), { scale: ${z0} }, { scale: ${z1}, duration: ${dur}, ease: "none" }, 0);\n`;
      if (mold) script += `      tl.fromTo($("${id}-quadro"), { rotation: -2.5, y: 40, opacity: 0 }, { rotation: -1.5, y: 0, opacity: 1, duration: ${r3(6 / FPS)}, ease: "power3.out" }, 0);\n`;
      const entra = b.entra ?? 'corte';
      if (entra === 'flash') script += `      tl.fromTo($("${id}-flash"), { opacity: 0.85 }, { opacity: 0, duration: ${r3(4 / FPS)}, ease: "power2.out" }, 0);\n`;
      else if (entra === 'zoom') script += `      tl.fromTo($("${id}-quadro"), { scale: 1.3 }, { scale: 1, duration: ${r3(7 / FPS)}, ease: "expo.out" }, 0);\n`;
      else if (entra === 'whip') script += `      tl.fromTo($("${id}-quadro"), { x: 420, opacity: 0.4 }, { x: 0, opacity: 1, duration: ${r3(5 / FPS)}, ease: "expo.out" }, 0);\n`;
      break;
    }
  }
  return scene(id, css, markup, script);
}

// ---------------------------------------------------------------------------
// Raiz
// ---------------------------------------------------------------------------
/**
 * Camera global estilo edicao de anime/rap (pedido do Joao, 20/11/2026: "abusar bastante de efeitos de camera").
 * A cada troca de cena (inicio de batida) um efeito no corte; manual: sheet.camera [{at, tipo}]; desligar: cameraAuto:false.
 * tipos: punch, whip, shake, tilt3d, roll, glitch, luz, flash.
 */
type CamEvt = { at: number; tipo: string };
function cameraEvents(beatIds: { id: string; beat: Beat }[]): CamEvt[] {
  const cfg = sheet as BeatSheet & { camera?: CamEvt[]; cameraAuto?: boolean };
  const CICLO = ['punch', 'whip', 'tilt3d', 'shake', 'punch', 'glitch', 'roll', 'whip', 'luz', 'punch', 'flash', 'tilt3d'];
  const evs: CamEvt[] = [...(cfg.camera ?? [])];
  if (cfg.cameraAuto !== false) {
    const h = hashStr(sheet.id);
    const ats = [...new Set(beatIds.filter(({ beat }) => beat.kind !== 'mascot' && !(beat.kind === 'cena' && (beat as { tipo?: string }).tipo === 'piada')).map(({ beat }) => r3(beat.at)))].filter((t) => t > 0.05).sort((a, b) => a - b);
    let last = -9;
    ats.forEach((t, k) => {
      if (t - last < 0.6) return;
      last = t;
      evs.push({ at: t, tipo: CICLO[(h + k) % CICLO.length] });
    });
  }
  return evs.sort((a, b) => a.at - b.at);
}

function buildTextura(evs: CamEvt[]): string {
  // overlays REAIS da despensa (D:/YT/!Assets/Overlays): riscos de pelicula o tempo todo; vhs/luz/flash nas transicoes
  const dur = r3(sheet.duration);
  let markup = '';
  const pel = asset('@assets/Overlays/pelicula/riscos-e-poeira.mp4');
  if (pel) {
    for (let t0 = 0, k = 0; t0 < dur; t0 += 59, k++) {
      const d = r3(Math.min(59, dur - t0));
      markup += `    <video id="tex-pel-${k}" class="clip" src="${pel}" muted playsinline data-start="${r3(t0)}" data-duration="${d}" data-media-start="${(hashStr(sheet.id) % 30) / 10}" data-track-index="${k}" style="position:absolute;inset:0;width:${W}px;height:${H}px;object-fit:cover;mix-blend-mode:screen;opacity:0.35"></video>\n`;
    }
  }
  const vhs = asset('@assets/Overlays/glitch/vhs-ruido.mp4');
  const luz = asset('@assets/Overlays/luz/light-leak-borda.mp4'); // recorte so com a luz vazando pela borda
  evs.forEach((e, k) => {
    // flash e feito em codigo (branco limpo): o overlay 5 do PC e creme e vira laranja chapado em "screen"
    const src = e.tipo === 'glitch' ? vhs : e.tipo === 'luz' ? luz : undefined;
    if (!src) return;
    const d = e.tipo === 'glitch' ? 0.2 : e.tipo === 'luz' ? 0.75 : 0.35;
    const s0 = Math.max(0, e.at - (e.tipo === 'luz' ? 0.3 : 0.03));
    markup += `    <video id="tex-tr-${k}" class="clip" src="${src}" muted playsinline data-start="${r3(s0)}" data-duration="${r3(Math.min(d, dur - s0))}" data-media-start="${e.tipo === 'glitch' ? ((k * 7) % 30) / 10 : 0}" data-track-index="${10 + k}" style="position:absolute;inset:0;width:${W}px;height:${H}px;object-fit:cover;mix-blend-mode:screen;opacity:${e.tipo === 'glitch' ? 0.6 : e.tipo === 'luz' ? 0.7 : 0.8}"></video>\n`;
  });
  return scene('textura', '', markup, '');
}

function cameraScript(evs: CamEvt[]): string {
  const F = 1 / FPS;
  let js = `      var cam = document.getElementById("camera"), mao = document.getElementById("camera-mao");
      // camera na mao: deriva leve e continua (so translacao)
      House.drive(tl, 0, ${r3(sheet.duration)}, function (t) { mao.style.transform = "translate(" + (Math.sin(t * 0.61) * 5 + Math.sin(t * 1.73) * 2).toFixed(2) + "px," + (Math.cos(t * 0.53) * 4 + Math.sin(t * 1.31) * 1.5).toFixed(2) + "px) scale(1.012)"; });\n`;
  evs.forEach((e, k) => {
    const t = r3(e.at), d = (n: number) => r3(n * F);
    const dir = k % 2 ? 1 : -1;
    switch (e.tipo) {
      case 'punch': js += `      tl.fromTo(cam, { scale: 1.09 }, { scale: 1, duration: ${d(9)}, ease: "expo.out", immediateRender: false }, ${t});\n`; break;
      case 'whip': js += `      tl.fromTo(cam, { x: ${dir * 140}, skewX: ${dir * -6} }, { x: 0, skewX: 0, duration: ${d(6)}, ease: "expo.out", immediateRender: false }, ${t});\n`; break;
      case 'tilt3d': js += `      tl.fromTo(cam, { rotationY: ${dir * 14}, rotationX: 5, scale: 1.06, transformPerspective: 1300 }, { rotationY: 0, rotationX: 0, scale: 1, duration: ${d(12)}, ease: "power3.out", immediateRender: false }, ${t});\n`; break;
      case 'roll': js += `      tl.fromTo(cam, { rotation: ${dir * 3.5}, scale: 1.05 }, { rotation: 0, scale: 1, duration: ${d(8)}, ease: "back.out(2)", immediateRender: false }, ${t});\n`; break;
      case 'shake':
      case 'glitch': {
        const offs = e.tipo === 'glitch' ? [[22, -8], [-30, 6], [14, 10], [-6, -4], [0, 0]] : [[10, -7], [-12, 6], [8, 9], [-6, -5], [3, 3], [0, 0]];
        offs.forEach(([x, y], i) => { js += `      tl.fromTo(cam, { x: ${x}, y: ${y} }, { x: ${x}, y: ${y}, duration: ${d(1)}, immediateRender: false }, ${r3(e.at + i * F)});\n`; });
        if (e.tipo === 'glitch') js += `      tl.fromTo(document.getElementById("camera-rgb"), { opacity: 0.85 }, { opacity: 0, duration: ${d(4)}, ease: "steps(4)", immediateRender: false }, ${t});\n`;
        break;
      }
      case 'luz': js += `      tl.fromTo(cam, { scale: 1.04 }, { scale: 1, duration: ${d(14)}, ease: "power2.out", immediateRender: false }, ${t});\n`; break;
      case 'flash':
        js += `      tl.fromTo(cam, { scale: 1.12 }, { scale: 1, duration: ${d(7)}, ease: "expo.out", immediateRender: false }, ${t});\n`;
        js += `      tl.fromTo(document.getElementById("camera-flash"), { opacity: 0.75 }, { opacity: 0, duration: ${d(5)}, ease: "power2.out", immediateRender: false }, ${t});\n`;
        break;
    }
  });
  return js;
}

function buildIndex(beatIds: { id: string; beat: Beat }[], audioSrc?: string): string {
  const dur = r3(sheet.duration);
  const evs = cameraEvents(beatIds);
  writeFileSync(join(COMP, 'textura.html'), buildTextura(evs));
  const host = (id: string, start: number, d: number, track: number, z: number, extra = '') =>
    `      <div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${r3(start)}" data-duration="${r3(d)}" data-track-index="${track}" data-track-kind="${id === 'legendas' ? 'captions' : 'graphics'}" data-width="${W}" data-height="${H}" style="z-index:${z}"${extra}></div>`;
  // a camera move o fundo e as cenas; legenda, textura e poeira ficam por cima, fora da camera
  // O Furry fica FORA da camera (sem tremida, giro ou inclinacao nele: "nao usar 3D nele") e por cima das cenas.
  const ehMascote = (b: Beat) => b.kind === 'mascot';
  const naCamera = [host('fundo', 0, dur, 0, 1, ' data-house-backdrop'), ...beatIds.map(({ id, beat }, i) => ({ id, beat, i })).filter(({ beat }) => !ehMascote(beat)).map(({ id, beat, i }) => host(id, beat.at, beat.until - beat.at, i + 1, 10 + i))];
  const mascotes = beatIds.map(({ id, beat }, i) => ({ id, beat, i })).filter(({ beat }) => ehMascote(beat)).map(({ id, beat, i }) => host(id, beat.at, beat.until - beat.at, i + 1, 80 + i));
  const hosts = [
    `      <div id="camera-mao" style="position:absolute;inset:0;z-index:1"><div id="camera" style="position:absolute;inset:0;transform-origin:50% 50%">`,
    ...naCamera,
    `      </div></div>`,
    ...mascotes,
    // blend "screen" NO HOST: dentro da sub-composicao o blend so enxerga o vazio e o preto do overlay escurecia o video todo
    host('textura', 0, dur, beatIds.length + 3, 90, ' data-house-backdrop').replace('style="z-index:90"', 'style="z-index:90;mix-blend-mode:screen"'),
    `      <div id="camera-rgb" style="position:absolute;inset:0;z-index:95;opacity:0;pointer-events:none;background:repeating-linear-gradient(0deg, rgba(255,0,60,0.22) 0px, rgba(255,0,60,0.22) 6px, transparent 6px, transparent 14px, rgba(0,229,255,0.2) 14px, rgba(0,229,255,0.2) 19px, transparent 19px, transparent 31px);mix-blend-mode:screen"></div>`,
    `      <div id="camera-flash" style="position:absolute;inset:0;z-index:96;opacity:0;pointer-events:none;background:#fff"></div>`,
    ...(temInvertida() ? [host('legendas-inv', 0, dur, beatIds.length + 4, 99).replace('style="z-index:99"', 'style="z-index:99;mix-blend-mode:difference"')] : []),
    host('legendas', 0, dur, beatIds.length + 1, 100),
    ...(sheet.filmDust === false ? [] : [host('poeira', 0, dur, beatIds.length + 2, 200, ' data-house-backdrop')]),
  ];
  return `<!doctype html>
<!-- Gerado por scripts/hf/build-trecho.ts a partir de ${basename(beatsPath)} (${sheet.id}). -->
<html lang="pt-BR" data-composition-variables='[{"id":"transparente","type":"boolean","label":"Fundo transparente (exportar alpha)","default":false}]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script src="assets/house/house-runtime.js"></script>
    <script src="assets/house/ofurry-cenas.js"></script>
    ${existsSync(join(KIT, 'maquina3d.js')) ? '<script src="assets/house/maquina3d.js"></script>' : ''}
    <link rel="stylesheet" href="assets/house/house.css" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: transparent; }
      #root { width: 100%; height: 100%; position: relative; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${dur}" data-width="${W}" data-height="${H}" data-fps="${sheet.fps ?? FPS}">
${hosts.join('\n')}
${audioSrc ? `      <audio id="narracao" src="${audioSrc}" data-start="0" data-duration="${dur}" data-track-index="${beatIds.length + 3}" data-volume="1"></audio>` : ''}
    </div>
    <script>
      var vars = (window.__hyperframes && window.__hyperframes.getVariables && window.__hyperframes.getVariables()) || {};
      if (vars.transparente === true) {
        document.querySelectorAll("[data-house-backdrop]").forEach(function (el) { el.style.opacity = "0"; });
      }
      var tl = gsap.timeline({ paused: true });
${cameraScript(evs)}      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

// ---------------------------------------------------------------------------
async function main() {
  const issues = lintBeatSheet(sheet, cards);
  if (issues.length) {
    console.log(`Lint da casa: ${issues.length} aviso(s) (rode bun run house:lint ${beatsPath} para detalhes)`);
    for (const i of issues.slice(0, 8)) console.log(`  [${i.at.toFixed(1)}-${i.until.toFixed(1)}s] ${i.rule}: ${i.message}`);
  }
  rmSync(COMP, { recursive: true, force: true });
  mkdirSync(COMP, { recursive: true });
  mkdirSync(join(ASSETS, 'fonts'), { recursive: true });
  mkdirSync(join(ASSETS, 'house'), { recursive: true });
  copyFileSync(join(KIT, 'house.css'), join(ASSETS, 'house', 'house.css'));
  copyFileSync(join(KIT, 'house-runtime.js'), join(ASSETS, 'house', 'house-runtime.js'));
  copyFileSync(join(KIT, 'ofurry-cenas.js'), join(ASSETS, 'house', 'ofurry-cenas.js'));
  if (existsSync(join(KIT, 'maquina3d.js'))) copyFileSync(join(KIT, 'maquina3d.js'), join(ASSETS, 'house', 'maquina3d.js'));
  copyFileSync(join(ROOT, 'node_modules', '@fontsource', 'bebas-neue', 'files', 'bebas-neue-latin-400-normal.woff2'), join(ASSETS, 'fonts', 'bebas-neue-400.woff2'));

  let audioSrc: string | undefined;
  if (sheet.audio && existsSync(join(baseDir, sheet.audio))) {
    const ext = extname(sheet.audio);
    copyFileSync(join(baseDir, sheet.audio), join(ASSETS, `narracao${ext}`));
    audioSrc = `assets/narracao${ext}`;
  }

  writeFileSync(join(COMP, 'fundo.html'), buildBackdrops());
  if (sheet.filmDust !== false) writeFileSync(join(COMP, 'poeira.html'), buildDust());

  // Furry fica mais tempo (Joao, 21/11/2026: "a cena do personagem pode ficar mais tempo"): quando a cena dele
  // termina, ele encolhe para o canto direito e continua ~3,5 s reagindo por cima da cena seguinte.
  // Desligar numa batida: "canto": false; tempo: "segura": <s>.
  const fim = sheet.duration;
  sheet.beats.forEach((b, i) => {
    if (b.kind !== 'mascot') return;
    const m = b as typeof b & { canto?: boolean; segura?: number };
    if (m.canto === false || m.shrinkAt !== undefined || m.placement === 'corner-left' || m.placement === 'corner-right') return;
    const proxMascote = sheet.beats.slice(i + 1).filter((x) => x.kind === 'mascot').map((x) => x.at);
    const limite = Math.min(fim, ...proxMascote);
    const novo = Math.min(limite, m.until + (m.segura ?? 3.5));
    if (novo - m.until < 1) return;
    m.shrinkAt = m.until;
    m.until = r3(novo);
    (m as { _canto?: boolean })._canto = true;
  });
  const beatIds = sheet.beats.map((beat, i) => ({ id: `b${String(i + 1).padStart(2, '0')}-${beat.kind}`, beat }));
  for (const { id, beat } of beatIds) writeFileSync(join(COMP, `${id}.html`), await buildBeat(beat, id));
  // legendas depois das batidas: precisam da posicao final do Furry (estiloDe)
  writeFileSync(join(COMP, 'legendas.html'), buildCaptions());
  if (temInvertida()) writeFileSync(join(COMP, 'legendas-inv.html'), buildCaptions(true));

  writeFileSync(join(OUT, 'index.html'), buildIndex(beatIds, audioSrc));
  writeFileSync(
    join(OUT, 'hyperframes.json'),
    JSON.stringify(
      {
        $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json',
        registry: 'https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry',
        paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' },
        media: { autoProxy: true },
      },
      null,
      2
    ) + '\n'
  );
  const meta = join(OUT, 'meta.json');
  if (!existsSync(meta)) writeFileSync(meta, JSON.stringify({ id: sheet.id, name: sheet.id, createdAt: new Date().toISOString() }, null, 2) + '\n');
  const hf = `npx --yes hyperframes@${HF_VERSION}`;
  writeFileSync(
    join(OUT, 'package.json'),
    JSON.stringify({ name: sheet.id.toLowerCase(), private: true, type: 'module', scripts: { dev: `${hf} preview`, check: `${hf} check`, render: `${hf} render` } }, null, 2) + '\n'
  );
  console.log(`Projeto HyperFrames gerado em ${OUT}`);
  console.log(`  ${beatIds.length} batidas, ${cards.length} cartoes de legenda, ${r3(sheet.duration)} s`);
  console.log(`  Preview: cd "${OUT}" && npx hyperframes preview`);
}

main();
