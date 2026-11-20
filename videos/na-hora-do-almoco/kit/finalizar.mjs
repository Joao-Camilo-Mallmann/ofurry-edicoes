/**
 * Fecha o video de uma vez:
 *   [--3d] gera as cenas 3D (A31-A36) com o agy, faz os mapas de profundidade e encaixa os B-rolls
 *   1. checa os trechos que vao renderizar (para antes de gastar tempo se algum tiver erro)
 *   2. renderiza SO os trechos cuja imagem mudou desde o ultimo render (so o MP4, na placa de video)
 *   3. monta o final 1080p na RAIZ do projeto (a versao anterior vai para versoes-antigas/na-hora-do-almoco-vN-<data>.mp4)
 *   4. faz a copia leve para o celular (abaixo de 30 MB)
 *   5. avisa quais musicas do Infraction entraram (credito obrigatorio na descricao: ver DESCRICAO-YOUTUBE.md na pasta do projeto)
 *
 * Desde 17/11/2026 a entrega e so o video pronto: o MOV transparente e as camadas do Filmora (stems + WebM com alfa)
 * nao sao mais gerados (pedido do usuario). O kit/camadas.mjs ficou guardado, fora de uso.
 *
 * "Mudou" = a impressao visual do trecho (index.html + compositions/*.html + kit almoco.js/css) e diferente da
 * gravada em render/.impressao-visual no ultimo render. Mudanca so de som (sons.json, mix.wav) nao precisa de
 * render: o montar.mjs pega o mix.wav novo direto.
 *
 * Uso (rode na pasta animation-to-yt):
 *   bun videos/na-hora-do-almoco/kit/finalizar.mjs             tudo (sem as cenas 3D)
 *   bun videos/na-hora-do-almoco/kit/finalizar.mjs --3d        antes, as cenas 3D com o agy (precisa da cota do Nano Banana)
 *   bun videos/na-hora-do-almoco/kit/finalizar.mjs --plano     so mostra o que faria, nao roda nada
 *   bun videos/na-hora-do-almoco/kit/finalizar.mjs --forcar 05 08   renderiza esses mesmo sem mudanca
 *   bun videos/na-hora-do-almoco/kit/finalizar.mjs --so-render      para depois do render (nao monta)
 *   bun videos/na-hora-do-almoco/kit/finalizar.mjs --sem-render     so monta/celular com o que ja esta renderizado
 *   bun videos/na-hora-do-almoco/kit/finalizar.mjs --marcar 04 61   grava "render em dia" nesses trechos sem renderizar
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encH264Bitrate } from './gpu.mjs';

const KIT = dirname(fileURLToPath(import.meta.url));
const VIDEO = join(KIT, '..');
const ROOT = join(VIDEO, '..', '..');
const PROJ = 'D:/YT/Matheus (Alves)/hora do armoco';
const AGY = join(PROJ, '06-montagem', 'assets', 'agy');
const DEPTH = join(PROJ, '06-montagem', 'assets', 'depth');
const PY_DEPTH = 'C:/Users/jcami/.venvs/depth/Scripts/python.exe';
const ORDEM = ['01', '02', '03', '04', '05', '06', '61', '07', '08', '09', '10'];
const FINAL = join(PROJ, 'na-hora-do-almoco-final.mp4');
const ANTIGAS = join(PROJ, 'versoes-antigas');            // versoes anteriores do final, fora da raiz
const DESCRICAO = join(PROJ, 'DESCRICAO-YOUTUBE.md');      // o que vai na descricao do YouTube (creditos Infraction)
const CELULAR = join(PROJ, '06-montagem', 'previas', 'video-completo-celular.mp4');
const CENAS_3D = ['A31-3d-copo-mesa-sal', 'A32-3d-cadeira-horizonte', 'A33-3d-cortina-janela', 'A34-3d-radio-janela', 'A35-3d-vinil-sala', 'A36-3d-corredor-portas'];

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const listaApos = (f) => { const i = args.indexOf(f); if (i < 0) return []; const out = []; for (const a of args.slice(i + 1)) { if (a.startsWith('--')) break; out.push(a.padStart(2, '0')); } return out; };
const PLANO = flag('--plano');
const forcar = listaApos('--forcar');
const marcar = listaApos('--marcar');
const t0 = Date.now();
const passo = (s) => console.log(`\n=== ${s}  (${Math.round((Date.now() - t0) / 60000)} min)`);
const roda = (cmd, a, opts = {}) => {
  console.log('>', cmd, a.join(' '));
  if (PLANO) return 0;
  const r = spawnSync(cmd, a, { stdio: 'inherit', ...opts });
  return r.status ?? 1;
};
const morre = (msg) => { console.error('\nPAROU: ' + msg); process.exit(1); };

const hf = (n) => join(VIDEO, 'output', `trecho-${n}`, 'hf');
const renderDir = (n) => join(VIDEO, 'output', `trecho-${n}`, 'render');
const mp4 = (n) => join(renderDir(n), `na-hora-do-almoco-trecho-${n}.mp4`);
const marca = (n) => join(renderDir(n), '.impressao-visual');

// impressao visual: o que muda a imagem do trecho. Uma camada de B-roll vazia (sem nenhum canvas) nao conta.
function impressao(n) {
  const h = createHash('sha1');
  const comp = join(hf(n), 'compositions');
  const brolls = join(comp, 'brolls.html');
  const brollsVazio = existsSync(brolls) && !readFileSync(brolls, 'utf8').includes('<canvas');
  // o HyperFrames Studio carimba data-hf-id="..." nos elementos ao abrir o trecho; isso nao muda a imagem
  const semIds = (html) => html.replace(/ data-hf-id="[^"]*"/g, '');
  let index = semIds(readFileSync(join(hf(n), 'index.html'), 'utf8'));
  if (brollsVazio) index = index.replace(/^[ \t]*<div id="brolls"[^\n]*\n/m, '');
  h.update(index);
  for (const f of readdirSync(comp).filter((f) => f.endsWith('.html')).sort()) {
    if (f === 'brolls.html' && brollsVazio) continue;
    h.update(f).update(semIds(readFileSync(join(comp, f), 'utf8')));
  }
  // imagens dos B-rolls: se uma for refeita com o mesmo nome, o tamanho muda
  if (!brollsVazio && existsSync(brolls)) for (const m of readFileSync(brolls, 'utf8').matchAll(/img: '([^']+)'/g)) {
    const p = join(AGY, m[1] + '.png'); if (existsSync(p)) h.update(m[1] + statSync(p).size);
  }
  for (const f of ['almoco.js', 'almoco.css']) h.update(readFileSync(join(KIT, f)));
  return h.digest('hex');
}
const emDia = (n) => existsSync(mp4(n)) && existsSync(marca(n)) && readFileSync(marca(n), 'utf8').trim() === impressao(n);

// --marcar: so grava a impressao (trechos cujo render atual ja esta certo)
if (marcar.length) {
  for (const n of marcar) {
    if (!existsSync(mp4(n))) morre(`trecho-${n} nao tem render para marcar`);
    writeFileSync(marca(n), impressao(n));
    console.log(`trecho-${n}: marcado como render em dia`);
  }
  process.exit(0);
}

// --- [--3d] cenas 3D com o agy ---------------------------------------------------------------------------------
if (flag('--3d')) {
  passo('cenas 3D (agy + Nano Banana)');
  const faltam = CENAS_3D.filter((c) => !existsSync(join(AGY, c + '.png')));
  if (faltam.length) {
    const prompt = join(KIT, 'agy-cenas-3d.txt').replace(/\//g, '\\');
    const ps = `Set-Location '${PROJ.replace(/\//g, '\\')}'; $p = Get-Content -Raw -Encoding UTF8 '${prompt}'; $p | & agy --mode accept-edits --print-timeout 0s`;
    roda('powershell', ['-NoProfile', '-Command', ps]);
  } else console.log('as 6 cenas 3D ja existem');
  const novas = CENAS_3D.filter((c) => PLANO || existsSync(join(AGY, c + '.png')));
  const semDepth = novas.filter((c) => !existsSync(join(DEPTH, c + '-depth.png')));
  if (!PLANO && novas.length < CENAS_3D.length) console.warn('ainda faltam (cota?):', CENAS_3D.filter((c) => !novas.includes(c)).join(', '), '-> seguem sem elas');
  if (semDepth.length) roda(PY_DEPTH, ['-I', join(KIT, 'profundidade.py'), AGY, DEPTH, ...semDepth.map((c) => c + '.png')]);
  const com3d = Object.entries(JSON.parse(readFileSync(join(KIT, 'brolls.json'), 'utf8')))
    .filter(([k, v]) => !k.startsWith('_') && v.some((p) => CENAS_3D.includes(p.img))).map(([k]) => k);
  if (roda('bun', [join(KIT, 'brolls.mjs'), ...com3d]) !== 0) morre('brolls.mjs falhou');
  for (const n of com3d) if (roda('bun', [join(KIT, 'preparar.mjs'), n]) !== 0) morre(`preparar ${n} falhou`);
}

// --- 1 e 2: check + render seletivo -------------------------------------------------------------------------------
if (!flag('--sem-render')) {
  const fila = ORDEM.filter((n) => forcar.includes(n) || !emDia(n));
  passo(`render: ${fila.length ? fila.join(' ') : 'nenhum (tudo em dia)'}${ORDEM.filter((n) => !fila.includes(n)).length ? '  | em dia: ' + ORDEM.filter((n) => !fila.includes(n)).join(' ') : ''}`);
  for (const n of fila) {
    if (!existsSync(join(hf(n), 'assets', 'audio', 'mix.wav'))) morre(`trecho-${n} sem mix.wav: rode bun kit/preparar.mjs ${n}`);
    console.log(`check trecho-${n}`);
    if (roda('npx', ['-y', 'hyperframes@0.8.193', 'check', '--json'], { cwd: hf(n), shell: true, stdio: ['ignore', 'ignore', 'inherit'] }) !== 0)
      morre(`check do trecho-${n} com erro. Veja: cd output/trecho-${n}/hf && npx -y hyperframes@0.8.193 check`);
  }
  for (const n of fila) {
    const antes = Date.now();
    roda('bun', ['run', 'hf:render', 'na-hora-do-almoco', n], { cwd: ROOT, shell: true });
    if (PLANO) continue;
    if (!existsSync(mp4(n)) || statSync(mp4(n)).mtimeMs < antes) morre(`render do trecho-${n} nao gerou ${mp4(n)}`);
    writeFileSync(marca(n), impressao(n));
    console.log(`trecho-${n} pronto em ${Math.round((Date.now() - antes) / 60000)} min`);
  }
  if (flag('--so-render')) { passo('fim (--so-render)'); process.exit(0); }
} else {
  const atrasados = ORDEM.filter((n) => !emDia(n));
  if (atrasados.length) console.warn(`AVISO --sem-render: a imagem destes trechos esta desatualizada em relacao ao codigo: ${atrasados.join(' ')}`);
}

// --- 3: final na raiz -----------------------------------------------------------------------------------------------
passo('montagem final (raiz)');
if (existsSync(FINAL)) {
  if (!PLANO) mkdirSync(ANTIGAS, { recursive: true });
  const versoes = (dir) => existsSync(dir) ? readdirSync(dir).map((f) => Number((f.match(/^na-hora-do-almoco-v(\d+)-/) || [])[1] || 0)) : [];
  const v = 1 + Math.max(0, ...versoes(ANTIGAS), ...versoes(PROJ));
  const d = new Date(statSync(FINAL).mtimeMs);
  const data = String(d.getDate()).padStart(2, '0') + ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][d.getMonth()];
  const antigo = join(ANTIGAS, `na-hora-do-almoco-v${v}-${data}.mp4`);
  console.log(`versao anterior -> ${antigo}`);
  if (!PLANO) renameSync(FINAL, antigo);
}
if (roda('bun', [join(KIT, 'montar.mjs'), 'na-hora-do-almoco-final', ...ORDEM, '--final', '--rapido']) !== 0) morre('montar falhou');

// --- 4: copia leve para o celular (2 passadas, 1280 px, ~430 kbps) --------------------------------------------------
passo('copia para o celular');
const log = join(PROJ, '06-montagem', 'previas', 'celular-2pass');
const nv = encH264Bitrate(405); // NVENC: uma passada so (multipass interno); 460k deu 32,4 MB em 7:16 (acima de 30), 405k deu 26,4 MB
if (nv) {
  if (roda('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', FINAL, '-vf', 'scale=1280:-2', ...nv, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', CELULAR]) !== 0) morre('ffmpeg (NVENC) falhou');
} else {
  const base = ['-hide_banner', '-loglevel', 'error', '-y', '-i', FINAL, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-b:v', '430k', '-passlogfile', log];
  if (roda('ffmpeg', [...base, '-pass', '1', '-an', '-f', 'mp4', 'NUL']) !== 0) morre('ffmpeg passada 1 falhou');
  if (roda('ffmpeg', [...base, '-pass', '2', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', CELULAR]) !== 0) morre('ffmpeg passada 2 falhou');
}
if (!PLANO) {
  for (const f of readdirSync(dirname(log)).filter((f) => f.startsWith('celular-2pass'))) unlinkSync(join(dirname(log), f));
  const mb = statSync(CELULAR).size / 1e6;
  console.log(`celular: ${mb.toFixed(1)} MB${mb > 30 ? '  (ACIMA de 30 MB: baixe o -b:v)' : ''}`);
}

passo('pronto');
console.log(`final:   ${FINAL}\ncelular: ${CELULAR}\nantigas: ${ANTIGAS}`);

// --- 5: aviso obrigatorio (AGENTS.md 0.2): musica do Infraction so pode ir ao ar com credito + link de "remove claim" ---
const infraction = new Map();
for (const n of ORDEM) for (const c of JSON.parse(readFileSync(join(VIDEO, 'output', `trecho-${n}`, 'sons.json'), 'utf8')).cues) {
  if (!/^@mus\/Infraction - No Copyright Music\//.test(c.file)) continue;
  const nome = c.file.split('/').pop().replace(/\.(mp4|mp3|wav)$/i, '');
  if (!infraction.has(nome)) infraction.set(nome, new Set());
  infraction.get(nome).add(n);
}
if (infraction.size) {
  console.log('\n*** ATENCAO: musicas do Infraction neste video. A descricao do YouTube TEM que ter, para cada uma,');
  console.log('*** nome + link do YouTube da musica + link de "remove claim" do inaudio.org. Sem isso o claim fica');
  console.log('*** permanente e o video perde a monetizacao. Nunca apague esse texto da descricao depois.');
  for (const [nome, ts] of infraction) console.log(`***   - ${nome}  (trecho${ts.size > 1 ? 's' : ''} ${[...ts].join(', ')})`);
  console.log(`*** Texto pronto para colar e passo a passo: ${DESCRICAO}`);
}
