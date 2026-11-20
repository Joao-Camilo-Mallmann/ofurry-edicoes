# Aprendizados: "Na Hora do Almoço (Belchior)"

Escrito em 17/11/2026, antes de fechar o projeto. Cobre o trabalho de 27/10 a 16/11/2026.

> **A versão viva e mais detalhada mora em `D:\YT\Docs\INDEX.md`** (boas práticas por assunto, perfil do
> Matheus e nota deste projeto). Este arquivo é o retrato do dia; aprendizado novo vai para lá.

**De onde saiu este texto.** A sessão em que ele foi pedido começou vazia, então nada aqui vem "de cabeça".
Juntei o que ficou registrado: as 5 memórias salvas do projeto, os cabeçalhos dos scripts em
`videos/na-hora-do-almoco/kit/`, o `DESCRICAO-YOUTUBE.md` e o `LEIA-ME.md` da pasta de entrega, o
`efeitos-sonoros-em-ordem.md` e as mudanças ainda não commitadas do repositório. Onde escrevo "interpretação
minha", é leitura minha de um pedido seu, não algo que você disse com essas palavras.

---

## 1. Onde o projeto parou

- **Vídeo**: 7:03, 1080p, 11 trechos na ordem `01 02 03 04 05 06 61 07 08 09 10` (o 61 é o título "COISA PARECIDA").
- **Finais na pasta `D:\YT\Matheus (Alves)\hora do armoco\`**:
  - `na-hora-do-almoco-final.mp4` (13/11, som v10): a V1 que foi para o Matheus.
  - `na-hora-do-almoco-final-v2.mp4` (16/11, som v11): trilha contínua e sem whoosh, feita depois do retorno dele.
  - As duas estão em `entrega-drive/`. **Não sei se a V2 já foi ouvida e aprovada**: não há registro disso.
- **15 versões anteriores** em `versoes-antigas/` (v1 de 31/10 até v15 de 13/11).
- **Thumb**: escolhida a "mesa cheia / SOZINHO"; alternativas em `videos/na-hora-do-almoco/thumb/`.
- **Repositório** (branch `feat/ofurry-house-motion`): **nada disso está commitado**. Ver seção 9.

---

## 2. Som: o que você e o Matheus ensinaram

Foi onde mais houve retrabalho: 9 passadas de som (v3 a v11). O que ficou:

### A narração é o conteúdo
- Música **cantada** no volume da fala soa como eco do narrador ("parece que está pegando de novo a informação").
  Sob a fala ela fica uns 20 dB abaixo, salvo citação curta alinhada com o que o narrador diz naquele instante.
- Verso cantado tem que entrar **junto ou um pouco antes** da recitação, nunca depois ("toca depois e fica meio fora").
- Nada de texto na tela que a narração não diz ("NINGUÉM SE OLHA" saiu: "fora do roteiro, não tem nenhum sentido").
- Nada de pausa dramática vazia: o 1 s de tela preta em silêncio saiu ("só pula essa parte que não acontece nada").
- Cena sem narração dura perto de 10 s, não 20, e nunca fica parada sem música (interpretação minha a partir do
  corte da cena "COISA PARECIDA" de 20 s para 10 s).

### Efeito sonoro marca um evento, não toda entrada de texto
- `Low End Rumble 01.wav` em 59 entradas de texto foi reprovado ("não faz nenhum sentido com coisa do vídeo,
  devia ser um evento muito específico"). Foi para `PACK - EFEITOS SONOROS/_descartados/`. Não usar de novo.
- Impactos: "no máximo uma ou duas vezes, em cenas muito específicas, bem baixinho". Ficaram 2 no vídeo, a -18 dB.
- "Glitch Static" (arranhado) saiu; onde fazia sentido virou clique de câmera, que combina com o flash branco.
- Whoosh/swish/whip/zing em legenda: eram 85 em 7 min, o Matheus achou alto e desnecessário. Saíram todos na V2.
- O que funcionou: som **ligado ao que aparece** (papel, caneta, talher, pratos pousando, agulha no disco),
  suave e sem subgrave. Hoje são 95 toques de 37 efeitos, listados em `efeitos-sonoros-em-ordem.md`.

### Trilha de fundo contínua
- Trocar de música "sai, quase silêncio, entra outra" a cada capítulo soa como corte. O mesmo vale para a trilha
  sumir quando entra o clipe do Belchior (ela caía para -42 dB em 0,6 s; o maior buraco era 2:24 a 3:04).
- Solução do som v11: as 5 músicas ficam, mas emendadas em **crossfade de 6 s** centrado no corte; sob o clipe a
  cama **desce 8 dB em 2,5 s e volta**, em vez de sumir; cama 21 LU abaixo da voz, 3 dB acima nas pausas de capítulo.
- Detalhe que só a medição mostrou: as músicas começam fracas e crescem 13 a 17 dB até o ponto em que saem. Com
  ganho fixo, toda troca era "fim forte de uma, começo fraco da outra", e crossfade sozinho não resolveria. O ganho
  precisa acompanhar o volume medido de cada música.
- Os ajustes estão no topo de `kit/som-v11-trilha-continua.mjs` (`ABAIXO_DA_VOZ`, `SOB_CLIPE`, `RAMPA`, `XFADE`...).

### Texto de tela
- "Tirar vírgula, ponto e tudo mais, bem clean" (11/11). Ficam só a pontuação dos versos da letra, nomes, arrobas
  e hífens de palavra.

---

## 3. Direitos autorais

### Música do Belchior (Content ID da WMG)
- É reclamação de monetização, **não é strike**.
- **Encurtar reduz as janelas, não elimina.** A reclamação de 13/11 pegou até um pedaço de 8 s. Enquanto houver
  áudio do Belchior no vídeo, ela tende a continuar.
- **Karaokê não escapa.** O instrumental do canal Runy é a mesma gravação sem a voz; a cama contínua de karaokê
  casou inteira (0:00 a 1:43). Saiu no som v8 e entrou trilha livre por baixo (Touching Moment, Wayne Jones).
- **Filtro de "rádio antigo" é timbre, não disfarce.** Não muda o que o Content ID reconhece.
- Saídas possíveis se voltar: encurtar a peça da janela, contestar como comentário e crítica, ou aceitar a
  divisão de receita. Mapa das peças e ordem dos scripts em `DESCRICAO-YOUTUBE.md`, seção 3.

### Músicas do Infraction
- Usou → a descrição precisa do crédito, e ele **nunca pode sair** de lá (o robô reescaneia). Sem isso o claim é
  permanente e o vídeo perde a monetização.
- **Correção descoberta em 14/11**: o "link de remove claim" não é um link por usuário. É o texto fixo
  `Music from #InAudio: https://inaudio.org/` + nome da música. O `AGENTS.md` (seção 0.2) e as duas skills ainda
  falam em "link de remove claim": vale acertar a redação.
- Neste vídeo: **Emergence** (Cold Cinema) nos trechos 04 a 06 e **Storyteller** no 07.
- Sua preferência: eu **só aviso** (quais músicas, que precisa do crédito). Não saio procurando link nem montando
  descrição sem você pedir. O `finalizar.mjs` imprime o aviso no fim de cada rodada.
- Toda música do Infraction mora em `D:\YT\!Assets\Musicas\Infraction - No Copyright Music\`, nunca na raiz.

---

## 4. Técnica de áudio

- **Medir antes de mexer.** `kit/auditoria-som.mjs` (por cue, por família, emendas) e `kit/medir-final.mjs`
  (LUFS, pico real, bombeamento do normalizador) não alteram nada. A auditoria de 11/11 achou coisas que o ouvido
  não tinha apontado: 14 efeitos mortos (pico de -63 dBFS), 15 em nível de sussurro, música inaudível nos
  primeiros 5 s do trecho 09, cortes secos em 4 emendas.
- **A transcrição automática do clipe errou 10 s** (dizia que a voz entrava em 30 s; entra em 39,8 s). Antes de
  alinhar música cantada, medir onde a voz realmente entra.
- **Pico do efeito no momento marcado.** Cada arquivo tem um ataque diferente até o pico; a cue começa antes para
  o pico cair no corte.
- **Sincronia karaokê × clipe**: `tempo no karaokê = tempo no clipe + 4,4734 + 0,001474 × tempo no clipe` (erro de 1 a 3 ms).
- **Mix final**: -14 LUFS. O `loudnorm` de uma passada deixa escapar pico no começo (+0,2 dBTP aos 3 s); um
  limitador depois dele em -2,5 dBFS segura o pico real perto de -1,5 dBTP mesmo depois do AAC.
- **Efeito cortado no fim do trecho**: a cauda precisa continuar no trecho seguinte (vento, whoosh de transição).

---

## 5. Técnica de render

- **Placa (RTX 3050) ligada por padrão**: Chrome do HyperFrames na GPU (`--browser-gpu` +
  `PRODUCER_BROWSER_GPU_MODE=hardware`) e MP4 na NVENC. `--cpu` ou `ALMOCO_CPU=1` volta ao x264.
- **Pegadinha da NVENC no HyperFrames 0.8.193**: com `--gpu` ele passa `-cq` sem `-b:v 0` e a NVENC trava em
  ~16 Mbps qualquer que seja o cq (39,7 dB contra 44,6 dB do x264 CRF 15). Com `--video-bitrate 50M` deu 44,4 dB,
  mesma qualidade e tamanho de antes.
- No ffmpeg direto (`kit/gpu.mjs`): NVENC cq 13 ≈ x264 CRF 15. A NVENC oscila mais nos quadros difíceis.
- **ProRes 4444 continua na CPU**: a NVENC não grava ProRes nem canal alfa.
- **`concat -c copy` só é seguro se todos os trechos saíram do mesmo encoder com os mesmos parâmetros.** Misturar
  x264 e NVENC corrompe a imagem. O `montar.mjs` confere a assinatura do stream antes; `--rapido` monta em ~1 min
  em vez de ~10.
- **Mudança só de som não precisa de render.** O `finalizar.mjs` guarda uma "impressão visual" de cada trecho e só
  renderiza o que mudou na imagem.
- **`kit/render-parte.mjs`** renderiza só um pedaço de um trecho e encaixa no MP4. Limite: não atualiza o MOV com alfa.
- **Filmora** lê transparência em WebM VP9 com alfa; `kit/camadas.mjs` gera isso + stems de narração, música e efeitos.
- **`bun run hf:studio <video> <XX>`** abre o Studio na porta fixa 3002 (assim a opção "GPU" do painel fica lembrada).

---

## 6. Jeito de trabalhar que funcionou

- **Cada rodada de feedback virou um script** (`som-vN-<assunto>.mjs`), idempotente, com backup em
  `output/_backup-<nome>/` e o pedido citado no cabeçalho. Dá para desfazer qualquer passada e saber por que ela existe.
- **O custo disso**: os scripts dependem de ordem (`v4 → v5 → v6 → v7 → v8 → v9 → v10 → v11`; nunca rodar o v3 de
  novo). Para um vídeo novo, melhor uma curva de trilha única desde o início (como o v11) do que empilhar correções.
- **Versão anterior do final nunca é apagada**: vai para `versoes-antigas/` com número e data.
- **Perguntar antes de mexer** quando o pedido é de opinião ("sem mudar nada").
- **Avisar o risco e deixar a decisão com você** (foi assim com o karaokê: avisei que o Content ID tenderia a pegar, você aprovou testar).

---

## 7. Thumb pelo Google Flow

- Você preferiu gerar no Flow (Nano Banana, conta PRO) em vez de montar em código, usando o navegador Helium com
  a extensão do Claude.
- O Flow não tem campo de upload no DOM: servir a imagem em `http://127.0.0.1:<porta>`, tirar screenshot e soltar
  na caixa de comando.
- Texto na arte funciona quando a frase **não tem acento**.
- Download em 2K sai 2752×1536; cortar para 16:9 e reduzir para 1920×1080.
- Conferir sempre: o modelo às vezes inventa corpo fora do quadro.
- Seu gosto (interpretação minha): protagonista recortado do clipe, papel rasgado/colagem, ou fundo de papel limpo
  com serifada itálica e uma palavra grande em vermelho.

---

## 8. Linha do tempo das passadas de som

| Versão | Data | O que mudou | Motivo |
|---|---|---|---|
| passada-som | 05/11 | whooshes leves e curtos, pico no corte; "arranhado" vira clique de câmera | feedback seu |
| v3 | 06/11 | trilhas longas (≥ 45 s), sem "dark slam", impactos com pico alinhado | idem |
| impactos-2 | 07/11 | só 2 impactos no vídeo, a -18 dB | "uma ou duas vezes, bem baixinho" |
| v4 | 08/11 | menos música do clipe | reclamação da WMG |
| v5 | 11/11 | emendas, buracos sem cama, níveis, efeitos mortos | auditoria medida |
| texto-limpo | 11/11 | textos de tela sem pontuação | "bem clean" |
| v6 | 12/11 | verso sincronizado, família a -20 dB, cenas encurtadas (7:16 → 7:03) | "focar na narração" |
| v7 | 13/11 | cama contínua de karaokê em 0:00-1:50 | "só o beat de fundo, sem a voz" |
| v8 | 13/11 | sai o rumble; karaokê contínuo sai, entra trilha livre | rumble reprovado + WMG voltou |
| v9 | 13/11 | pratos e agulha na cena da mesa que vira disco | som ligado à cena |
| v10 | 13/11 | "Ei, moço" inteiro (19 s em vez de 9,5) | "ficou cortado, ficou estranho" |
| v11 | 16/11 | trilha contínua em crossfade, sem whoosh | retorno do Matheus |

---

## 9. Pendências ao fechar

1. **Nada commitado.** Modificados: `AGENTS.md` (seção 0.2), as duas skills `ofurry-*`, `package.json`
   (`hf:studio`), `scripts/hf/render-trecho.ts` (GPU). Novos: `scripts/hf/studio-trecho.ts`, `.claude/`,
   `videos/na-hora-do-almoco/` inteiro. Atenção antes de commitar o vídeo: `midia/narracao.wav` tem 77 MB e os
   `output/trecho-XX/render/` são pesados.
2. **V2 sem aprovação registrada.** Se o Matheus aprovar, a V2 vira o final e a V1 vai para `versoes-antigas/`.
3. **Redação do crédito Infraction** no `AGENTS.md` e nas skills ("link de remove claim" → texto fixo do inaudio).
4. **`LEIA-ME.md` da pasta de entrega** ainda cita só o `na-hora-do-almoco-final.mp4`, sem a V2.
5. **Reclamação da WMG**: sem registro do resultado depois do som v8/v10.

---

## 10. Para o próximo vídeo

- [ ] Trilha: uma curva só para o vídeo todo, cama ~21 LU abaixo da voz, crossfade longo nas trocas, desce sem sumir sob clipe.
- [ ] Legenda entra sem som. Efeito só em evento da cena, suave, sem subgrave. Impacto: no máximo 1 ou 2.
- [ ] Música cantada sob a fala: baixa e alinhada com a recitação. Medir a entrada da voz, não confiar na transcrição.
- [ ] Texto de tela: só o que a narração diz, sem pontuação.
- [ ] Sem cena parada sem narração por mais de ~10 s; sem silêncio "de efeito".
- [ ] Música de terceiros com Content ID: avisar que encurtar, karaokê e filtro não resolvem.
- [ ] Infraction: avisar, listar as músicas, criar o `DESCRICAO-YOUTUBE.md` junto do final.
- [ ] Rodar a auditoria de som antes do primeiro envio, não depois do feedback.
- [ ] Final novo → o anterior vai para `versoes-antigas/`.
