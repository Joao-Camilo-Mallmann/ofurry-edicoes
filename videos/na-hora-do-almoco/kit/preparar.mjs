/**
 * Prepara o projeto HyperFrames de um trecho do video "Na Hora do Almoco".
 *
 * Uso: bun videos/na-hora-do-almoco/kit/preparar.mjs <XX> [--sem-mix]
 *
 * 1. copia o kit (almoco.js/.css, fontes) para hf/assets
 * 2. copia so as imagens e mapas de profundidade citados nos HTML (assets/img/*, assets/depth/*)
 * 3. mixa o audio do trecho a partir de output/trecho-XX/sons.json -> hf/assets/audio/mix.wav
 *
 * sons.json: { "dur": 37.4, "cues": [ { "file": "@narr", "at": 8, "gain": 0, "from": 0, "len": 5,
 *              "fadeIn": 0.5, "fadeOut": 1, "env": [[t, dB], ...] } ] }
 * Atalhos de arquivo: @narr (narracao do trecho), @sfx/ (pack de efeitos), @sw/ (swooshes),
 * @mus/ (musicas), @clipe/ (pasta do clipe do Belchior), @camadas/ (05-camadas-prontas).
 * `at`, `env` em segundos do trecho; `from`/`len` em segundos do arquivo; ganho em dB.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KIT = dirname(fileURLToPath(import.meta.url));
const VIDEO = join(KIT, '..');
const PROJ = 'D:/YT/Matheus (Alves)/hora do armoco';
const ASSETS = join(PROJ, '06-montagem', 'assets');
const ALIAS = {
  '@sfx/': 'D:/YT/!Assets/PACK - EFEITOS SONOROS/',
  '@sw/': 'D:/YT/!Assets/Swoosh effects/',
  '@mus/': 'D:/YT/!Assets/Musicas/',
  '@clipe/': join(PROJ, '03-clipe-belchior') + '/',
  '@camadas/': join(PROJ, '05-camadas-prontas') + '/',
};

const n = (process.argv[2] || '').padStart(2, '0');
if (!/^\d\d$/.test(n)) { console.error('Uso: bun kit/preparar.mjs <XX> [--sem-mix]'); process.exit(1); }
const trecho = join(VIDEO, 'output', `trecho-${n}`);
const hf = join(trecho, 'hf');
const A = (p) => { mkdirSync(dirname(p), { recursive: true }); return p; };

// 1. kit
copyFileSync(join(KIT, 'almoco.js'), A(join(hf, 'assets/kit/almoco.js')));
copyFileSync(join(KIT, 'almoco.css'), A(join(hf, 'assets/kit/almoco.css')));
copyFileSync(join(KIT, 'papel.svg'), A(join(hf, 'assets/kit/papel.svg')));
for (const f of readdirSync(join(KIT, 'fonts'))) copyFileSync(join(KIT, 'fonts', f), A(join(hf, 'assets/fonts', f)));
const id = `na-hora-do-almoco-trecho-${n}`;
if (!existsSync(join(hf, 'package.json'))) writeFileSync(join(hf, 'package.json'), JSON.stringify({ name: id, private: true, type: 'module' }, null, 2));
if (!existsSync(join(hf, 'meta.json'))) writeFileSync(join(hf, 'meta.json'), JSON.stringify({ id, name: id }, null, 2));
if (!existsSync(join(hf, 'hyperframes.json'))) writeFileSync(join(hf, 'hyperframes.json'), JSON.stringify({ paths: { blocks: 'compositions', assets: 'assets' }, media: { autoProxy: true } }, null, 2));

// letra (01-roteiro/letra.txt -> assets/letra.js). Sem a letra oficial, usa so os versos citados na narracao.
const letraTxt = join(PROJ, '01-roteiro', 'letra.txt');
let versos = existsSync(letraTxt)
  ? readFileSync(letraTxt, 'utf8').split(/\r?\n/).filter((l) => !l.startsWith('#')).map((l) => l.trim())
  : [];
while (versos.length && !versos[0]) versos.shift();
while (versos.length && !versos[versos.length - 1]) versos.pop();
if (!versos.length) {
  // Sem a letra oficial: usa a transcricao automatica do clipe (03-clipe-belchior/letra-com-tempos.txt), com as
  // correcoes que o roteiro do narrador confirma. Colar a letra oficial em letra.txt substitui tudo isso.
  console.warn('letra.txt vazio: folha com a transcricao automatica do clipe (tem erros de ouvido). Cole a letra oficial em 01-roteiro/letra.txt.');
  const tempos = readFileSync(join(PROJ, '03-clipe-belchior', 'letra-com-tempos.txt'), 'utf8').split(/\r?\n/);
  const corrige = [[/com medo e tristeza/i, 'comida e tristeza'], [/^Placada e selada, e molhada/i, 'Lacrada e selada e molhada'], [/^Vai na cabecinha$/i, 'O pai na cabeceira'], [/cabileira/i, 'cabeleira'], [/^Vem, mo[cç]o$/i, 'Ei, moço']];
  const quebraEstrofe = new Set(['00:58.40', '01:17.40', '01:33.40', '01:56.40']);
  versos = [];
  for (const l of tempos) {
    const m = l.match(/^\[(\d\d:\d\d\.\d\d) - [^\]]+\]\s*(.*)$/);
    if (!m || /^m[uú]sica$/i.test(m[2].trim())) continue;
    if (quebraEstrofe.has(m[1]) && versos.length) versos.push('');
    // a transcricao junta dois versos numa linha: separa onde uma maiuscula segue uma minuscula
    for (let v of m[2].trim().split(/(?<=[a-zà-ú,])\s+(?=[A-ZÀ-Ú])/)) {
      for (const [re, por] of corrige) v = v.replace(re, por);
      versos.push(v);
    }
  }
}
writeFileSync(A(join(hf, 'assets/letra.js')), `window.LETRA = ${JSON.stringify(versos, null, 1)};\n`);

// marcas acumuladas da folha da letra: junta output/trecho-NN/marcas.js de todos os trechos ate este
const marcas = readdirSync(join(VIDEO, 'output'))
  .filter((d) => /^trecho-\d\d$/.test(d) && d <= `trecho-${n}` && existsSync(join(VIDEO, 'output', d, 'marcas.js')))
  .sort()
  .map((d) => `// ${d}\n` + readFileSync(join(VIDEO, 'output', d, 'marcas.js'), 'utf8'));
writeFileSync(A(join(hf, 'assets/marcas.js')),
  `Almoco.MARCAS = {};\n${marcas.join('\n')}\n` +
  `// desenha todas as marcas ate o trecho atual; as de trechos anteriores ja prontas\n` +
  `Almoco.marcasAte = function (tl, F, atual) { Object.keys(Almoco.MARCAS).sort().forEach(function (k) { Almoco.MARCAS[k](tl, F, k !== atual); }); };\n`);

// 2. imagens citadas
const html = [join(hf, 'index.html'), ...readdirSync(join(hf, 'compositions')).map((f) => join(hf, 'compositions', f))]
  .map((f) => readFileSync(f, 'utf8')).join('\n');
const nomes = new Set();
for (const m of html.matchAll(/[IDF]\('([\w.-]+)'\)|img:\s*'([\w.-]+)'|assets\/img\/([\w.-]+)\.png/g)) nomes.add(m[1] || m[2] || m[3]);
let faltando = 0;
for (const nome of nomes) {
  const img = ['agy', 'frames'].map((d) => join(ASSETS, d, `${nome}.png`)).find(existsSync);
  if (!img) { console.warn('imagem nao encontrada:', nome); faltando++; continue; }
  copyFileSync(img, A(join(hf, 'assets/img', `${nome}.png`)));
  const dep = join(ASSETS, 'depth', `${nome}-depth.png`);
  if (existsSync(dep)) copyFileSync(dep, A(join(hf, 'assets/depth', `${nome}-depth.png`)));
  else console.warn('sem profundidade:', nome);
}
console.log(`kit + ${nomes.size} imagens copiadas${faltando ? ` (${faltando} faltando)` : ''}`);

// video real do clipe (4:3, so imagem) quando alguma cena usa assets/video/clipe.mp4
if (html.includes('assets/video/clipe.mp4')) {
  const dst = A(join(hf, 'assets/video/clipe.mp4'));
  if (!existsSync(dst)) copyFileSync(join(PROJ, '03-clipe-belchior', 'so-video', 'clipe-so-video.mp4'), dst);
  console.log('video do clipe copiado');
}
// overlays vintage da pasta de assets (assets/video/<nome>.mp4), remuxados sem audio
const VIDEOS = {
  'vintage.mp4': 'D:/YT/!Assets/MESTRES DO VINTADE/dust grunge pulse.mp4',   // 101 s de poeira/pulso, cobre qualquer trecho
  'ruido.mp4': 'D:/YT/!Assets/MESTRES DO VINTADE/Noise 2.mov',               // 15 s de ruido de TV, para os glitches
};
for (const [nome, src] of Object.entries(VIDEOS)) {
  if (!html.includes('assets/video/' + nome)) continue;
  const dst = A(join(hf, 'assets/video', nome));
  if (!existsSync(dst)) spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-an', '-c:v', 'copy', '-movflags', '+faststart', dst], { stdio: 'inherit' });
  console.log('overlay copiado:', nome);
}

// 3. mix
if (process.argv.includes('--sem-mix')) process.exit(0);
const sonsPath = join(trecho, 'sons.json');
if (!existsSync(sonsPath)) { console.warn('sem sons.json: mix nao gerado'); process.exit(0); }
const sons = JSON.parse(readFileSync(sonsPath, 'utf8'));
const resolve = (f) => {
  if (f === '@narr') return join(trecho, 'midia', 'narracao.wav');
  for (const [k, v] of Object.entries(ALIAS)) if (f.startsWith(k)) return v + f.slice(k.length);
  return f;
};
const envExpr = (env) => {
  // dB linear por partes, t = tempo do trecho
  let e = String(env[env.length - 1][1]);
  for (let i = env.length - 2; i >= 0; i--) {
    const [t0, g0] = env[i], [t1, g1] = env[i + 1];
    e = `if(lt(t,${t1}),${g0}+(${g1 - g0})*(t-${t0})/${Math.max(0.001, t1 - t0)},${e})`;
  }
  return `if(lt(t,${env[0][0]}),${env[0][1]},${e})`;
};
// --- regras globais de som (feedback 03/11): efeitos menos secos, menos rumble repetido, musica sempre com fade ---
const ehSfx = (f) => f.startsWith('@sfx/') || f.startsWith('@sw/');
const ehMus = (f) => f.startsWith('@clipe/') || f.startsWith('@mus/');
const durCache = new Map();
const durDe = (file) => {
  if (!durCache.has(file)) {
    const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    durCache.set(file, parseFloat(p.stdout) || 0);
  }
  return durCache.get(file);
};
let ultimoRumble = -9;
sons.cues = sons.cues.filter((c) => {
  if (!/Low End Rumble 01/.test(c.file)) return true;
  if ((c.at || 0) - ultimoRumble < 1.5) return false; // rumbles em rajada: so o primeiro toca
  ultimoRumble = c.at || 0;
  return true;
}).map((c0) => {
  const c = { ...c0 };
  const file = resolve(c.file);
  const sobra = () => Math.max(0.1, Math.min(durDe(file) - (c.from || 0), sons.dur - (c.at || 0)));
  if (ehSfx(c.file)) {
    c.gain = (c.gain || 0) - 4;                       // 14 a 20 dB abaixo da voz
    if (!c.fadeIn) c.fadeIn = 0.04;
    if (!c.len) c.len = sobra();
    if (!c.fadeOut) c.fadeOut = Math.min(0.25, c.len * 0.5);
  } else if (ehMus(c.file)) {
    if (!c.len) c.len = sobra();
    const continua = (c.at || 0) === 0 && (c.from || 0) > 0;   // ja vinha tocando do trecho anterior
    if (!continua) c.fadeIn = Math.max(c.fadeIn || 0, 1.2);
    const segue = (c.at || 0) + c.len >= sons.dur - 0.05;       // continua no proximo trecho
    if (!segue) c.fadeOut = Math.max(c.fadeOut || 0, 1.5);
  }
  return c;
});

const args = ['-hide_banner', '-loglevel', 'error', '-y'];
const parts = [];
sons.cues.forEach((c, i) => {
  const file = resolve(c.file);
  if (!existsSync(file)) throw new Error(`audio nao encontrado: ${file}`);
  args.push('-i', file);
  const f = [`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo`];
  if (c.from || c.len) f.push(`atrim=start=${c.from || 0}${c.len ? `:duration=${c.len}` : ''}`, 'asetpts=PTS-STARTPTS');
  // "fx": "radio" = timbre de radio antigo, leve (tira grave e brilho; a letra continua entendivel). Escolha de mixagem
  // para a musica cantada nao disputar com a narracao; NAO e ajustado para escapar de Content ID.
  if (c.fx === 'radio') f.push('highpass=f=220', 'lowpass=f=3800');
  if (c.fadeIn) f.push(`afade=t=in:d=${c.fadeIn}`);
  if (c.fadeOut && c.len) f.push(`afade=t=out:st=${Math.max(0, c.len - c.fadeOut)}:d=${c.fadeOut}`);
  if (c.gain) f.push(`volume=${c.gain}dB`);
  const ms = Math.round((c.at || 0) * 1000);
  if (ms > 0) f.push(`adelay=${ms}|${ms}`);
  if (c.env) f.push(`volume='pow(10,(${envExpr(c.env)})/20)':eval=frame`);
  parts.push(f.join(',') + `[a${i}]`);
});
const ins = sons.cues.map((_, i) => `[a${i}]`).join('');
parts.push(`${ins}amix=inputs=${sons.cues.length}:normalize=0:dropout_transition=0,apad,atrim=duration=${sons.dur},alimiter=limit=0.95:level=false[out]`);
const script = join(trecho, 'midia', 'mix.filter');
writeFileSync(script, parts.join(';\n'));
const out = A(join(hf, 'assets/audio/mix.wav'));
const r = spawnSync('ffmpeg', [...args, '-filter_complex_script', script, '-map', '[out]', '-t', String(sons.dur), '-ar', '48000', '-c:a', 'pcm_s16le', out], { stdio: 'inherit' }); // -t: trava de seguranca (um mix.wav de trecho 10 chegou a 153 GB em 06/11)
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('mix:', out);
