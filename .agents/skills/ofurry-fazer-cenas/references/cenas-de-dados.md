# Cenas de dados e metáforas (batida `cena`) + âncoras por frase

Kit: `hf/kit/ofurry-cenas.js` (copiado pelo `hf:build` para `hf/assets/house/`). Cada cena é uma função pura do
tempo: `OF.<tipo>(root, params, inicioDaBatida, duracao)` devolve `render(t)`. Exemplos reais:
`videos/177/output/trecho-01/beats.json` (gancho) e `trecho-12/beats.json` (a virada).

## Âncoras: amarre na fala, nunca em segundos

Todo campo de tempo aceita `"@frase"` no lugar do número (resolvido no build contra `midia/narracao.json` do trecho):

| Escrita | Significa |
|---|---|
| `"@64 reais"` | início da primeira palavra da frase |
| `"@64 reais>"` | fim da última palavra |
| `"@mil reais#2"` | segunda ocorrência no trecho |
| `"@64 reais+0.3"` / `"@64 reais>-0.1"` | com deslocamento em segundos |
| `"@inicio"`, `"@fim"`, `"@fim-0.5"` | começo/fim do trecho |
| `"@guarda esse número\|@Então é agora"` | a primeira alternativa que existir (frase que pode sumir) |

- Sem acento/caixa/pontuação na comparação. A frase precisa bater 100%; se não bater, o build para e mostra o
  trecho mais parecido. Use 2–4 palavras distintivas (`"@Mas existe"`, não `"@e"`).
- O texto vem da transcrição REVISADA (`midia/revisao.json` → `transcricao.json`): números já corrigidos
  ("64 reais", "177 mil", "123 mil", "664 mil").
- `"duration"` pode ser omitido: vira a duração do áudio do trecho.
- Frase que pode sair na regravação: marque a batida (ou o sfx/fundo/janela de legenda) com `"opcional": true`.
  Se a âncora deixar de existir, o item some com um aviso, em vez de travar o build.
- Campos de texto/arquivo (`text`, `rotulo`, `titulo`, `file`, `pose`, `src`, `caption`, `texto`, `value`) nunca
  são tratados como âncora.

## Batida `cena`

```json
{ "kind": "cena", "tipo": "grafico", "at": "@Então é agora", "until": "@E é aqui a primeira vez", ...params }
```
Tempos internos (`at` de keyframes, `ligaAt`, `riscaAt`...) são **tempos do trecho** (âncoras valem). Keyframes
`[{ "at", <campo>, "dur" }]` interpolam com ease suave; `dur` padrão ~0,9–1,6 s.

| tipo | params | Uso |
|---|---|---|
| `grafico` | `modo`: `rendimento` (R$/mês, com a reta do aporte) ou `patrimonio` (área do bolso + juros); `meses`, `aporte` (1000), `taxa` (0.07); `revela:[{at,mes,dur}]` até onde a curva está desenhada; `vista:[{at,x,y,dur}]` câmera (janela 0..x meses, 0..y reais); `marcos:[{mes,at,rotulo,cor,lado:'cima'\|'baixo'\|'esq'\|'dir',ate}]`; `titulo`; `virada` (true: anel + `viradaTexto` quando a curva cruza a reta); `rotuloCabeca` (false esconde o valor na ponta); `semMes`; `mostrarAporte`; `aporteTexto` | curva × reta, câmera que segue a ponta |
| `tabela` | `meses`, `rolar:[{at,mes,dur}]` linha central; `destaques:[{at,mes,cor,ate}]`; `colunaDestaque:[{at,col,ate}]` (0 MÊS, 1 APORTE, 2 RENDIMENTO, 3 PATRIMÔNIO); `titulo` | simulação mês a mês |
| `balanca` | `esquerda`, `direita` (rótulos), `base` (1000), `valores:[{at,v,dur}]` (valor do prato direito) | aporte × rendimento |
| `maquina` | `ligaAt`, `ritmo:[{at,v}]` notas/s, `contador:[{at,v,dur}]` visor, `rotulo`, `rotuloAt`, `escala`, `x` | máquina de imprimir dinheiro |
| `calendario` | `meses` (120), `preenche:[{at,m,dur}]`, `marcos:[{mes,at,cor,rotulo,ate}]`, `idade` (mostra 25→35), `titulo` | 120 quadradinhos = 10 anos |
| `formula` | `linhas:[{at,a,b,bAt,op,cor,ate}]`, `operador` ('× 177 ='), `titulo`, `tituloAt` | A × k = B |
| `barra` | `total` (texto), `totalAt`, `partes:[{at,valor,rotulo,cor}]` | 177 = 123 + 54 |
| `comparar` | `itens:[{at,titulo,valor,valorAt,sub,cor,apagaAt}]` (1–2), `vs` | A × B |
| `lista` | `titulo`, `itens:[{at,n,texto}]`, `ativo:[{at,i}]` | passos 1-2-3, loop aberto |
| `numeros` | `itens:[{at,valor,cor,sub,riscaAt}]`, `riscaAt`, `rotulo`, `rotuloAt`, `y`, `tamanho` | marcos que se riscam |
| `citacao` | `texto`, `autor`, `autorAt`, `selo`, `seloAt` | frase famosa com selo |
| `fim` | `titulo`, `chamada`, `tituloAt` | tela do próximo vídeo (quadro vazio p/ card) |
| `palco` | `atores:[{id,icone,rotulo,cor,tam,keys:[{at,x,y,s,r,o,dur}],entra:'pop'\|'rise'\|'whip',riscaAt,sai,pulsaAt:[at],balanca}]`, `fluxos:[{de,para,at,ate,icone,cor,tam,por,viagem,arco}]`, `setas:[{de,para,at,ate,cor,rotulo}]`, `textos:[{at,ate,texto,x,y,tam,cor,fonte:'cap'\|'num'}]` | **o coração do estilo do canal**: ícones Lucide no preto que entram, andam, trocam de lugar e mandam coisas um para o outro (notas indo da pessoa para o banco, moedas voltando). x/y de 0 a 1 |
| `piada` | `texto`, `at`, `dura` (0.9 s padrão; 0.2 = poucos quadros), `x`, `y`, `rot`, `cor` ('hl' padrão), `tam` (72), `fundo` (tarja preta com borda), `alinha` | **piada relâmpago**: na cara, grande, mas some em ~1 s; quem pausa acha. Por cima de outra cena (batida seguinte no array) |
| `foto3d` | `src` (PNG), `depth` (mapa de profundidade), `camera:[{at,zoom,x,y,px,py,rot,dur}]` (px/py = parallax, -1..1), `grade:{sat,contrast,bright,warm}`, `grain`, `vignette` | foto/print REAL com câmera 3D (WebGL); nunca arte gerada por IA. Caminhos relativos ao beats.json |

### Foto com câmera 3D (`foto3d`)
> **Nunca com imagem gerada por IA** (reprovado pelo João em 20/11/2026: "cara de IA slop"; o canal é 2D limpo).
> Use só com foto ou print real que ganhe com profundidade.

1. A imagem é uma foto/print real (acervo do vídeo).
2. Mapa de profundidade na placa: `C:/Users/jcami/.venvs/depth/Scripts/python.exe -I scripts/hf/profundidade.py
   <pasta-das-imagens> <pasta-saida>` (Depth Anything V2; gera `<nome>-depth.png`).
3. Batida: `{ "kind": "cena", "tipo": "foto3d", "src": "../../acervo/imagens/x.png", "depth": "../../acervo/imagens/depth/x-depth.png" }`.
   Texto/números por cima: batidas seguintes (`number`, legenda) entram por cima da foto.

Cores (`cor`): `text`, `gain` (verde, ganho/rendimento), `loss` (vermelho, perda/desistiu), `hl` (amarelo, virada,
destaque), `brand` (laranja), `info` (ciano), `whisper` (cinza).

## Palco de ícones: como pensar a cena

Pergunte "o que está ACONTECENDO nesta frase?" e encene com ícones (é o que o João mais gostava nos vídeos antigos):
- quem são os personagens (você `user`, mercado/banco `landmark`, cofre `piggy-bank`, carteira `wallet`, empresa
  `building-2`, governo `landmark`, tempo `hourglass`/`calendar`) → `atores`;
- o que vai de um para o outro (dinheiro `banknote`/`coins`, juros `percent`, tempo `clock`) → `fluxos` (o destino
  brilha quando recebe) ou `setas`;
- o que muda (alguém cresce `s`, sai de cena `sai`, é riscado `riscaAt`, troca de lugar com outro: keys cruzadas,
  "pulsa" na palavra `pulsaAt`);
- 1 número ou palavra grande por vez em `textos` (Bebas para valor, Montserrat para palavra).
Mantenha 2 a 4 atores; mova algo a cada 1–2 s; posições em terços (x 0.2 / 0.5 / 0.8, y 0.42); rótulos curtos.

## Piadas relâmpago (`piada`)
O João gosta de piadas e trocadilhos que "dão vida ao motion". Formato atualizado por ele em 20/11/2026: **na cara, mas
rápidas**: "podem ser piadas mais na cara, mas duram no máximo um segundo ou poucos frames, pra ter que parar o vídeo e
encontrar mesmo". Regras:
- `dura` entre 0.2 s (poucos quadros, easter egg) e 1.0 s; entra e sai seco, sem fade, sem som;
- grande e legível ao pausar (72 px, amarelo, tarja preta), num lugar que não tape o número principal;
- 1 a cada ~30–60 s; sempre ligada ao que está na tela ou na fala; nunca contradiz o número;
- exemplos: bala de R$ 5 → "E NEM É DE MENTA"; máquina sem férias → "NEM VALE-REFEIÇÃO PEDE";
  Einstein → "FONTE: CONFIA"; 28 anos para o milhão → "DÁ TEMPO DE VER 7 COPAS"; "desistiu" no mês 100 → "FALTAVAM 24 MESES".

## Efeitos sonoros (`sfx` no beats.json)

```json
"sfx": [ { "at": "@máquina", "file": "@sfx/Mechanical/Gadget 03.wav", "gain": -18, "len": 1.0, "fadeOut": 0.3, "pico": 0.05 } ]
```
Mixados pelo `video:montar` (não pelo render do trecho). Regras: só em evento da cena (máquina liga, moedas,
risco de papel, clique de item de lista, ding de marco); legenda entra sem som; 1–2 impactos no vídeo todo;
ganho entre -24 e -16 dB. Atalhos: `@sfx/` pack de efeitos, `@sw/` swooshes, `@mus/` músicas.

## Layout: o que já sabemos
- Gráfico ocupa x 250–1690, y 210–860: legenda por cima polui; desligue a janela de legenda durante gráfico,
  tabela, fórmula, barra e comparar (ou use `y: 0.12`, topo).
- Mascote `center` + legenda `y: 0.72` (receita H10) funciona; `corner-right` quando divide a tela com número.
- Rótulos de marcos perto da ponta da curva colidem: use `lado` ou `ate` para tirar o anterior.
- `hf:build` → `npx hyperframes@0.8.193 snapshot --at t1,t2 --no-end -o <pasta> --describe false` e OLHE as imagens.
