/**
 * Prepara um clipe de B-roll para o video: recorta, coloca em 1920x1080/30 fps, tira o som, aplica o tratamento da
 * casa (menos saturado, um pouco mais escuro, vinheta: combina com o preto do canal) e registra o credito.
 *
 * Uso:
 *   bun run broll:preparar <video> <entrada.mp4> <nome> [--de 0] [--dur 8] [--fonte "Mixkit #4401"] [--url ...] [--licenca "Mixkit Stock Video Free License"]
 * Saida: videos/<video>/acervo/broll/<nome>.mp4 (fora do git) + linha em videos/<video>/acervo/broll/CREDITOS.md (no git).
 * Na batida: { "kind": "broll", "src": "../../acervo/broll/<nome>.mp4", "entra": "flash", "zoom": [1, 1.08] }
 *
 * Regras (docs/padrao-edicao-ofurry.md): so imagem REAL filmada (nada gerado por IA), que mostre exatamente o que a
 * fala diz; so licenca que permite uso comercial no YouTube (Mixkit "Free", Pexels, Pixabay); B-roll de 0,6 a 3 s.
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { videoDir } from './lib';

const args = process.argv.slice(2);
const [id, entrada, nome] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const opt = (k: string, d?: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
if (!id || !entrada || !nome) {
  console.error('Uso: bun run broll:preparar <video> <entrada.mp4> <nome> [--de 0] [--dur 8] [--fonte ".."] [--url ..] [--licenca ..]');
  process.exit(1);
}
const dir = join(videoDir(id), 'acervo', 'broll');
mkdirSync(dir, { recursive: true });
const out = join(dir, `${nome}.mp4`);
const de = opt('--de', '0')!;
const dur = opt('--dur', '8')!;
const vf = 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,eq=saturation=0.82:contrast=1.06:brightness=-0.035,vignette=PI/5';
let r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', de, '-t', dur, '-i', resolve(entrada), '-an', '-vf', vf, '-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', '19', '-b:v', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) {
  console.warn('NVENC falhou; usando x264 na CPU');
  r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', de, '-t', dur, '-i', resolve(entrada), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
}
const cred = join(dir, 'CREDITOS.md');
if (!existsSync(cred)) {
  writeFileSync(cred, `# B-roll: origem e licença\n\nOs clipes ficam fora do git (pesados); a URL permite baixar de novo. Gerado por \`bun run broll:preparar\`.\n\n| Arquivo | Fonte | URL | Licença | Trecho usado | Data |\n|---|---|---|---|---|---|\n`);
}
appendFileSync(cred, `| ${nome}.mp4 | ${opt('--fonte', '?')} | ${opt('--url', '?')} | ${opt('--licenca', '?')} | ${de}s + ${dur}s | ${new Date().toLocaleDateString('pt-BR')} |\n`);
console.log(`B-roll pronto: ${out}`);
