/**
 * Renderiza SO um pedaco de um trecho e encaixa no MP4 do trecho (o resto nao e renderizado de novo).
 * Usa a API interna de render distribuido do HyperFrames (plan -> renderChunk com frameRange).
 *
 * Uso (na pasta animation-to-yt):
 *   bun videos/na-hora-do-almoco/kit/render-parte.mjs 08 12.5 16      (trecho 08, de 12,5 s a 16 s)
 * Depois: bun videos/na-hora-do-almoco/kit/finalizar.mjs   (monta rapido, sem reencodar o video)
 *
 * So mexe no MP4, que e o que vai para o video final (o MOV transparente nao e mais gerado desde 17/11/2026).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { encH264 } from './gpu.mjs';

const KIT = dirname(fileURLToPath(import.meta.url));
const VIDEO = join(KIT, '..');
const HF_DIST = join(process.env.LOCALAPPDATA, 'npm-cache/_npx/30c7b206fa5e0143/node_modules/hyperframes/dist/chunk-6DLCOQR4.js');
const [tArg, iniArg, fimArg] = process.argv.slice(2);
if (!tArg || iniArg == null || fimArg == null) { console.error('Uso: bun kit/render-parte.mjs <XX> <inicio_s> <fim_s>'); process.exit(1); }
const n = tArg.padStart(2, '0');
const hf = join(VIDEO, 'output', `trecho-${n}`, 'hf');
const mp4 = join(VIDEO, 'output', `trecho-${n}`, 'render', `na-hora-do-almoco-trecho-${n}.mp4`);
if (!existsSync(HF_DIST)) { console.error('nao achei o HyperFrames 0.8.193 em', HF_DIST, '(rode uma vez: npx -y hyperframes@0.8.193 --version)'); process.exit(1); }
if (!existsSync(mp4)) { console.error('trecho sem render completo ainda:', mp4); process.exit(1); }

const FPS = 30, CHUNK = 150;
const ini = Math.max(0, Math.floor(Number(iniArg) * FPS)), fim = Math.ceil(Number(fimArg) * FPS);
const tmp = join(tmpdir(), `hf-parte-${n}-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
const { plan, renderChunk } = await import(pathToFileURL(HF_DIST).href);

console.log(`> plano do trecho-${n}`);
await plan(hf, { fps: FPS, width: 1920, height: 1080, format: 'mp4', quality: 'high', chunkSize: CHUNK }, join(tmp, 'plan'));
const total = JSON.parse(readFileSync(join(tmp, 'plan', 'meta', 'chunks.json'), 'utf8'));
const chunks = Array.isArray(total) ? total : total.chunks;
const ultimo = Math.max(...chunks.map((c) => c.endFrame ?? c.end));
const b = Math.min(fim, ultimo);

// um pedaco por chunk tocado (o frameRange tem que caber dentro de um chunk)
const partes = [];
for (let c = Math.floor(ini / CHUNK); c * CHUNK < b; c++) {
  const s = Math.max(ini, c * CHUNK), e = Math.min(b, (c + 1) * CHUNK);
  const out = join(tmp, `p${c}.mp4`);
  console.log(`> render frames ${s}-${e} (chunk ${c})`);
  await renderChunk(join(tmp, 'plan'), c, out, s === c * CHUNK && e === (c + 1) * CHUNK ? undefined : { frameRange: { startFrame: s, endFrame: e } });
  partes.push(out);
}
// encaixa: antigo [0, ini) + novo [ini, b) + antigo [b, fim do trecho); reencoda so este trecho na NVENC (segundos)
// (a captura do pedaco continua no Chrome em software: o render distribuido do HyperFrames exige SwiftShader)
const lista = join(tmp, 'novo.txt');
writeFileSync(lista, partes.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
const novo = mp4.replace(/\.mp4$/, '.novo.mp4');
const fc = `[0:v]trim=end_frame=${ini},setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[m];[0:v]trim=start_frame=${b},setpts=PTS-STARTPTS[z];[a][m][z]concat=n=3:v=1:a=0,format=yuv420p[v]`;
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', mp4, '-f', 'concat', '-safe', '0', '-i', lista, '-filter_complex', fc,
  '-map', '[v]', '-map', '0:a?', ...encH264('mestre'), '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'copy', '-movflags', '+faststart', novo], { stdio: 'inherit' });
if (r.status !== 0) { console.error('falhou ao encaixar'); process.exit(1); }
renameSync(novo, mp4);
rmSync(tmp, { recursive: true, force: true });
// grava a impressao visual nova, para o finalizar nao renderizar o trecho inteiro de novo
spawnSync('bun', [join(KIT, 'finalizar.mjs'), '--marcar', n], { stdio: 'inherit' });
console.log(`pronto: trecho-${n} com ${(ini / FPS).toFixed(2)}-${(b / FPS).toFixed(2)} s refeitos -> ${mp4}`);
