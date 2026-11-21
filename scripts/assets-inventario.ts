/**
 * Inventario dos assets do PC (D:\YT\!Assets) para achar som, musica, icone e animacao sem abrir pasta por pasta.
 *
 * Uso: bun run assets:inventario [--raiz D:/YT/!Assets]
 * Saida: docs/assets/inventario.md (versionado). Rode de novo sempre que entrar material novo em !Assets.
 *
 * Cada arquivo aparece com o caminho que se usa no codigo: @sfx/ (efeitos), @sw/ (swooshes), @mus/ (musicas),
 * ou o caminho completo para o resto. Pastas de trabalho (_lixeira, _projeto, .claude) ficam de fora.
 */
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const i = args.indexOf('--raiz');
const RAIZ = resolve(i >= 0 ? args[i + 1] : 'D:/YT/!Assets');
const ROOT = resolve(import.meta.dir, '..');
const OUT = join(ROOT, 'docs', 'assets', 'inventario.md');
const PULAR = new Set(['_lixeira', '_projeto', '.claude', 'node_modules']);
const ALIAS: [string, string][] = [
  ['PACK - EFEITOS SONOROS', '@sfx/'],
  ['Swoosh effects', '@sw/'],
  ['Musicas', '@mus/'],
];
const TIPO: Record<string, string> = {
  wav: 'audio', mp3: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio',
  mp4: 'video', mov: 'video', webm: 'video', mkv: 'video', gif: 'imagem',
  png: 'imagem', jpg: 'imagem', jpeg: 'imagem', webp: 'imagem', svg: 'imagem', psd: 'psd',
};

function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    if (PULAR.has(f)) continue;
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(RAIZ);
const porPasta = new Map<string, string[]>();
for (const f of files) {
  const rel = relative(RAIZ, f).replace(/\\/g, '/');
  const parts = rel.split('/');
  const pasta = parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts.length > 1 ? parts[0] : '(raiz)';
  if (!porPasta.has(pasta)) porPasta.set(pasta, []);
  porPasta.get(pasta)!.push(rel);
}
const ref = (rel: string) => {
  for (const [k, a] of ALIAS) if (rel.startsWith(k + '/')) return a + rel.slice(k.length + 1);
  return `${RAIZ.replace(/\\/g, '/')}/${rel}`;
};
const kb = (p: string) => statSync(join(RAIZ, p)).size;
const tam = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

let md = `# Inventário de assets do PC

Gerado por \`bun run assets:inventario\` em ${new Date().toLocaleDateString('pt-BR')} a partir de \`${RAIZ.replace(/\\/g, '/')}\`.
**Não edite à mão**: rode o comando de novo quando entrar material novo. Como navegar e as regras de uso: \`INDEX.md\`.

- ${files.length} arquivos em ${porPasta.size} pastas.
- A coluna "No código" é exatamente o que vai no \`file\` do \`sfx\`/\`trilha.json\` ou no \`src\` de uma batida.
- Para achar algo: Ctrl+F aqui (ex.: "coin", "click", "cash", "whoosh", "typewriter") ou
  \`rg -i "coin" docs/assets/inventario.md\`.

## Pastas

| Pasta | Arquivos |
|---|---|
${[...porPasta.entries()].sort().map(([p, l]) => `| [${p}](#${p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}) | ${l.length} |`).join('\n')}

`;
for (const [pasta, lista] of [...porPasta.entries()].sort()) {
  md += `## ${pasta}\n\n| Arquivo | Tipo | Tamanho | No código |\n|---|---|---|---|\n`;
  for (const rel of lista.sort()) {
    const ext = rel.split('.').pop()!.toLowerCase();
    md += `| ${rel.split('/').pop()} | ${TIPO[ext] ?? ext} | ${tam(kb(rel))} | \`${ref(rel)}\` |\n`;
  }
  md += '\n';
}
mkdirSync(join(ROOT, 'docs', 'assets'), { recursive: true });
writeFileSync(OUT, md);
console.log(`${files.length} arquivos -> ${OUT}`);
