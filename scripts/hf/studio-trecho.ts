/**
 * Abre o HyperFrames Studio (editor/preview no navegador, com painel de render) para um trecho, ja com a placa ligada.
 *
 * Uso: bun run hf:studio <video> <trecho>        ex.: bun run hf:studio na-hora-do-almoco 05
 *   -> http://localhost:3002  (porta fixa: assim a opcao "GPU" do painel de render fica lembrada no navegador)
 *
 * Placa: o Chrome de miniaturas/captura do Studio roda na RTX (--browser-gpu) e os renders feitos pelo painel tambem
 * (PRODUCER_BROWSER_GPU_MODE=hardware). No painel de render, deixe "GPU" marcado para codificar o MP4 na NVENC.
 * Os renders do Studio caem em output/trecho-XX/hf/renders/ (para conferir). O MP4 oficial do trecho, que entra no
 * video final, continua saindo do `bun run hf:render` / kit/finalizar.mjs.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const HF_VERSION = '0.8.193';
const PORTA = '3002';
const ROOT = resolve(import.meta.dir, '..', '..');
const [video, trechoArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!video || !trechoArg) {
  console.error('Uso: bun run hf:studio <video> <trecho>');
  process.exit(1);
}
const trecho = `trecho-${trechoArg.padStart(2, '0')}`;
const hfDir = join(ROOT, 'videos', video, 'output', trecho, 'hf');
if (!existsSync(join(hfDir, 'index.html'))) {
  console.error(`Projeto nao encontrado: ${hfDir}`);
  process.exit(1);
}
const env = { ...process.env, PRODUCER_BROWSER_GPU_MODE: 'hardware' };
const hf = (...a: string[]) => spawnSync('npx', ['-y', `hyperframes@${HF_VERSION}`, ...a], { cwd: hfDir, stdio: 'inherit', shell: true, env });

hf('preview', '--kill-all'); // um Studio por vez: libera a porta 3002
console.log(`> Studio do ${trecho} em http://localhost:${PORTA} (Ctrl+C fecha)`);
const r = hf('preview', '--port', PORTA, '--browser-gpu', '--foreground');
process.exit(r.status ?? 0);
