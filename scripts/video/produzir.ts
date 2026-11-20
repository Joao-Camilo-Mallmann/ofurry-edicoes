/**
 * Produz o video inteiro: build de todos os trechos, render SO do que mudou na imagem, montagem final.
 *
 * Uso:
 *   bun run video:produzir <id>                 tudo (build + render do que mudou + video:montar)
 *   bun run video:produzir <id> --trechos 03,04 so esses trechos (e monta o video inteiro no fim)
 *   bun run video:produzir <id> --sem-montar    para depois dos renders
 *   bun run video:produzir <id> --forcar        renderiza tudo de novo
 *
 * "Impressao visual": hash de hf/ (index.html, compositions, assets) sem a narracao. Se nao mudou desde o ultimo
 * render, o trecho nao e renderizado de novo (mudanca so de som nao precisa de render: o video:montar refaz o audio
 * inteiro a partir de midia/narracao.wav + trilha.json + sfx).
 * Fluxo depois de uma regravacao: video:sincronizar <id> --audio nova.wav  ->  video:produzir <id>.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readManifest, ROOT, trechoDir } from './lib';

const args = process.argv.slice(2);
const id = args[0];
const opt = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!id) {
  console.error('Uso: bun run video:produzir <id> [--trechos 03,04] [--sem-montar] [--forcar]');
  process.exit(1);
}
const m = readManifest(id);
const sel = opt('--trechos')?.split(',').map((s) => s.padStart(2, '0'));
const forcar = args.includes('--forcar');

function impressao(hfDir: string): string {
  const h = createHash('sha1');
  const walk = (d: string) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      const rel = relative(hfDir, p).replace(/\\/g, '/');
      if (rel.startsWith('.hyperframes') || rel.startsWith('node_modules') || /^assets\/narracao\./.test(rel)) continue;
      if (statSync(p).isDirectory()) walk(p);
      else h.update(rel).update(readFileSync(p));
    }
  };
  walk(hfDir);
  return h.digest('hex');
}

const run = (cmd: string[], label: string) => {
  const r = spawnSync('bun', ['run', ...cmd], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`falhou: ${label}`);
    process.exit(r.status ?? 1);
  }
};

const t0 = Date.now();
let renderizados = 0;
for (const t of [...m.trechos].sort((a, b) => a.inicio - b.inicio)) {
  const n = t.id.replace('trecho-', '');
  if (sel && !sel.includes(n)) continue;
  const dir = trechoDir(id, n);
  const beats = JSON.parse(readFileSync(join(dir, 'beats.json'), 'utf8'));
  if (!beats.beats?.length) {
    console.error(`${t.id}: beats.json sem batidas`);
    process.exit(1);
  }
  console.log(`\n=== ${t.id} · ${t.titulo ?? ''}`);
  run(['hf:build', id, n], `hf:build ${t.id}`);
  const imp = impressao(join(dir, 'hf'));
  const mp4 = join(dir, 'render', `${id}-${t.id}.mp4`);
  const impPath = join(dir, 'render', '.impressao');
  if (!forcar && existsSync(mp4) && existsSync(impPath) && readFileSync(impPath, 'utf8').trim() === imp) {
    console.log('  imagem igual ao ultimo render: pulando');
    continue;
  }
  run(['hf:render', id, n], `hf:render ${t.id}`);
  writeFileSync(impPath, imp + '\n');
  renderizados++;
}
console.log(`\n${renderizados} trecho(s) renderizado(s) em ${((Date.now() - t0) / 60000).toFixed(1)} min`);
if (!args.includes('--sem-montar')) run(['video:montar', id], 'video:montar');
