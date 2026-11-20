/**
 * Som v10 (13/11): "Ei, moco" inteiro. Pedido do usuario: "no minuto 02:44 ficou estranha a musica... ela pode ser bem
 * maior dali. Ficou cortado, ficou estranho."
 * A peca cantada tinha 9,5 s e sumia em "pra tanta tristeza", mas o narrador continua lendo a letra ate
 * "ou coisa parecida" (18,5 s do trecho). O arquivo ja esta em sincronia com a fala (tempo do arquivo = tempo do
 * trecho: "Deixemos" 10,4 / narrador 11,1; "coisa parecida" 16,4-18,4 / narrador 16,8-18,5), entao so estende:
 *   06  2:46-3:05  19 s (eram 9,5), com o timbre de radio do som v8, e a Emergence abre espaco ate o fim da peca.
 * Idempotente. Backup em output/_backup-som-v10/. Rode depois do som-v8 (o v4 recria a peca curta).
 * Depois: bun kit/preparar.mjs 06 e bun kit/finalizar.mjs --sem-render
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const ARQ = join(OUT, 'trecho-06', 'sons.json');
const BK = join(OUT, '_backup-som-v10');
mkdirSync(BK, { recursive: true });
if (!existsSync(join(BK, 'sons-06.json'))) copyFileSync(ARQ, join(BK, 'sons-06.json'));

const s = JSON.parse(readFileSync(ARQ, 'utf8'));
const um = (re) => { const r = s.cues.filter((c) => re.test(c.file)); if (r.length !== 1) throw new Error(`esperava 1 cue ${re}, achei ${r.length}`); return r[0]; };

const INI = 1.5, FIM = 20.5;                       // s do trecho
const moco = um(/06-ei-moco-audio\.wav$/);
Object.assign(moco, { at: INI, from: INI, len: FIM - INI, fadeIn: 2, fadeOut: 2.2, fx: 'radio', env: [[0, -20], [1.9, -22], [FIM, -22]] });

// a trilha de fundo fica quase muda enquanto o clipe canta e volta depois
const emergence = um(/Emergence\.mp4$/);
emergence.env = [[0, -29], [0.01, -42], [FIM - 0.4, -42], [FIM + 0.6, -29], [44.1, -24], [45.1, -24]];

writeFileSync(ARQ, JSON.stringify(s, null, 1));
console.log(`trecho-06: "Ei, moco" de ${INI} a ${FIM} s do trecho (${(FIM - INI).toFixed(1)} s), radio; Emergence abre ate ${FIM} s`);
