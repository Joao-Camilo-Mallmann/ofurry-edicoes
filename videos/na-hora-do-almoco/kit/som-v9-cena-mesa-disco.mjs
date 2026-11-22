/**
 * Som v9 (13/11): sons da cena nova dos 4 acordes no trecho 03 (a mesa vista de cima que vira disco de vinil,
 * compositions/anel.html). Os 4 cliques de tampa de caneta que marcavam os nos do anel antigo (9,0 a 9,75 s) viram
 * pratos pousando na mesa, e o braco da vitrola ganha o som da agulha quando pousa (17,3 s).
 * Sons suaves e ligados ao que aparece (pedido do usuario: efeito so em evento especifico).
 * Idempotente (ids "v9-..."). Backup em output/_backup-cena-03-mesa-disco/. Rode depois do som-v8.
 * Depois: bun kit/preparar.mjs 03 e bun kit/finalizar.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARQ = join(dirname(fileURLToPath(import.meta.url)), '..', 'output', 'trecho-03', 'sons.json');
const s = JSON.parse(readFileSync(ARQ, 'utf8'));
const r2 = (x) => Math.round(x * 100) / 100;

s.cues = s.cues.filter((c) => !/^v9-/.test(c.id || ''));
// cliques do anel antigo
const antes = s.cues.length;
s.cues = s.cues.filter((c) => !(/Pen Cap Closed 0[12]\.wav$/.test(c.file) && (c.at || 0) >= 8.9 && (c.at || 0) <= 9.8));
const tirados = antes - s.cues.length;

// pratos pousando: [quando o prato assenta, arquivo, ataque ate o pico (medido), ganho]
const POUSA = '@sfx/Kitchen/Plates Put Away 02.wav', TIRA = '@sfx/Kitchen/Plates Removing 02.wav';
const PRATOS = [[9.12, POUSA, 0.02, -15], [9.37, TIRA, 0.21, -18], [9.62, POUSA, 0.02, -17], [9.87, TIRA, 0.21, -18]];
for (const [em, file, ataque, gain] of PRATOS) s.cues.push({ id: 'v9-prato', file, at: r2(em - ataque), gain, fadeIn: 0.01, fadeOut: 0.15 });
// agulha no disco quando o braco pousa
s.cues.push({ id: 'v9-agulha', file: '@sfx/Horros SFX/needle_drop.wav', at: r2(17.3 - 0.055), gain: -14, fadeIn: 0.01, fadeOut: 0.2 });

writeFileSync(ARQ, JSON.stringify(s, null, 1));
console.log(`trecho-03: ${tirados} cliques de caneta removidos, 4 pratos + 1 agulha (som v9)`);
