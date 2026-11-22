/**
 * Som v6 (12/11): feedback do usuario depois de ver o final: "focar na narracao, nao na musica; seguir o roteiro".
 *   02 (verso inicial, 0:33-0:54)  o verso cantado entrava 8 s depois de o narrador recitar ("toca depois e fica fora"):
 *       no clipe a voz so comeca em 39,8 s (a transcricao dizia 30 s). O pedaco do clipe passa a ser 37,8-58,2 s, de modo que
 *       "No centro da sala" e cantado em 3,2 s do trecho (o narrador diz em 4,2 s) e os 4 versos andam junto com a fala.
 *       Sai em fade antes do "medo, medo" (que e assunto do trecho 04). 20,4 s de clipe (eram 26,7 s). O vento do buraco entra antes.
 *   05 (a familia, 2:33-2:43)  o "e hora do almoco" cantado tocava no volume da narracao e parecia repetir o narrador:
 *       camada sincronizada de -3 dB para -20 dB. O fecho "NINGUEM SE OLHA" (2 s, nao esta no roteiro) saiu: 17,3 s (eram 19,3).
 *   61 (titulo COISA PARECIDA)  de 20 s para 10 s: o clipe entra baixo desde o comeco (-20 dB; era -9), cantando
 *       "coisa parecida" junto com o titulo, e sai em fade com a imagem. 10 s de clipe (eram 13,1 s).
 *   10 (encerramento)  o 1 s de silencio depois de "SO NAO FIQUE EM SILENCIO" saiu: a narracao segue direto e a musica
 *       continua. 51,6 s (eram 52,6).
 * As composicoes de 05, 61 e 10 foram encurtadas a mao (backups em output/_backup-cena-05-sem-fecho/, _backup-cena-61-curta/
 * e _backup-cena-10-sem-silencio/); este script le a duracao nova do index.html de cada trecho e acerta o som.
 * O video passou de 7:16 para 7:03.
 * Idempotente. Backup dos sons.json em output/_backup-som-v6/.
 * Ordem: som-v4-copyright.mjs -> som-v5-auditoria.mjs -> este -> som-v7-cama-karaoke.mjs. (O v4 roda com qualquer argumento, ate --help.)
 * Depois: bun kit/preparar.mjs 02 05 06 61 10 e bun kit/finalizar.mjs (05, 61 e 10 entram sozinhos no render)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const arq = (t) => join(OUT, `trecho-${t}`, 'sons.json');
const abre = (t) => JSON.parse(readFileSync(arq(t), 'utf8'));
const salva = (t, s) => writeFileSync(arq(t), JSON.stringify(s, null, 1));
const durDe = (t) => Number(readFileSync(join(OUT, `trecho-${t}`, 'hf', 'index.html'), 'utf8').match(/id="root"[^>]*data-duration="([\d.]+)"/)[1]);
const um = (s, t, re) => { const r = s.cues.filter((c) => re.test(c.file + ' ' + (c.id || ''))); if (r.length !== 1) throw new Error(`trecho-${t}: esperava 1 cue ${re}, achei ${r.length}`); return r[0]; };
const r2 = (x) => Math.round(x * 100) / 100;
const BK = join(OUT, '_backup-som-v6');
mkdirSync(BK, { recursive: true });
for (const t of ['02', '05', '06', '61', '10']) if (!existsSync(join(BK, `sons-${t}.json`))) copyFileSync(arq(t), join(BK, `sons-${t}.json`));

// --- 02: verso cantado junto com a recitacao ---------------------------------------------------------------------------
{
  const s = abre('02');
  const c = um(s, '02', /clipe-so-audio/);
  // tempo do clipe = tempo do trecho + 36,8. Versos cantados (clipe): 40,0 / 41,9 / 44,5 / 46,0 s; narrador: 4,20 / 5,88 / 7,40 / 8,84 s
  Object.assign(c, { at: 1.0, from: 37.8, len: 20.4, fadeIn: 1.5, fadeOut: 2.5, env: [[1.0, -24], [10.6, -24], [11.4, -28], [21.4, -28]] });
  // vento do buraco (cue do v5) entra quando o clipe comeca a sair, sem perder a continuidade com o trecho 03
  const v = s.cues.find((c) => c.id === 'v5-vento-buraco');   // o som v7 tira este vento: se ja saiu, segue
  const fim = 52 + (s.dur - 26);                       // posicao do arquivo no fim do trecho, como o v5 deixou (o 03 continua dali)
  if (v) Object.assign(v, { at: 19.4, from: r2(fim - (s.dur - 19.4)), len: r2(s.dur - 19.4), fadeIn: 2.5, fadeOut: 0.001 });
  salva('02', s);
  console.log('trecho-02: clipe 37,8-58,2 s em 1,0-21,4 s do trecho (verso cantado junto com a fala); vento do buraco a partir de 19,4 s');
}

// --- 05: camada cantada bem baixa; trecho termina em 17,3 s (sem o fecho) -----------------------------------------------------
{
  const s = abre('05');
  const dur = durDe('05');
  if (dur !== 17.3) throw new Error(`trecho-05: a composicao tem ${dur} s; este script espera 17,3 s`);
  s.dur = dur;
  s.cues = s.cues.filter((c) => (c.at || 0) < dur - 0.05);                                  // zing, whip e grave do fecho
  for (const c of s.cues) if (c.len && (c.at || 0) + c.len > dur) c.len = r2(dur - (c.at || 0));
  um(s, '05', /hora-do-almoco-sincronizado/).gain = -20;
  um(s, '05', /Emergence/).env = [[0, -34], [1.2, -42], [dur, -42]];
  salva('05', s);
  const s6 = abre('06');
  um(s6, '06', /Emergence/).from = r2(35.4 + dur);                                          // continua de onde o 05 parou
  salva('06', s6);
  console.log(`trecho-05: ${dur} s, "e hora do almoco" cantado a -20 dB (era -3); Emergence do 06 a partir de ${r2(35.4 + dur)} s`);
}

// --- 61: respiro de 10 s, clipe baixo desde o comeco (o arquivo comeca em 1:56 do clipe, igual ao video da cena) --------------
{
  const dur = durDe('61');
  if (dur !== 10) throw new Error(`trecho-61: a composicao tem ${dur} s; este script espera a cena curta de 10 s`);
  salva('61', {
    dur,
    cues: [
      { file: '@sfx/Ambiente SFX/Windy Desert.mp3', at: 0, from: 90, len: dur, fadeIn: 1.5, fadeOut: 2.6, gain: -22 },
      { file: '@clipe/trechos/07-coisa-parecida-audio.wav', at: 0, from: 0, len: dur, fadeIn: 1.0, fadeOut: 2.6, gain: -20 },
    ],
  });
  console.log(`trecho-61: ${dur} s, clipe a -20 dB desde o comeco (eram 13,1 s a -9 dB a partir dos 6,9 s), vento a -22 dB`);
}

// --- 10: sem o 1 s de silencio (13,45-14,45) -----------------------------------------------------------------------------------
{
  const s = abre('10');
  const dur = durDe('10');
  if (dur !== 51.6) throw new Error(`trecho-10: a composicao tem ${dur} s; este script espera 51,6 s`);
  if (s.dur === 52.6) {                                 // primeira rodada: tudo que comecava depois do silencio anda 1 s para tras
    for (const c of s.cues) if ((c.at || 0) >= 14.44) c.at = r2(c.at - 1);
    s.dur = dur;
  }
  s.cues = [{ file: '@narr', at: 0, gain: 0 }, ...s.cues.filter((c) => c.file !== '@narr')];  // narracao inteira, sem o corte
  Object.assign(um(s, '10', /A New Beginning/), { len: 44.5, fadeOut: 2.5, env: [[0, -26], [39.77, -20], [44.5, -20]] });
  um(s, '10', /07-coisa-parecida/).at = 43.3;           // valor absoluto: o v4 recria esta cue em 44,3
  salva('10', s);
  console.log(`trecho-10: ${dur} s, narracao continua, A New Beginning sem o buraco, clipe final em 43,3 s`);
}
console.log('som v6 aplicado. Agora: bun kit/preparar.mjs 02 05 06 61 10 e bun kit/finalizar.mjs');
