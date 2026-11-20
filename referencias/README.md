# Referências de vídeo

Pasta para os vídeos que o João manda como referência (do próprio canal ou de outros canais) e para o que a gente
aprende com eles. A análise vira regra do canal em `docs/padrao-edicao-ofurry.md` e nas skills `ofurry-*`.

```text
referencias/
  videos/<nome>/          o vídeo e a legenda (NÃO vão para o git: pesados e com direito autoral)
    video.mp4
    video.pt.vtt          opcional (legenda do YouTube ajuda a cruzar fala x imagem)
    analise/              gerada pelo extrator (folhas de contato, segmentos.json, transcricao.txt)
  analises/<nome>.md      o que aprendemos com o vídeo (vai para o git)
```

## Como mandar uma referência

1. Crie `referencias/videos/<nome-curto>/` (minúsculo, com hífen: `primo-rico-juros`, `ofurry-2030`) e coloque o vídeo
   como `video.mp4`. Se for do YouTube, baixe a legenda junto (`video.pt.vtt`) quando houver.
2. Diga ao Claude: "analisa a referência `<nome-curto>`" e, se quiser, o que te chamou atenção nela.

## Como o Claude analisa (passo a passo)

1. `bun run reference:extract referencias/videos/<nome>` (ou `python -I scripts/reference/extract-motion.py ...`):
   folhas de contato de 3 em 3 s, segmentos de fundo preto e transcrição com tempo, em `analise/`.
2. Olhar as folhas de contato e catalogar **cada tomada**: tempo, tipo (ícone, mascote, legenda cinética, gráfico,
   B-roll, meme, prova, transição...), o que a fala dizia, tipografia, cor, movimento de câmera, som.
3. Escrever `referencias/analises/<nome>.md` com o modelo abaixo. Formato de catálogo completo de exemplo:
   `docs/referencias/catalogos/01-UptGuUMaYMs.md` (vídeo de maior retenção do canal).
4. Separar o que **vale copiar** (com a cena do kit que faz aquilo, ou a cena nova que precisa existir) do que
   **não combina** com o canal (ver `docs/preferencias-do-joao.md`).
5. O que for aprovado pelo João entra no padrão (`docs/padrao-edicao-ofurry.md`) e, se precisar de código, no kit
   (`hf/kit/ofurry-cenas.js`).

## Modelo de análise (`analises/<nome>.md`)

```markdown
# <título do vídeo> (<canal>, <link>)
- Por que é referência: (o que o João apontou)
- Duração, trocas visuais por minuto, % do tempo por tipo de tomada
## O que vale copiar
| Momento | O que acontece | Por que retém | Como fazer aqui (cena do kit / novo) |
## O que não combina com o OFurry
## Pedidos para o kit
## Decisão do João
```

## Já analisados

| Referência | Onde |
|---|---|
| Os 7 vídeos publicados do OFurry (out/2026) | `docs/referencias/analise-canal-2026-10.md` + `docs/referencias/catalogos/` |
| Pesquisa externa de retenção e motion (Vox, Kurzgesagt, FT, MrBeast, Mayer) | `docs/padrao-edicao-ofurry.md`, seção 9 |
