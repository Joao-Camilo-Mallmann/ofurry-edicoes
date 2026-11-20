/**
 * Encoder de video na placa (RTX 3050 -> NVENC), com volta automatica para a CPU (libx264)
 * se a NVENC nao responder. Para forcar a CPU: defina ALMOCO_CPU=1 antes do comando.
 *
 *   import { encH264, encH264Bitrate, temNvenc } from './gpu.mjs';
 *   spawnSync('ffmpeg', [..., ...encH264('final'), out]);
 */
import { spawnSync } from 'node:child_process';

let cache;
export function temNvenc() {
  if (cache !== undefined) return cache;
  if (process.env.ALMOCO_CPU === '1') return (cache = false);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=black:s=1280x720:d=0.3',
    '-c:v', 'h264_nvenc', '-preset', 'p6', '-rc', 'vbr', '-cq', '18', '-b:v', '0', '-bf', '3', '-b_ref_mode', 'middle',
    '-spatial-aq', '1', '-temporal-aq', '1', '-f', 'null', '-'], { stdio: 'ignore' });
  cache = r.status === 0;
  console.log(cache ? '[gpu] video na placa (NVENC)' : '[gpu] NVENC indisponivel: usando libx264 na CPU');
  return cache;
}

// cq da NVENC calibrado contra o x264 num render sem perdas do trecho 05 (PSNR Y):
//   x264 CRF 15 = 44,6 dB / 49 Mbps   NVENC cq 13 = 44,2 dB / 46 Mbps   cq 10 = 46,5 dB / 64 Mbps   cq 17 = 41,7 dB
// A NVENC oscila mais nos quadros dificeis (min 40 dB contra 43,5), por isso fica 1 ponto abaixo do equivalente.
const PERFIS = {
  mestre: { cq: 11, preset: 'p6', crf: 14, x264: 'medium' }, // trechos que depois sao so copiados no final
  final: { cq: 12, preset: 'p6', crf: 16, x264: 'slow' },
  previa: { cq: 24, preset: 'p4', crf: 27, x264: 'medium' },
};
const NV_COMUM = ['-tune', 'hq', '-spatial-aq', '1', '-temporal-aq', '1', '-rc-lookahead', '32', '-bf', '3', '-b_ref_mode', 'middle', '-profile:v', 'high'];

/** H.264 por qualidade constante. */
export function encH264(perfil = 'final') {
  const p = PERFIS[perfil] ?? PERFIS.final;
  if (temNvenc()) return ['-c:v', 'h264_nvenc', '-preset', p.preset, '-rc', 'vbr', '-cq', String(p.cq), '-b:v', '0', '-maxrate', '120M', '-bufsize', '240M', ...NV_COMUM];
  return ['-c:v', 'libx264', '-preset', p.x264, '-crf', String(p.crf), '-profile:v', 'high'];
}

/**
 * H.264 com bitrate alvo (copia leve). Na placa e uma passada so com multipass interno;
 * na CPU devolve null e quem chama faz as 2 passadas do x264.
 */
export function encH264Bitrate(kbps) {
  if (!temNvenc()) return null;
  return ['-c:v', 'h264_nvenc', '-preset', 'p7', '-rc', 'vbr', '-multipass', 'fullres', '-b:v', `${kbps}k`, '-maxrate', `${kbps * 2}k`, '-bufsize', `${kbps * 4}k`, ...NV_COMUM];
}
