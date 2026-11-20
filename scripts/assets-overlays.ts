/**
 * Gera D:\YT\!Assets\Overlays\ (texturas, glitch, luz e fundos prontos para o kit) a partir dos originais do PC.
 * Os originais nao sao tocados. Saida em 1920x1080, 30 fps, sem som, H.264 na placa (NVENC).
 *
 * Uso: bun run assets:overlays            (refaz so o que falta)
 *      bun run assets:overlays --refazer
 *
 * No beats.json/build, use pelo atalho "@assets/Overlays/..." (o build copia para o projeto do trecho).
 * Por que existe: o João achou "muito fundo preto" (20/11/2026) e pediu overlays, glitch e transicoes.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const A = 'D:/YT/!Assets';
const OUT = join(A, 'Overlays');
const refazer = process.argv.includes('--refazer');
type Item = { saida: string; fonte: string; o_que: string; uso: string; loop?: number; de?: number; dur?: number; vf?: string };
const ITENS: Item[] = [
  { saida: 'pelicula/riscos-e-poeira.mp4', fonte: 'MESTRES DO VINTADE/NOISE (3).mp4', o_que: 'riscos verticais e poeira de pelicula sobre preto', uso: 'por cima de tudo, blend screen, opacidade 0,4-0,6 (o kit usa em todo trecho)', loop: 15 },
  { saida: 'pelicula/poeira-pulsando.mp4', fonte: 'MESTRES DO VINTADE/dust grunge pulse.mp4', o_que: 'poeira grossa que pulsa', uso: 'textura extra em cena parada (screen, 0,3)', de: 5, dur: 40 },
  { saida: 'glitch/vhs-ruido.mp4', fonte: 'MESTRES DO VINTADE/Noise 12_4K.mp4', o_que: 'ruido de VHS com linhas', uso: 'transicao glitch de 3-6 quadros (screen)', de: 2, dur: 4 },
  { saida: 'luz/light-leak-laranja.mp4', fonte: 'MESTRES DO VINTADE/overlay 4.mp4', o_que: 'vazamento de luz laranja (cor da marca)', uso: 'transicao "luz" de 0,6-1 s (screen)' },
  { saida: 'luz/light-leak-borda.mp4', fonte: 'MESTRES DO VINTADE/overlay 4.mp4', o_que: 'so a luz vazando pela borda (recorte de 0,95 s a 1,95 s)', uso: 'transicao "luz" sem cobrir a tela (o kit usa este)', de: 0.95, dur: 1 },
  { saida: 'luz/flash-branco.mp4', fonte: 'MESTRES DO VINTADE/overlay 5.wmv', o_que: 'flash branco que some', uso: 'corte com flash (screen)' },
  { saida: 'fundos/grade-perspectiva.mp4', fonte: 'Furry/secodary-Background.mp4', o_que: 'grade branca em perspectiva sobre preto, andando', uso: 'fundo vivo no lugar do preto (backdrop "grade-video")', loop: 6 },
];
let feitos = 0;
for (const it of ITENS) {
  const out = join(OUT, it.saida);
  if (existsSync(out) && !refazer) continue;
  mkdirSync(dirname(out), { recursive: true });
  const src = join(A, it.fonte);
  const pre = [...(it.loop ? ['-stream_loop', String(it.loop)] : []), ...(it.de ? ['-ss', String(it.de)] : []), '-i', src, ...(it.dur ? ['-t', String(it.dur)] : it.loop ? ['-t', '60'] : [])];
  const vf = it.vf ?? 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p';
  let r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...pre, '-an', '-vf', vf, '-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', '23', '-b:v', '0', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...pre, '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '22', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status === 0) {
    feitos++;
    console.log('ok', it.saida);
  } else console.error('falhou', it.saida);
}
writeFileSync(
  join(OUT, 'README.md'),
  `# Overlays (texturas, glitch, luz, fundos)

Gerado por \`bun run assets:overlays\` (repo animation-to-yt / ofurry-edicoes) a partir dos originais desta pasta
\`!Assets\` (os originais não são tocados). 1920x1080, 30 fps, sem som. Para refazer: \`bun run assets:overlays --refazer\`.

Uso no código: \`@assets/Overlays/<arquivo>\`. Quase tudo entra com **blend "screen"** (o preto some, só a luz/risco aparece).

| Arquivo | O que é | Uso | Original |
|---|---|---|---|
${ITENS.map((i) => `| \`${i.saida}\` | ${i.o_que} | ${i.uso} | \`${i.fonte}\` |`).join('\n')}

Origem do pedido: "teve muito fundo preto... podia ter alguns overlays por cima para dar uma dinâmica a mais" (João, 20/11/2026).
`
);
console.log(`${feitos} overlay(s) gerado(s) em ${OUT}`);
