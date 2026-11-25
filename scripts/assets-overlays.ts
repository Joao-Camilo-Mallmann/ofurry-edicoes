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
  // Joao, 24/11/2026: "variar mais o efeito de luz e overlay da tela" -> uma pelicula, um leak e um glitch por bloco
  { saida: 'pelicula/pontos-e-vinheta.mp4', fonte: 'MESTRES DO VINTADE/NOISE (1).wmv', o_que: 'pontos de poeira, risco fino e borda clara de projetor', uso: 'pelicula de bloco (screen, 0,25-0,35)', loop: 6 },
  { saida: 'pelicula/filme-antigo.mp4', fonte: 'PACK - EFEITOS SONOROS/General/old film overlay.mp4', o_que: 'riscos finos e manchas de filme antigo, discreto', uso: 'pelicula de bloco (screen, 0,4-0,6)' },
  { saida: 'pelicula/grao-fino.mp4', fonte: 'MESTRES DO VINTADE/Noise 2.mov', o_que: 'grao fino escuro, quase sem risco', uso: 'pelicula limpa para bloco de respiro (screen, 0,5)', loop: 4 },
  { saida: 'glitch/linhas-horizontais.mp4', fonte: 'MESTRES DO VINTADE/Noise 3_1_4K.mp4', o_que: 'faixa de linhas horizontais de fita', uso: 'transicao glitch alternativa a vhs-ruido (screen)' },
  { saida: 'luz/light-leak-frio.mp4', fonte: 'MESTRES DO VINTADE/overlay 4.mp4', o_que: 'o leak da borda em azul frio', uso: 'transicao "luz" em bloco frio (fase chata)', de: 0.95, dur: 1, vf: 'scale=1920:1080,fps=30,hue=h=180:s=1.2,format=yuv420p' },
  { saida: 'luz/light-leak-verde.mp4', fonte: 'MESTRES DO VINTADE/overlay 4.mp4', o_que: 'o leak da borda em verde (ganho)', uso: 'transicao "luz" em bloco de ganho', de: 0.95, dur: 1, vf: 'scale=1920:1080,fps=30,hue=h=120,format=yuv420p' },
  { saida: 'luz/light-leak-dourado.mp4', fonte: 'MESTRES DO VINTADE/overlay 4.mp4', o_que: 'o leak inteiro puxado para dourado', uso: 'transicao "luz" na virada e no milhao', vf: 'scale=1920:1080,fps=30,hue=h=40:s=1.2,format=yuv420p' },
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

Ver todos de uma vez: \`catalogo.png\` (um quadro de cada, com o nome). No kit, a pelicula, a luz e o leak de cada bloco
vêm do \`"look"\` do beats.json (ver \`docs/padrao-edicao-ofurry.md\`, "Luz e overlay por bloco").

| Arquivo | O que é | Uso | Original |
|---|---|---|---|
${ITENS.map((i) => `| \`${i.saida}\` | ${i.o_que} | ${i.uso} | \`${i.fonte}\` |`).join('\n')}

Origem do pedido: "teve muito fundo preto... podia ter alguns overlays por cima para dar uma dinâmica a mais" (João, 20/11/2026).
`
);
console.log(`${feitos} overlay(s) gerado(s) em ${OUT}`);
