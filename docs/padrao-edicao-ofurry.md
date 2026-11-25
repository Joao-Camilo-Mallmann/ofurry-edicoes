# Como editamos um vídeo OFurry (padrão de edição v2)

Escrito em 20/11/2026, a partir do vídeo **177 mil** (o primeiro editado inteiro neste padrão, pilotos aprovados pelo
João em 20/11/2026). É o "como" da edição. O "como fica" (cores, fontes, receitas H1–H10, mascote) continua em
`.agents/skills/ofurry-house-motion/SKILL.md`, medido nos 7 vídeos publicados. Decisão registrada em
`docs/ADR/ADR-007-padrao-edicao-v2.md`.

Fontes deste padrão:
- análise do canal: `docs/referencias/analise-canal-2026-10.md` e os catálogos;
- pesquisa externa de retenção e motion (Vox, Kurzgesagt, FT/Storytelling with Data, doc de produção do MrBeast,
  Mayer): resumo na seção 9;
- boas práticas já aprendidas em `D:\YT\Docs\global\` (som, efeitos, texto, render);
- o que funcionou nos pilotos do 177.

---

## 1. A ideia em uma frase

**O Furry explica com uma imagem por ideia, que muda no ritmo da fala.** Cada frase com número vira número na tela;
cada conceito vira um objeto que se mexe (curva, balança, máquina, calendário); a legenda cinética preenche o resto; o
Furry aparece para respirar e opinar.

## 2. Estrutura de um vídeo (o esqueleto que retém)

| Momento | O que acontece | No 177 |
|---|---|---|
| 0–30 s **gancho** | promessa + inimigo comum + objeto sem nome + Furry com a tag + **loop aberto** em lista (1-2-3) | milhão contando → curva com "???" → máquina → 1 MILHÃO e 100 MIL riscados → Furry → calendário "DESISTIU" → "qual é, de onde vem, quanto falta" |
| até ~1 min **payoff do título** | o número/promessa da thumb aparece grande | R$ 177 MIL no trecho 02 |
| a cada 45–60 s **novo loop** | fecha uma pergunta e abre outra (máximo 2 abertas) | "de onde vem" → a conta; "quanto falta" → a jornada |
| ~3 min e ~6 min **reengajamento** | troca forte de imagem + som próprio | máquina ligando (3:44); simulação mês a mês (5:40) |
| clímax | a virada, com o único riser do vídeo | curva cruza a reta + balança + máquina (8:00) |
| fim | **fim seco**: tela do próximo vídeo começa logo depois da última frase útil | "Como investir melhor que 90%" + "eu sou o Furry" |

Capítulos: sem 1 s de silêncio (regra antiga da skill, reprovada no Na Hora do Almoço). A troca de capítulo é troca
de fundo + título de seção (H8) quando o bloco tem 3+ itens.

## 3. Ritmo

- **Algo novo a cada 1–2 s, nunca mais de 4 s parado** (o vídeo de maior retenção do canal troca 44×/min).
  `bun run house:lint` cobra. Movimento contínuo conta como novidade: curva se desenhando, câmera, máquina.
- **Legenda cinética em ~30% do tempo**, 1–2 palavras, 84 px, Montserrat 800 caixa alta. Desligada durante cenas de
  dados (o gráfico já é o texto). Sobre o mascote, embaixo (`y: 0.72`).
- **Mascote em 20–30% do tempo**, como respiro depois de rajada densa ou em opinião/ironia; pose nova a cada 2–4 s.
- **Zero tela preta com voz.** Zero texto que a narração não diz, com UMA exceção: a **piada relâmpago** (`piada`):
  na cara, grande, mas fica ~1 s ou poucos quadros na tela, para quem pausar achar; 1 a cada ~30–60 s (pedidos do
  João em 20/11/2026: "umas piadinhas... trocadilhos... para dar um pouco mais de vida para os motion" e "podem ser
  piadas mais na cara, mas duram no máximo um segundo ou poucos frames, pra ter que parar o vídeo e encontrar").
  Sem pontuação no texto de tela.
- **B-roll real e variado** (pedido do João em 20/11/2026): imagem filmada de verdade que mostre o que a fala diz
  (multidão em "todo mundo", relógio em "passa anos", pizza em "uma pizza"), em inserts de 0,6 a 2,5 s, entre as
  cenas de ícones e de dados. Nunca imagem gerada por IA. Fonte: banco com licença comercial livre (Mixkit com
  licença "Free"; Pexels/Pixabay quando acessíveis), sempre registrado em `videos/<id>/acervo/broll/CREDITOS.md`.
  Preparar com `bun run broll:preparar` (1920x1080, sem som, cor puxada para o preto da casa, vinheta). Na batida:
  zoom lento sempre, entrada `flash`/`zoom`/`whip`/`corte`, `moldura` para o quadro inclinado, legenda por cima.
- **Gancho (0–30 s) é a parte mais densa do vídeo**: troca a cada ~0,7 s (~30–40 trocas), alternando B-roll real,
  palco de ícones, número, gráfico, Furry e legenda cinética, cada troca na palavra. Exemplo: `videos/177/output/trecho-01`.
- Fundos (preto, grade, estrelas) trocam a cada ideia nova; cada trecho usa pelo menos 2.
- **Furry (João, 24/11/2026: "troca meio sem sentido... garante que ele se enquadra sempre no meio perfeitamente...
  sempre faz a mesma animação para direita e para baixo"):** âncora fixa: todas as poses com o centro das pernas no
  mesmo x e a mesma base e escala. Desde 24/11/2026 as animações de origem já vêm alinhadas
  (`scripts/mascote-alinhar-originais.py`, cópia dos originais em `D:\YT\!Assets\Furry\_originais-antes-do-alinhamento`);
  pose nova: rode esse script e depois `scripts/mascote-ancoras.py` (o build ainda corrige o que sobrar). Pose só troca quando a fala muda de ideia, ironiza, pergunta ou enfatiza, e cada
  pose fica pelo menos 2,5 s (o build engole a mais curta). Entrada gira entre subir, deslizar (lado alternado),
  crescer e corte seco; a ida para o canto alterna esquerda e direita. Nunca espelhado, nunca 3D.
- **Proibido etiqueta inclinada com borda ou moldura** (piada, carimbo, selo): "é IA slop" (João, 24/11/2026). Piada
  relâmpago e carimbo são texto reto, grande, com contorno preto. Ícone animado anima uma vez, na entrada (em loop
  ele passa a maior parte do tempo meio girado e parece quebrado).
- **Texto nunca cortado pelo personagem** a ponto de não dar para ler, e o **Furry só perde a cor quando o João pedir** (a
  colagem P&B com palavras atrás dele foi reprovada em 24/11/2026). **Comparação se mostra com imagem ou gráfico**,
  nunca com dois blocos de texto lado a lado ("esse modelo ficou maçante de texto nessa disposição").
- **Não repetir o mesmo MOVIMENTO em cenas próximas** (João, 24/11/2026: "muda o iconezinho, mas o que ela faz, o
  movimento, é igual... muito enjoado", sobretudo nos primeiros 5 minutos e "muito mais nos primeiros 30 segundos").
  Trocar o ícone não conta como novidade. Entre duas cenas vizinhas muda pelo menos um destes: tipo de cena (palco,
  número, gráfico, tipografia, B-roll, Furry, 3D), direção ou tipo de entrada, câmera do corte e escala. No gancho, cada
  corte traz um recurso que ainda não apareceu (`cameraAuto: false` + lista `camera` escolhida corte a corte). Recursos
  além do palco: `slam` (tipografia em profundidade), `type-on` (digita e apaga), `contador`, `maquina3d`. O close do Furry com fogo
  (B-roll `furry-close-fogo`, cena B da referência) **só em momento de alta tensão**, nunca no gancho comum (João, 24/11/2026).

## 4. Gramática de cenas

Receitas clássicas da casa (H1–H10, `ofurry-house-motion`) + **cenas de dados (C)**, novas neste padrão
(`hf/kit/ofurry-cenas.js`, referência completa em `.agents/skills/ofurry-fazer-cenas/references/cenas-de-dados.md`):

| Quando a fala... | Cena | Notas |
|---|---|---|
| descreve algo acontecendo (dinheiro indo, alguém trocando, esperando) | **C0 palco de ícones** (`palco`) | **o que o João mais gostava nos vídeos antigos**: ícones de traço no preto que entram, andam, trocam de lugar e mandam coisas um para o outro. Primeira opção sempre que a frase tem ação. |
| fala de crescimento no tempo | **C1 gráfico** (`grafico`) | montado peça por peça: eixos → reta do aporte → curva. **Câmera segue a ponta** (`vista`), rótulo direto na ponta (sem legenda de gráfico), marcos que entram na palavra. Cruzamento curva × reta = anel amarelo + "A VIRADA". |
| cita uma planilha/simulação | **C2 tabela** (`tabela`) | gerada dos números certos, inclinada em 2.5D, rola até a linha citada e acende. Substitui print de planilha. |
| compara duas forças | **C3 balança** (`balanca`) | inclina pelo valor; verde quando o rendimento vence. |
| fala da "máquina de dinheiro" / renda passiva | **C4 máquina** (`maquina`) | liga na palavra, visor conta, notas saem; ritmo acelera quando a fala diz "mais forte". |
| fala de prazo / anos / idade | **C5 calendário** (`calendario`) | 120 quadradinhos = 10 anos; acende acelerando; idade 25→35 ao lado. |
| dá uma regra de bolso | **C6 fórmula** (`formula`) | A × 177 = B, uma linha por exemplo. |
| divide um total | **C7 barra** (`barra`) | do seu bolso (branco) + juros (verde). |
| compara dois valores | **C8 comparar** (`comparar`) | A × B, o perdedor apaga. |
| lista passos / loop aberto | **C9 lista** (`lista`) | número laranja, item ativo em amarelo. |
| cita marcos que vai negar | **C10 números** (`numeros`) | entram e são riscados em vermelho. |
| cita frase famosa | **C11 citação** (`citacao`) | com selo (ex.: ATRIBUÍDA quando a autoria é duvidosa). |
| chama o próximo vídeo | **C12 fim** (`fim`) | quadro vazio para o card de fim de tela. |

Regra de ouro: **um objeto grande por vez**. Se a cena pode ser resolvida com um elemento grande se mexendo bem, não
coloque três pequenos.

## 5. Visual

- Tokens da casa: preto `#000`, texto `#FDFDFD`, verde `#2EE04A` ganho/rendimento, vermelho `#E3141B` perda, amarelo
  `#F4E812` virada/destaque, laranja `#FF9900` marca, ciano `#22D3EE` apoio. Montserrat + Bebas Neue, nada mais.
- **Câmera 2.5D em toda cena de dados**: perspectiva leve, drift lento e push-in de ~4% (`OF.stage`). Nada de
  rotação senoidal.
- **2D limpo, no estilo do canal.** O padrão é 2D/2.5D desenhado em código (SVG + CSS 3D leve, traço branco, neon
  só na cor do significado), que renderiza rápido e é determinístico.
- **Imagem 3D gerada por IA: NÃO.** Em 20/11/2026 testamos imagens-herói do agy/Nano Banana (máquina, "177" em metal,
  bola de moedas) e o João reprovou: "ficou com cara de IA slop, detestei, o demais simples em 2D legal; no estilo do
  canal do Furry". A cena `foto3d` continua no kit só para foto/print real com profundidade, não para arte gerada.
- Mascote **animado**: os loops com alfa do Furry (`public/mascote/foxN.webm`, cópia de `D:/YT/!Assets/Furry/foxN_loop_fhd.webm`:
  rabo, mão, orelhas, respiração). No `beats.json` continue citando `foxN.png`; o build troca pelo `.webm` quando ele
  existe (pedido do João em 20/11/2026: "usar os animados dele, não os png"). fox1 explicando, fox2 empolgado, fox3 sem
  graça, fox4 ombros. Cada pose dura até 8 s (tamanho do loop).
- Nunca: marca d'água (o `main-black-grid.mp4` tem "Veo"), card cinza de SaaS, ícone de estilo misturado, texto em
  inglês, "-R$" em verde.

### Luz e overlay por bloco (desde 24/11/2026)

João: "variar mais o efeito de luz e overlay da tela também". Antes todo trecho tinha a mesma pelicula e o mesmo leak.
Agora cada trecho declara `"look"` no beats.json: pelicula (`riscos`, `pontos`, `filme`, `grao`, `poeira`), luz ambiente
nas bordas (`fria`, `quente`, `verde`, `vermelha`, `dourada`, `neutra`, `teal`, `roxa`, `magenta`, `nenhuma`) com `forca`, `lado` e `curva`
(`sobe`, `desce`, `pulsa`), `vinheta`, `extra` (`scanlines`, `bokeh`), o leak dos cortes "luz" (`borda`, `laranja`,
`frio`, `verde`, `dourado`, entrando de um lado diferente a cada corte) e o ruído dos cortes "glitch" (`vhs`, `linhas`).
Catálogo visual: `D:\YT\!Assets\Overlays\catalogo.png`.

- **Regra:** dois trechos seguidos nunca têm a mesma combinação pelicula + luz + extra (o `hf:build` avisa).
- **A luz conta a história:** fria e apagando na fase chata; quente e subindo quando a máquina liga e na virada;
  verde no ganho; dourada no número mágico e no milhão; vermelha no erro; cinza só no Einstein (`telaCinza`).
- **Luz do fundo preto também é do bloco** (João: "sempre luz amarela no mesmo ângulo"): o brilho do fundo `black`
  usa a cor do `look` e muda de jeito a cada troca de fundo: `deriva` perto de um canto, `varre` de um lado ao outro,
  `pulsa` parada num lugar, `contraluz` embaixo no centro (atrás do Furry); lado, tamanho e formato também variam.
  Laranja/amarelo da marca só nos blocos de destaque (gancho, máquina, virada, número mágico, milhão, CTA).
- **Revelação pulsa:** em todo corte `flash` ou `punch` a luz da borda pulsa forte e volta em ~1 s.
- **Sem lavar a tela:** a luz fica nas bordas, o bokeh só nas faixas laterais, e tudo apaga nas cenas de papel. Depois
  do render, `bun run video:qa <id>` acusa tela clara sem conteúdo.

| Parte (177) | Bloco | Pelicula | Luz | Extra | Leak |
|---|---|---|---|---|---|
| 01 | gancho | riscos | vermelha, pulsa | - | laranja |
| 02 | contexto | grão | roxa, sobe | - | borda |
| 03 | o problema (R$ 5) | pontos | fria, desce | - | frio |
| 04 | o problema (desiste) | grão | fria, desce | scanlines | frio |
| 05 | Einstein | filme | neutra (tudo cinza por cima) | - | borda |
| 06 | a conta | riscos | teal | scanlines | borda |
| 07 | a máquina liga | poeira | quente, sobe | bokeh | laranja |
| 08 | o erro | riscos | vermelha | - | borda |
| 09 | pergunta | grão | nenhuma (respiro) | - | borda |
| 10 | jornada: mês 2, ano 1 | pontos | fria, sobe | scanlines | frio |
| 11 | anos 2 a 5 | filme | teal, sobe | - | borda |
| 12 | a virada (mês 73/80/120) | riscos | dourada, forte | bokeh | dourado |
| 13 | 123 + 54 | grão | verde | - | verde |
| 14 | o calendário | poeira | roxa | scanlines | laranja |
| 15 | a solução | filme | verde, sobe | - | verde |
| 16 | passo 1 | grão | teal | scanlines | borda |
| 17 | passos 2 e 3 | riscos | magenta | - | laranja |
| 18 | número mágico | pontos | dourada | bokeh | dourado |
| 19 | benefícios | filme | verde, sobe | - | verde |
| 20 | o milhão | poeira | dourada, forte | bokeh | dourado |
| 21 | CTA | riscos | quente, desce | - | borda |

## 6. Som

- **Narração é o conteúdo.** Chega masterizada a -14 LUFS; nada cantado por cima.
- **Trilha contínua, uma curva para o vídeo inteiro** (`videos/<id>/trilha.json`): cada faixa começa num trecho e
  emenda na próxima com crossfade de 6 s; cada faixa é nivelada sozinha para ficar **21 LU abaixo da voz** (resolve o
  "fim forte, começo fraco" medido no Na Hora do Almoço). Música da biblioteca do YouTube por padrão (sem crédito). Se
  usar Infraction: crédito obrigatório na descrição (AGENTS.md 0.2), e o `video:montar` avisa.
- **Efeito sonoro só em evento da cena** (`sfx` no beats.json, ancorado na fala): máquina ligando, moedas, ding em
  marco, clique em item de lista, papel no risco, câmera na prova. **Legenda entra sem som.** Um riser antes do
  clímax; no máximo 1–2 impactos no vídeo todo; ganhos de -24 a -16 dB; nada de rumble/subgrave.
- Mix final em -14 LUFS, pico real ~-1,5 dBTP (`video:montar` mede e imprime).

## 7. Números e texto

- **Na tela vale o número do roteiro/briefing.** Onde a narração falou errado, a tela mostra o certo e o erro vai para
  a lista de regravação.
- A transcrição automática erra (Parakeet: "Bin Reais", "pão de queiros"). Correções de TEXTO ficam em
  `videos/<id>/midia/revisao.json` (`de` → `para`); os tempos nunca mudam e a revisão se reaplica sozinha depois de
  uma regravação.

## 8. Fluxo: próximo vídeo, do roteiro + áudio ao render

O João traz **roteiro (ou briefing) + narração final** (wav/mp3). O resto é daqui:

```text
1. bun run video:novo <id> --titulo "..." --audio narracao.wav        pasta videos/<id>/
2. copiar roteiro para videos/<id>/roteiro.md (e briefing.md com os números)
3. bun run video:transcrever <id>                                      Parakeet local, palavra por palavra
4. midia/revisao.json: corrigir nomes e números (ler o texto inteiro contra o roteiro)
5. bun run video:dividir <id> --aplicar                              divide em PARTES (ver abaixo) no video.json
   bun run video:sincronizar <id>                                      recorta tudo pelas frases
6. storyboard.md: plano de cenas por trecho (seção 4) -> APROVAÇÃO do João
7. 1–2 pilotos: beats.json (âncoras "@frase" + sfx) -> bun run hf:build <id> XX -> snapshot -> hf:render
   bun run video:montar <id> --trechos 01,XX                           prévia com trilha e efeitos
8. aprovado: beats.json dos outros trechos (dá para dividir entre agentes, cada um com seus trechos)
9. trilha.json (faixas por trecho)
10. bun run video:produzir <id>                                         build + render do que mudou + montagem
    -> videos/<id>/final/<id>-final.mp4 (1920x1080, -14 LUFS)
```

**O vídeo é sempre feito por partes** (pedido do João em 20/11/2026: "renderizar sempre o vídeo por partes e no
final juntar tudo... mais fácil se eu quiser editar alguma parte em específico"). Cada parte (`output/trecho-XX/`)
tem suas cenas, renderiza sozinha na placa (~1 min) e o `video:montar` só junta as partes e refaz o áudio inteiro.
- **Como dividir (`video:dividir`):** cada seção do roteiro é no mínimo uma parte (nunca duas ideias numa parte);
  seção com mais de 55 s é cortada em fim de frase, na pausa mais longa entre 20 e 55 s (alvo 40 s); seção com menos
  de 20 s se junta à seguinte quando cabem juntas (ex.: CTA + gancho final); cada parte começa numa frase (`de`).
- **Achar a parte de um minuto do vídeo:** `final/partes.md` (gerado pelo `video:montar`), que também traz os
  capítulos prontos para a descrição do YouTube.
- **Mexer numa parte:** editar `output/trecho-XX/beats.json` e `bun run video:produzir <id> --trechos XX`
  (renderiza só essa parte e junta o vídeo de novo).
- **Emenda:** o que aparece primeiro numa parte começa no quadro 0 (o build puxa sozinho), para a junção não piscar.

Narração mudou (regravação)? `bun run video:sincronizar <id> --audio nova.wav` e depois `bun run video:produzir <id>`.
As âncoras "@frase" re-sincronizam as cenas; só os trechos cuja imagem mudou são renderizados de novo. Se uma frase
sumiu, o build para e aponta a âncora: ajuste ou tire a batida.

## 9. Por que (resumo da pesquisa)

- **Primeiro minuto** concentra a maior perda; o YouTube mede "quem continua aos 30 s". Gancho pagando a promessa e
  loop aberto explícito. (Doc de produção do MrBeast; dados de praticantes como Retention Rabbit.)
- **Destacar o essencial** na tela tem efeito forte em aprendizagem (Mayer, sinalização ~0,70); repetir na tela a
  frase inteira quase não ajuda (redundância ~0,10). Daí legenda de 1–2 palavras e números grandes, não frases.
- **Gráfico montado peça por peça**, rótulo direto na linha, cor só no que importa (Burn-Murdoch/FT, Storytelling
  with Data, Vox).
- **Reengajamentos** por volta de 3 e 6 min; **fim seco** (MrBeast).
- Os números de "trocas por minuto" não têm estudo por trás; a régua real é o gráfico de retenção do próprio canal.
  Depois de publicar, compare a curva do 177 com a do vídeo 1 (37,7% de retenção) e ajuste este documento.

## 10. Checklist de entrega

- [ ] `house:lint` sem "parado"/"preto-com-voz" em todos os trechos; `hyperframes check` sem erro.
- [ ] Snapshots revisados: números iguais ao briefing, nada cortado, rótulos sem colisão.
- [ ] `video:montar`: volume -14 LUFS, pico ≤ -1 dBTP, sem efeito em legenda.
- [ ] Final em `videos/<id>/final/<id>-final.mp4`, 1920x1080, na placa (NVENC); versão anterior em `versoes-antigas/`.
- [ ] Lista de números falados errado + frases para regravar entregue ao João.
- [ ] Música do Infraction? Avisar o crédito (só avisar).
- [ ] Aprendizado novo → `D:\YT\Docs` (global ou perfil OFurry).
