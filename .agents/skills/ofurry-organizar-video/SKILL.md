---
name: ofurry-organizar-video
description: Organiza um video novo do canal OFurry Investidor antes de qualquer cena - cria a pasta, transcreve a narracao com tempo por palavra, divide em trechos alinhados ao roteiro, monta o plano editorial em prosa de cada trecho (checkpoint para aprovacao) e o inventario de acervo (poses do mascote, prints, b-roll). Use quando o usuario chegar com roteiro e/ou narracao gravada, pedir para organizar, dividir, planejar ou ver o andamento de um video. Nao gera cenas; a skill ofurry-fazer-cenas pega daqui.
license: MIT
metadata:
  author: OFurry Motion Lab
  version: "1.0.0"
---

# Organizar video (OFurry)

Primeira das duas skills de producao. Ela transforma **roteiro + narracao gravada** em **trechos prontos para
virar cena**: cada trecho tem seu audio, suas palavras com tempo e um plano editorial aprovado.
A skill `ofurry-fazer-cenas` so comeca num trecho com `plano.md` em estado **APROVADO**.

O visual e as receitas vem de `.agents/skills/ofurry-house-motion/SKILL.md`; o jeito de editar (estrutura do video,
ritmo, cenas de dados, som, fluxo completo) vem de `docs/padrao-edicao-ofurry.md`. Leia os dois antes de planejar.
Exemplo completo de video organizado neste padrao: `videos/177/`.

**Atalho (padrao desde 20/11/2026):** o João traz roteiro + narracao final; os passos 1-5 abaixo viram
`video:novo` -> `video:transcrever` -> `midia/revisao.json` -> trechos com `de` no `video.json` -> `video:sincronizar`.
Em vez de um `plano.md` por trecho, um `storyboard.md` do video inteiro (uma secao por trecho) e 1-2 pilotos
renderizados vao para aprovacao de uma vez.

## 1. Estrutura de um video

```text
videos/<id>/
  video.json            manifesto: titulo, narracao, transcricao, lista de trechos com inicio/fim
  roteiro.md            roteiro completo (unica fonte de contexto entre trechos)
  briefing.md           numeros corretos (tabela), titulos, thumb: na tela vale o numero daqui
  storyboard.md         plano de cenas do video inteiro (checkpoint de aprovacao)
  trilha.json           musicas por trecho (curva continua; ver video:montar)
  final/                <id>-final.mp4, previas, mix, versoes-antigas/
  midia/
    narracao.wav        locucao completa
    transcricao.json    palavras com tempo (revisada: bruta + revisao.json)
    transcricao.bruta.json  saida crua do Parakeet (video:sincronizar guarda)
    revisao.json        correcoes de TEXTO [{de, para, nota}]: reaplicadas sozinhas depois de regravar
    transcricao.vtt     mesma coisa, uma palavra por cue
  acervo/
    prints/  broll/  imagens/
  output/
    trecho-01/
      midia/narracao.wav   audio do trecho (tempo 0 = inicio do trecho)
      midia/narracao.json  palavras do trecho
      plano.md             checkpoint editorial (RASCUNHO -> APROVADO)
      beats.json           folha de batidas (escrita pela ofurry-fazer-cenas)
      hf/                  projeto HyperFrames gerado
      render/              MP4 pronto do trecho (1920x1080)
```

Poses do mascote ficam em `public/mascote/` (compartilhadas por todos os videos), em PNG transparente.

## 2. Passo a passo

1. **Criar o video.**
   `bun run video:novo <id> --titulo "..." --roteiro <roteiro.md> --audio <narracao.wav|mp3|mp4>`
   O `<id>` e curto, minusculo, com hifens (`coe`, `bitcoin-2030`).
2. **Transcrever.** `bun run video:transcrever <id>` usa o **Parakeet** local do HyperFrames
   (parakeet-tdt-0.6b-v3, multilingue, roda no computador, ~1 min para 9 min de narracao). Instalacao unica,
   ja feita nesta maquina: `npx hyperframes@0.8.193 models install parakeet`. Alternativas:
   `--motor whisper --modelo medium` (precisa do runtime do Whisper) ou, se o usuario ja tem legenda do
   CapCut/Premiere/YouTube, `--importar legenda.srt`.
3. **Revisar a transcricao** (em `midia/revisao.json`, nunca editando `transcricao.json` direto). Compare `midia/transcricao.json` com o roteiro e corrija nomes, numeros e
   termos ("COE", "call spread", "R$"). Erro de transcricao virou erro na tela em 6 dos 7 videos analisados.
   O Parakeet erra palavras parecidas em som (no teste: "a sua liberdade" saiu "a solidariedade",
   "ganhar" saiu "engar"): leia o texto inteiro contra o roteiro, so troque o campo `text`, nunca os tempos.
   Nao reescreva a fala: o texto tem que ser o que foi dito. Excecao: **numero falado errado** vira o numero certo
   na revisao (a tela mostra o certo) e entra na lista de regravacao para o João (`midia/frases_para_regravar.txt`).
   Formato: `[{ "de": "uns 54 reais", "para": "uns 64 reais", "nota": "NUMERO: narrado 54, certo 64" }]`.
4. **Dividir em trechos (partes), por FRASE.** `bun run video:dividir <id>` propõe as partes (seção do roteiro,
   cortes em fim de frase na pausa mais longa, 20–55 s) e `--aplicar` grava no `video.json`. No `video.json`, cada trecho tem `de` = a frase que o abre; depois
   `bun run video:sincronizar <id>` recorta todos (audio + palavras) e mostra a tabela de tempos. Esse e o jeito
   padrao: quando a narracao muda, o mesmo comando recorta tudo de novo. O metodo antigo abaixo continua valendo
   para cortar um trecho avulso. Um trecho = 20 a 60 s de fala com uma ideia so, normalmente um bloco do roteiro
   ou metade dele. O gancho (0-30 s) e sempre o trecho-01. Para achar os tempos:
   `bun run video:buscar <id> "primeira frase do trecho" "ultima frase do trecho"`
   e depois o comando que ele imprime:
   `bun run video:cortar <id> <XX> <inicio> <fim> --titulo "..." --bloco "BLOCO 3"`
5. **Plano editorial (checkpoint).** Preencha `output/trecho-XX/plano.md`: a ideia do trecho em 1 frase, a
   tabela de batidas (o `video:cortar` ja escreve as falas com tempo; complete receita H1-H10 e elemento),
   fundos, acervo necessario e continuidade com o proximo trecho. Regras para montar a tabela:
   - algo novo na tela a cada 1-2 s; nada parado mais que 4 s;
   - legenda cinetica (H1) e o padrao; troque por icone (H3), numero (H5) ou prova (H6) quando a fala
     citar objeto, valor ou fonte;
   - mascote (H4) depois de rajada densa ou em opiniao/ironia, nunca mais que 4 s sem pose nova;
   - trecho-01 segue o gancho padrao da `ofurry-house-motion` (pergunta digitada, rajada, objeto sem nome,
     thumbnail, mascote com tag, prova);
   - todo icone com nome do Lucide (`references/icones-financas.md` da house-motion).
6. **Apresentar e aprovar.** Mostre o plano ao usuario em prosa/tabela, sem codigo. So com o ok explicito
   dele troque `Estado: RASCUNHO` por `Estado: APROVADO`. Ajustes pedidos voltam para o passo 5.
7. **Acervo.** Liste o que falta (poses, prints, b-roll) e diga onde colocar. Print de noticia: recorte so
   a parte util, sem marca d'agua. B-roll de IA: sem marca d'agua (Veo) nem texto em ingles ilegivel.
8. **Andamento.** `bun run video:status <id>` mostra cada trecho: sem plano, rascunho, aprovado, batidas
   escritas, cenas geradas, renderizado.

## 3. Regras

- Um trecho por vez, na ordem do roteiro. O plano de um trecho nao le o codigo de outros trechos, so o
  `roteiro.md` e o `plano.md` do trecho anterior (para continuidade).
- Tempos sempre do audio do trecho (comecam em 0). Nunca escreva tempos "de cabeca": use a tabela gerada.
- Se a narracao mudar (regravacao, corte): `bun run video:sincronizar <id> --audio nova.wav` (copia, transcreve,
  reaplica a revisao, recorta tudo pelas frases) e depois `bun run video:produzir <id>`. As cenas usam ancoras
  "@frase" e se re-sincronizam sozinhas; se uma frase sumiu, o build aponta a ancora para ajustar.
- Nao invente falas, numeros ou fontes que nao estejam no roteiro/narracao.
- **Musica do Infraction = credito obrigatorio.** Se o plano usa trilha de
  `D:\YT\!Assets\Musicas\Infraction - No Copyright Music\` (caminho `@mus/Infraction - No Copyright Music/...`),
  escreva no `plano.md` uma linha "Credito na descricao:" com o nome da musica, e avise o usuario que a
  descricao do YouTube precisa de nome + link da musica + link de "remove claim" do inaudio.org. Formato e
  links: `readme.md` dessa pasta. Musica nova do Infraction vai para essa pasta, nunca para a raiz.

## 4. Entrega desta skill

Para cada trecho: `midia/` cortada, `plano.md` APROVADO, lista de acervo resolvida ou pendente.
Depois: chamar a skill `ofurry-fazer-cenas` para o trecho.
