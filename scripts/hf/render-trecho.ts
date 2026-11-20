/**
 * Checa e renderiza o projeto HyperFrames de um trecho.
 *
 * Uso: bun run hf:render <video> <trecho> [--draft] [--alpha | --so-alpha] [--cpu]
 *   -> <trecho>/render/<video>-trecho-XX.mp4        (video pronto do trecho, 1920x1080, com o audio)
 *
 * Padrao desde 17/11/2026: SO o MP4. A entrega e o video pronto; o MOV transparente deixou de ser gerado
 * (pedido do usuario: "o fundo transparente perdeu o sentido agora, ja que eu quero o video pronto").
 *   --alpha     gera tambem <video>-trecho-XX-alpha.mov (ProRes 4444 transparente), se um dia precisar sobrepor
 *   --so-alpha  gera so o MOV transparente
 *   --so-preto  aceito por compatibilidade: e o padrao, nao muda nada
 *
 * Placa de video (RTX 3050), SEMPRE ligada:
 *   - o Chrome que desenha os quadros roda na placa (--browser-gpu, falha alto se cair para software);
 *   - o MP4 e codificado na NVENC (--gpu) a 50 Mbps, mesma qualidade do x264 CRF 15 que era usado.
 *   So o MOV ProRes 4444 (--alpha) e codificado na CPU: a NVENC nao grava ProRes nem canal alfa.
 *   --cpu (x264 na CPU) e so para quando a placa falhar, por exemplo se o driver da NVIDIA der problema.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const HF_VERSION = '0.8.193';
// NVENC: com --gpu o HyperFrames 0.8.193 passa "-cq" sem "-b:v 0", e a NVENC trava em ~16 Mbps qualquer que seja o cq
// (cq 8, 11 e 15 deram o mesmo arquivo: 39,7 dB contra 44,6 dB do x264 CRF 15, medido no trecho 05 contra PNG sem perdas).
// Com bitrate explicito de 50 Mbps deu 44,4 dB, o mesmo tamanho e qualidade do x264 de antes. Rascunho (--draft) fica no padrao.
const NVENC_BITRATE = '50M';
const ROOT = resolve(import.meta.dir, '..', '..');
const args = process.argv.slice(2);
const [video, trechoArg] = args.filter((a) => !a.startsWith('--'));
if (!video || !trechoArg) {
  console.error('Uso: bun run hf:render <video> <trecho> [--draft] [--alpha | --so-alpha] [--cpu]');
  process.exit(1);
}
const trecho = `trecho-${trechoArg.padStart(2, '0')}`;
const dir = join(ROOT, 'videos', video, 'output', trecho);
const hfDir = join(dir, 'hf');
if (!existsSync(join(hfDir, 'index.html'))) {
  console.error(`Projeto nao encontrado: ${hfDir}. Rode antes: bun run hf:build ${video} ${trechoArg}`);
  process.exit(1);
}
const out = join(dir, 'render');
mkdirSync(out, { recursive: true });
const draft = args.includes('--draft');
const quality = draft ? 'draft' : 'delivery';
const cpu = args.includes('--cpu') || process.env.ALMOCO_CPU === '1';
const env = cpu ? process.env : { ...process.env, PRODUCER_BROWSER_GPU_MODE: 'hardware' };
const hf = (...a: string[]) => spawnSync('npx', ['-y', `hyperframes@${HF_VERSION}`, ...a], { cwd: hfDir, stdio: 'inherit', shell: true, env });
const gpuChrome = cpu ? [] : ['--browser-gpu'];
const gpuMp4 = cpu ? [] : ['--gpu', ...(draft ? [] : ['--video-bitrate', NVENC_BITRATE])];
const soAlpha = args.includes('--so-alpha');
const comAlpha = soAlpha || args.includes('--alpha'); // padrao: so o MP4 (video pronto)
console.log(cpu ? '> modo CPU (x264): use so se a placa falhou' : '> placa de video: Chrome na RTX + MP4 na NVENC');

console.log('> check');
const check = hf('check', '--json');
if (check.status !== 0) {
  console.error('check falhou: corrija os erros antes de renderizar.');
  process.exit(check.status ?? 1);
}
const base = `${video}-${trecho}`;
if (!soAlpha) {
  console.log('> render MP4 (video pronto do trecho)');
  const r = hf('render', '-o', JSON.stringify(join(out, `${base}.mp4`)), '-q', quality, ...gpuChrome, ...gpuMp4, '--quiet');
  if (r.status !== 0) { console.error('render do MP4 falhou'); process.exit(r.status ?? 1); }
}
if (comAlpha) {
  console.log('> render MOV transparente (ProRes 4444, na CPU)');
  const r = hf('render', '--format', 'mov', '--variables', `"{\\"transparente\\":true}"`, '-o', JSON.stringify(join(out, `${base}-alpha.mov`)), ...gpuChrome, '--quiet');
  if (r.status !== 0) { console.error('render do MOV falhou'); process.exit(r.status ?? 1); }
}
console.log(`Pronto: ${out}`);
