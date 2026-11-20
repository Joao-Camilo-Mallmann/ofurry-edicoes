# OFurry Edições: índice

Central de edição dos vídeos do canal **OFurry** (youtube.com/@OFurryOficial). O João traz **roteiro + narração**;
este repositório faz o resto: corte por frase, cenas de motion no estilo do canal, trilha, efeitos e o MP4 final em
Full HD. Este arquivo ensina a navegar no repo **e nas pastas do PC** onde ficam os vídeos e os assets.

> Para IA: leia este arquivo, depois `AGENTS.md`. Para editar um vídeo: `docs/padrao-edicao-ofurry.md`.

---

## 1. Comece por aqui

| Quero... | Abra |
|---|---|
| entender o gosto do João (o que ele aprovou e reprovou, com as palavras dele) | [`docs/preferencias-do-joao.md`](docs/preferencias-do-joao.md) |
| saber **como editamos** um vídeo (estrutura, ritmo, cenas, som, passo a passo) | [`docs/padrao-edicao-ofurry.md`](docs/padrao-edicao-ofurry.md) |
| saber **como fica** (cores, fontes, legenda, mascote, receitas H1–H10) | [`.agents/skills/ofurry-house-motion/SKILL.md`](.agents/skills/ofurry-house-motion/SKILL.md) |
| ver todas as cenas de dados e o palco de ícones, com parâmetros | [`.agents/skills/ofurry-fazer-cenas/references/cenas-de-dados.md`](.agents/skills/ofurry-fazer-cenas/references/cenas-de-dados.md) |
| achar um som, música, ícone ou animação no PC | [seção 4](#4-assets-do-pc-dytassets) e [`docs/assets/inventario.md`](docs/assets/inventario.md) |
| mandar um vídeo de referência para análise | [`referencias/README.md`](referencias/README.md) |
| ver um vídeo completo feito neste padrão | [`videos/177/`](videos/177/) (storyboard, trechos, trilha, dados) |
| por que as coisas são assim (decisões) | [`docs/ADR/`](docs/ADR/) (a mais recente: ADR-007) |

## 2. Próximo vídeo em 10 comandos

```text
bun run video:novo <id> --titulo "..." --audio "D:/YT/OFurry/<video>/narracao.wav"
bun run video:transcrever <id>
  -> corrigir texto em videos/<id>/midia/revisao.json; trechos com "de" (frase de abertura) no video.json
bun run video:dividir <id> --aplicar     (divide em partes de 20–55 s, por seção e pausa)
bun run video:sincronizar <id>
  -> storyboard.md + 1-2 pilotos aprovados pelo João (beats.json com âncoras "@frase" e sfx)
bun run hf:build <id> XX      e      bun run video:montar <id> --trechos 01,XX     (prévia com som)
  -> beats.json de todos os trechos + trilha.json
bun run video:produzir <id>   -> videos/<id>/final/<id>-final.mp4
```
Regravou frases? `bun run video:sincronizar <id> --audio nova.wav` e `bun run video:produzir <id>`.
Quer mexer só numa parte? Ache o minuto em `videos/<id>/final/partes.md` e rode `bun run video:produzir <id> --trechos XX`
(o vídeo é sempre feito por partes; só a parte mexida renderiza de novo).
Detalhes de cada passo: `docs/padrao-edicao-ofurry.md`, seção 8.

## 3. Mapa do repositório

| Pasta | O que tem |
|---|---|
| `videos/<id>/` | um vídeo: `video.json` (trechos por frase), `roteiro.md`, `briefing.md`, `storyboard.md`, `trilha.json`, `midia/` (narração, transcrição, `revisao.json`), `output/trecho-XX/` (`beats.json`, `hf/` gerado, `render/`), `final/` (MP4 final, prévias, versões antigas) |
| `hf/kit/` | o kit visual do HyperFrames: `house.css` (tokens), `house-runtime.js` (entradas, legenda), **`ofurry-cenas.js`** (gráfico, tabela, balança, máquina, calendário, fórmula, barra, comparar, lista, números, citação, fim, **palco de ícones**, **piada relâmpago**) |
| `scripts/video/` | `novo`, `transcrever`, `buscar`, `cortar`, `sincronizar`, `montar`, `produzir`, `status`; `ancoras.ts` (tempos por frase) |
| `scripts/hf/` | `build-trecho.ts` (beats.json → HTML), `render-trecho.ts` (MP4 na placa), `lucide-svg.ts`, `profundidade.py` |
| `scripts/assets-inventario.ts` | gera `docs/assets/inventario.md` a partir de `D:\YT\!Assets` |
| `public/mascote/` | Furry: `fox1-4.png` e os loops animados `fox1-4.webm` (o build usa o loop) |
| `public/icons/`, `src/lucide-animated/` | ícones (os 56 do canal e 468 Lucide Animated); Lucide estático vem do `lucide-react` |
| `src/house/`, `src/presets/`, `src/` | motor Remotion antigo (trechos do COE) e o formato da folha de batidas (`src/house/beats.ts`) |
| `.agents/skills/` | skills: `ofurry-organizar-video`, `ofurry-fazer-cenas`, `ofurry-house-motion`, `hyperframes*`, `motion-design`... (`bun run skills:link` liga em `.claude/skills/`) |
| `docs/` | padrão, preferências, ADRs, análise do canal, inventário de assets |
| `referencias/` | vídeos de referência (fora do git) e as análises (no git) |

## 4. Assets do PC (`D:\YT\!Assets`)

Tudo que serve para mais de um vídeo mora em `D:\YT\!Assets` (~5 GB). **Lista completa e pesquisável, arquivo por
arquivo, com o caminho que vai no código: [`docs/assets/inventario.md`](docs/assets/inventario.md)** (atualize com
`bun run assets:inventario`). Mapa geral do `D:\YT`: `D:\YT\INDEX.md`.

| Preciso de... | Onde | No código |
|---|---|---|
| **efeito sonoro** (~2.000, por categoria) | `PACK - EFEITOS SONOROS\` | `@sfx/<pasta>/<arquivo>` |
| ↳ dinheiro, moedas, caixa | `Foley\Coins *`, `General\cash ting.mp3`, `General\Cash Register.mp3`, `General\Coins.wav` | |
| ↳ clique, pop, ding, notificação | `General\Click.wav`, `General\Pop sound.mp3`, `General\Ding.mp3`, `Communications\` | |
| ↳ contador, dados, digitação | `General\Digital counting.mp3`, `General\Typewriter.mp3`, `Science Fiction\Sci Fi Beep *` | |
| ↳ papel, caneta, escritório (risco, anotação) | `Office Supplies\` (108) | |
| ↳ máquina, engrenagem, interruptor | `Mechanical\Gadget *`, `Mechanical\Switch *` | |
| ↳ certo / errado / perder | `General\correct sfx.mp3`, `General\Lose.wav` | |
| ↳ relógio, tempo | `General\Clock Tick.mp3`, `General\Clock ticking fast.mp3` | |
| ↳ humor (piada, meme) | `Comical\`, `General\Funny Bonk.mp3`, `General\RECORD SCRATCH #2.mp3` | |
| ↳ impacto (1–2 por vídeo, baixo), riser | `Impact\`, `Impacts\`, `General\Ascending sound effect.mp3` | |
| ↳ **não usar** | `_descartados\`, `Weapons\`, `Background Gunfire\`, `Horror\`, `Horros SFX\` | |
| **whoosh** (nunca em legenda) | `Swoosh effects\` | `@sw/<arquivo>` |
| **música de fundo** | `Musicas\` (biblioteca do YouTube, sem crédito); `Musicas\Infraction - No Copyright Music\` (**crédito obrigatório**, ler o `readme.md` de lá) | `@mus/<arquivo>` em `videos/<id>/trilha.json` |
| ↳ mais músicas | YouTube Studio → Biblioteca de áudio (o João deixa aberta no navegador); salvar em `Musicas\` | |
| **mascote Furry** | `Furry\fox1-4.png` (poses) e `Furry\fox1-4_loop_fhd.webm` (animados, transparentes); ícones do canal `Furry\Icon Principal.png` | cópia em `public/mascote/` (o build usa o `.webm`) |
| **ícones** | no código: qualquer Lucide pelo nome (`wallet`, `piggy-bank`, `landmark`...), mapa em `.agents/skills/ofurry-house-motion/references/icones-financas.md`; no PC: `Icones\` (56 PNG, estilos misturados, uso raro) | `"icone": "wallet"` |
| **animações prontas** | no código: as cenas do kit (`hf/kit/ofurry-cenas.js`), 468 Lucide Animated, 31 presets Remotion (`src/presets/`); no PC: `MESTRES DO VINTADE\` (poeira, ruído, granulado), `Efeitos-Videos-Green-Screan\` | |
| **B-roll real (vídeo filmado)** | por vídeo: `videos/<id>/acervo/broll/` (créditos em `CREDITOS.md`); fonte: mixkit.co (só licença "Free"), Pexels, Pixabay | `bun run broll:preparar <id> <arquivo> <nome>` e `"kind": "broll"` |
| **memes** | `Meme\` (gatos, sirene, explosão em green screen) | |
| **thumbnail** | `TEMPLATE - THUMBNAIL\` (PSD); thumb gerada pelo Google Flow (ver `D:\YT\Docs`) | |
| **avatares e banners** | `Canais\` | |

Regras: não editar o original (copie para a pasta do vídeo); não renomear nem mover arquivo já usado; som reprovado vai
para `_descartados\`; material novo só com licença conferida. **Nada de imagem gerada por IA nas cenas.**

## 5. Onde ficam os vídeos no PC

| O quê | Onde |
|---|---|
| material bruto de cada vídeo (áudios, roteiro, prints, narração final) | `D:\YT\OFurry\<vídeo>\` (ex.: `D:\YT\OFurry\177\`) |
| edição (trechos, cenas, renders, final) | este repo, `videos/<id>/` (os MP4 e WAV ficam fora do git) |
| o que já aprendemos fazendo vídeo (som, render, thumb, direitos) | `D:\YT\Docs\INDEX.md` (perfil OFurry em `D:\YT\Docs\perfis\ofurry\`) |
| vídeos de outros clientes (Matheus/Alves) | `D:\YT\Matheus (Alves)\` |

## 6. Ferramentas instaladas

Bun, HyperFrames 0.8.193 (`npx hyperframes@0.8.193`), Parakeet (transcrição local), ffmpeg com NVENC (RTX 3050),
Python 3.12 + `~\.venvs\depth` (Depth Anything V2), `agy` (Antigravity; imagem gerada por IA está fora do padrão).
