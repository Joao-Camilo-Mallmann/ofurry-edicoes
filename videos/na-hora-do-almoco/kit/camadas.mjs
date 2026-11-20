/**
 * FORA DE USO desde 17/11/2026: a entrega e so o video pronto (pedido do usuario). O finalizar.mjs nao chama mais
 * este script e o hf:render nao gera mais o MOV transparente que ele le. Para usar de novo, renderize antes os
 * trechos com `bun run hf:render na-hora-do-almoco XX --alpha`.
 *
 * Pasta de camadas para o Filmora: stems de audio do video inteiro (narracao, musica, efeitos), alinhados ao
 * video final, + as camadas transparentes de cada trecho (so textos/grafismos) em WebM VP9 com alfa (o que o
 * Filmora le com transparencia) e em MOV ProRes 4444, e o MP4 completo de cada trecho.
 *
 * Uso: bun videos/na-hora-do-almoco/kit/camadas.mjs 01 02 03 ... (na ordem da montagem)
 * Saida: 06-montagem/exportacoes/camadas-filmora/
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VIDEO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJ = 'D:/YT/Matheus (Alves)/hora do armoco';
const OUT = join(PROJ, '06-montagem', 'exportacoes', 'camadas-filmora');
const ALIAS = {
  '@sfx/': 'D:/YT/!Assets/PACK - EFEITOS SONOROS/',
  '@sw/': 'D:/YT/!Assets/Swoosh effects/',
  '@mus/': 'D:/YT/!Assets/Musicas/',
  '@clipe/': join(PROJ, '03-clipe-belchior') + '/',
  '@camadas/': join(PROJ, '05-camadas-prontas') + '/',
};
const tipo = (f) => (f === '@narr' || f.startsWith('@camadas/') ? 'narracao' : f.startsWith('@clipe/') || f.startsWith('@mus/') ? 'musica' : 'efeitos');
const trechos = process.argv.slice(2).map((t) => t.padStart(2, '0'));
if (!trechos.length) { console.error('Uso: bun kit/camadas.mjs 01 02 ...'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const envExpr = (env) => {
  let e = String(env[env.length - 1][1]);
  for (let i = env.length - 2; i >= 0; i--) {
    const [t0, g0] = env[i], [t1, g1] = env[i + 1];
    e = `if(lt(t,${t1}),${g0}+(${g1 - g0})*(t-${t0})/${Math.max(0.001, t1 - t0)},${e})`;
  }
  return `if(lt(t,${env[0][0]}),${env[0][1]},${e})`;
};

// todas as cues do video, com o tempo deslocado pelo inicio de cada trecho na montagem
let base = 0;
const cues = [];
for (const n of trechos) {
  const dir = join(VIDEO, 'output', `trecho-${n}`);
  const sons = JSON.parse(readFileSync(join(dir, 'sons.json'), 'utf8'));
  for (const c of sons.cues) {
    const file = c.file === '@narr' ? join(dir, 'midia', 'narracao.wav')
      : Object.entries(ALIAS).reduce((f, [k, v]) => (f.startsWith(k) ? v + f.slice(k.length) : f), c.file);
    // corta a cue no fim do trecho (como no mix do trecho)
    const fim = Math.min(c.len ?? Infinity, sons.dur - (c.at || 0));
    cues.push({ ...c, file, tipo: tipo(c.file), at: base + (c.at || 0), len: Number.isFinite(fim) ? fim : undefined,
      env: c.env && c.env.map(([t, g]) => [base + t, g]) });
  }
  // copia as camadas de video do trecho
  const r = join(dir, 'render');
  for (const [src, dst] of [[`na-hora-do-almoco-trecho-${n}-alpha.mov`, `${n}-textos-alpha.mov`], [`na-hora-do-almoco-trecho-${n}.mp4`, `${n}-completo.mp4`]]) {
    if (existsSync(join(r, src))) copyFileSync(join(r, src), join(OUT, dst));
    else console.warn('sem render:', join(r, src));
  }
  // WebM VP9 com alfa a partir do MOV transparente, sem audio
  const mov = join(OUT, `${n}-textos-alpha.mov`), webm = join(OUT, `${n}-textos-alpha.webm`);
  // regenera o WebM quando o MOV e mais novo (render refeito)
  if (existsSync(mov) && (!existsSync(webm) || statSync(mov).mtimeMs > statSync(webm).mtimeMs)) {
    const w = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-c:v', 'prores', '-i', mov, '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
      '-b:v', '4M', '-auto-alt-ref', '0', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-metadata:s:v:0', 'alpha_mode=1', webm], { stdio: 'inherit' });
    console.log(w.status === 0 ? `webm alfa: ${n}` : `falhou webm: ${n}`);
  }
  base += sons.dur;
}
console.log(`duracao total ${base.toFixed(2)} s`);

for (const t of ['narracao', 'musica', 'efeitos']) {
  const sel = cues.filter((c) => c.tipo === t);
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  const parts = [];
  sel.forEach((c, i) => {
    args.push('-i', c.file);
    const f = [`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo`];
    if (c.from || c.len) f.push(`atrim=start=${c.from || 0}${c.len ? `:duration=${c.len}` : ''}`, 'asetpts=PTS-STARTPTS');
    if (c.fadeIn) f.push(`afade=t=in:d=${c.fadeIn}`);
    if (c.fadeOut && c.len) f.push(`afade=t=out:st=${Math.max(0, c.len - c.fadeOut)}:d=${c.fadeOut}`);
    if (c.gain) f.push(`volume=${c.gain}dB`);
    const ms = Math.round(c.at * 1000);
    if (ms > 0) f.push(`adelay=${ms}|${ms}`);
    if (c.env) f.push(`volume='pow(10,(${envExpr(c.env)})/20)':eval=frame`);
    parts.push(f.join(',') + `[a${i}]`);
  });
  parts.push(`${sel.map((_, i) => `[a${i}]`).join('')}amix=inputs=${sel.length}:normalize=0:dropout_transition=0,apad,atrim=duration=${base}[out]`);
  const script = join(VIDEO, 'output', `stem-${t}.filter`);
  writeFileSync(script, parts.join(';\n'));
  const out = join(OUT, `audio-${t}.wav`);
  const r = spawnSync('ffmpeg', [...args, '-filter_complex_script', script, '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', out], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log('stem:', out, `(${sel.length} cues)`);
}
