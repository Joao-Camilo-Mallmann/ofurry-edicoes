/**
 * QA de quadros do video pronto: acha tela vazia antes de mandar para o Joao.
 *
 * Joao, 24/11/2026: "ficou bugando 14:10 com fundo branco" (cena no papel saiu sem os icones). Amostra o video em
 * baixa resolucao e sinaliza trechos de pelo menos `--min` segundos com:
 *   - CLARO VAZIO: luminancia media alta e pouca variacao (papel ou tela branca sem conteudo legivel);
 *   - PRETO: tela preta (a assinatura no fim e esperada; o resto nao);
 *   - PARADO: quadro identico por mais de 4 s (freezedetect do ffmpeg).
 *
 * Uso: bun run video:qa <video-id | arquivo.mp4> [--fps=4] [--min=0.5] [--de=seg] [--ate=seg]
 * Sai com codigo 1 se achar CLARO VAZIO (o que nunca deveria ir para o ar).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const alvo = args.find((a) => !a.startsWith('--'));
if (!alvo) {
  console.error('uso: bun run video:qa <video-id | arquivo.mp4> [--fps=4] [--min=0.5]');
  process.exit(2);
}
const opt = (k: string, d: number) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? Number(a.split('=')[1]) : d;
};
const FPS = opt('fps', 4);
const MIN = opt('min', 0.5);
const arq = alvo.endsWith('.mp4') ? alvo : join('videos', alvo, 'final', `${alvo}-final.mp4`);
if (!existsSync(arq)) {
  console.error(`nao achei ${arq}`);
  process.exit(2);
}

const DE = opt('de', 0), ATE = opt('ate', 0);
const LW = 192, LH = 108, N = LW * LH;
// miolo da tela (fora da vinheta): onde icone, numero ou legenda aparecem
const X0 = Math.round(LW * 0.12), X1 = Math.round(LW * 0.88), Y0 = Math.round(LH * 0.1), Y1 = Math.round(LH * 0.9);
const proc = Bun.spawn(
  ['ffmpeg', '-v', 'error', ...(DE ? ['-ss', String(DE)] : []), ...(ATE ? ['-to', String(ATE)] : []), '-i', arq, '-vf', `fps=${FPS},scale=${LW}:${LH}:flags=area,format=gray`, '-f', 'rawvideo', '-'],
  { stdout: 'pipe', stderr: 'inherit' },
);

type Q = { t: number; media: number; escuros: number; claros: number };
const quadros: Q[] = [];
let buf = new Uint8Array(0);
for await (const chunk of proc.stdout as unknown as AsyncIterable<Uint8Array>) {
  const novo = new Uint8Array(buf.length + chunk.length);
  novo.set(buf);
  novo.set(chunk, buf.length);
  buf = novo;
  while (buf.length >= N) {
    const f = buf.subarray(0, N);
    let s = 0;
    for (let i = 0; i < N; i++) s += f[i];
    const media = s / N;
    // no miolo: quanto tem de traco bem mais escuro que a vizinhanca (conteudo no papel; a vinheta e a grade sao suaves
    // e nao contam) e de ponto claro (conteudo no preto)
    const ii = new Float64Array((LW + 1) * (LH + 1));
    for (let y = 0; y < LH; y++) {
      let lin = 0;
      for (let x = 0; x < LW; x++) { lin += f[y * LW + x]; ii[(y + 1) * (LW + 1) + x + 1] = ii[y * (LW + 1) + x + 1] + lin; }
    }
    const R = 6;
    const viz = (x: number, y: number) => {
      const xa = Math.max(0, x - R), xb = Math.min(LW, x + R + 1), ya = Math.max(0, y - R), yb = Math.min(LH, y + R + 1);
      const soma = ii[yb * (LW + 1) + xb] - ii[ya * (LW + 1) + xb] - ii[yb * (LW + 1) + xa] + ii[ya * (LW + 1) + xa];
      return soma / ((xb - xa) * (yb - ya));
    };
    let esc = 0, cla = 0, nm = 0;
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
      const v = f[y * LW + x];
      nm++;
      if (v < viz(x, y) - 30) esc++;
      if (v > 60) cla++;
    }
    quadros.push({ t: DE + quadros.length / FPS, media, escuros: esc / nm, claros: cla / nm });
    if (process.env.QA_DEBUG) console.log(quadros.at(-1));
    buf = buf.slice(N);
  }
}
await proc.exited;

const mmss = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
function trechos(teste: (q: Q) => boolean) {
  const out: { de: number; ate: number }[] = [];
  let ini = -1;
  quadros.forEach((q, i) => {
    if (teste(q)) { if (ini < 0) ini = i; }
    else if (ini >= 0) { out.push({ de: quadros[ini].t, ate: q.t }); ini = -1; }
  });
  if (ini >= 0) out.push({ de: quadros[ini].t, ate: DE + quadros.length / FPS });
  return out.filter((r) => r.ate - r.de >= MIN);
}

// papel/tela clara sem nenhum traco escuro no miolo = cena sem conteudo legivel (o bug do 14:10)
const claro = trechos((q) => q.media > 140 && q.escuros < 0.004);
// preto de verdade: quase nada claro no miolo (legenda ou numero sozinho no preto nao conta)
const preto = trechos((q) => q.media < 12 && q.claros < 0.002);

const fz = Bun.spawnSync(['ffmpeg', '-v', 'info', ...(DE ? ['-ss', String(DE)] : []), ...(ATE ? ['-to', String(ATE)] : []), '-i', arq, '-vf', 'freezedetect=n=0.002:d=4', '-an', '-f', 'null', '-'], { stderr: 'pipe' });
const parados: { de: number; ate: number }[] = [];
let ini = 0;
for (const l of fz.stderr.toString().split('\n')) {
  const a = l.match(/freeze_start: ([\d.]+)/);
  const b = l.match(/freeze_end: ([\d.]+)/);
  if (a) ini = DE + Number(a[1]);
  if (b) parados.push({ de: ini, ate: DE + Number(b[1]) });
}

const dur = quadros.length / FPS;
console.log(`${arq}: ${mmss(dur)}, ${quadros.length} quadros amostrados (${FPS}/s)`);
const lista = (nome: string, rs: { de: number; ate: number }[]) => {
  console.log(`${nome}: ${rs.length ? '' : 'nenhum'}`);
  for (const r of rs) console.log(`  ${mmss(r.de)} - ${mmss(r.ate)} (${(r.ate - r.de).toFixed(1)} s)`);
};
lista('CLARO VAZIO (corrigir)', claro);
lista('PRETO (so a assinatura no fim e esperada)', preto);
lista('PARADO > 4 s (conferir)', parados);
process.exit(claro.length ? 1 : 0);
