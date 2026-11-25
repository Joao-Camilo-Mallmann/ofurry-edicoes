# O que o João quer (canal OFurry)

Tudo o que o João (J.C, dono do canal) já pediu, aprovou ou reprovou sobre a edição, com as palavras dele. É a fonte
de gosto do canal: quando uma regra técnica do repo brigar com algo daqui, **vale o que está aqui** (e a regra deve ser
corrigida). Como cada item virou regra: `docs/padrao-edicao-ofurry.md`.

Atualize este arquivo sempre que ele der um retorno novo: data, frase dele entre aspas e o que mudou.

---

## 1. O estilo que ele quer

| Data | O que ele disse | O que virou |
|---|---|---|
| 20/11/2026 | "O que eu mais gostava dos vídeos era aquelas cenas de motion com ícones ou com coisa assim de cena preta, representando visualmente o que está acontecendo. E aí tem muitas animações de itens se movendo, os ícones se movendo para um lado para o outro." | Cena **palco de ícones** (`palco`) é a primeira opção sempre que a frase tem ação. |
| 20/11/2026 | "tem umas piadinhas também meio que escondidas, tipo uns trocadilhos assim, algumas frases meio que engraçadas. Acho que isso é legal para dar um pouco mais de vida para os motion, para não ficar fundo preto." | Piadas no vídeo (ver a próxima linha para o formato). |
| 20/11/2026 | "Piadinhas escondidas que não precisam ser tão escondidas, podem ser tipo piadas mais na cara, mas elas duram tipo poucos segundos, no máximo um segundo ou poucos frames assim, pra ter que parar o vídeo e encontrar mesmo." | Cena **piada relâmpago** (`piada`): grande, amarela, tarja preta, ~1 s ou poucos quadros, 1 a cada ~30–60 s. |
| 20/11/2026 | "tem muitas cenas de B-roll, isso a gente poderia talvez fazer uns B-roll melhor, que façam mais sentido com o que tem acima do vídeo" | B-roll só quando mostra exatamente o que a fala diz; senão, ícones no preto. |
| 20/11/2026 | "as cenas mais técnicas, né, que a gente fala de valores, podiam apresentar gráficos, essas coisas assim também, apresentando mais no estilo de fundo preto" | Cenas de dados (gráfico, tabela, balança, barra, fórmula) no preto. |
| 20/11/2026 | Aprovou os pilotos do vídeo 177 (gancho e virada): gráfico com câmera, máquina desenhada, balança, calendário, Furry de respiro. | Padrão de edição v2 (ADR-007). |
| 20/11/2026 | Sobre imagens 3D geradas pelo agy/Nano Banana (máquina, "177" em metal, bola de moedas): "ficou com cara de IA slop, detestei, o demais simples em 2D legal", "no estilo do canal do Furry, olhar os vídeos dele". | **Nada de imagem gerada por IA.** 2D limpo desenhado em código, no estilo dos vídeos antigos. |
| 20/11/2026 | Sobre o mascote: "usar os animados dele, não os png" (indicando `fox4_loop_fhd.webm`). | O build usa os loops `foxN.webm` (com transparência) no lugar dos PNG. |
| 21/11/2026 | Depois da v2: "Tá top... o overlay de TV antiga e tudo mais ficou [bom]". | Overlays de película/VHS/light leak e câmera nos cortes aprovados. |
| 21/11/2026 | "A cena do personagem pode ficar mais tempo." | Depois da cena dele, o Furry encolhe para o canto e segue ~3,5 s por cima da cena seguinte. |
| 21/11/2026 | "Nas cenas do meu personagem não usar 3D nele, apenas nos outros elementos, e ele pode ficar mais parado no centro ou do outro lado da tela." | Furry sem giro/inclinação/balanço, fora da câmera global; entra subindo ou deslizando reto. |
| 21/11/2026 | "Queria mais variação de motion também de gráfico, ficou repetindo tudo." | Cenas novas (barras, rosca, contador, linha em 3D), entradas variadas no palco; mesma cena nunca duas vezes seguidas. |
| 21/11/2026 | "O final ficou curto, brusco; olhar os vídeos do padrão do canal; uma música mais dramática no 'eu sou o Furry'; corta o som e deixa o áudio puro." | Assinatura com voz pura + vinheta OFURRY; 15 s de tela final com música dramática e fade (`cauda`, `trilha.json` → `final`). |
| 21/11/2026 | "A gente pode usar mais também a fonte invertida com esse efeito para dar um contraste legal com alguns momentos, com o vídeo e a fonte, para não ficar sempre tão monótono no branco com sombra." | Legenda `"estilo": "invertida"` (bloco branco em blend *difference*: o vídeo vira negativo dentro do bloco e a letra mostra o vídeo original) em cerca de metade das legendas sobre B-roll, e `"estilo": "tarja"` (letra preta em bloco branco com sombra laranja) num momento de destaque no preto, em trechos alternados. |
| 21/11/2026 | "Proibido usar o personagem espelhado" (print do Furry virado no lado direito da tela). | O build nunca espelha o Furry (`flip` é ignorado); no lado direito ele aparece como foi desenhado. |
| 21/11/2026 | "Centraliza ele de preferência em todas as cenas. Só em casos nos cantos ele pode ficar daí pequeno, mas quando for ele maior tem que ficar sempre centralizado no meio do vídeo, não pelas laterais. Ele pode ficar menor nas laterais só quando for algo pequeno ou não for o foco da cena, meio que para complementar ela." | Furry grande = sempre no centro. `left-third`/`right-third` viram centro quando ele é o foco, ou canto pequeno daquele lado quando outra cena divide a tela com ele (mais de 40% do tempo). Sem alternância automática para os lados. |
| 21/11/2026 | "O fundo aqui ficou cinza porque o original é preto." (grade em perspectiva) | Base preta fixa embaixo de todos os fundos; a grade filmada fica sobre preto. |
| 21/11/2026 | Narração final: "usar esse OFurry_177_narracao_v3_1-adobe.mp3" (Adobe Enhance puro; não gostou da versão tratada). | Voz sem EQ/compressão; a montagem só aplica ganho linear até -14 LUFS e o limitador do mix segura os picos. |
| 24/11/2026 | "Nessa parte do Albert Einstein tudo poderia ficar cinza, um overlay cinza e triste por cima, não deixar o Furry colorido, aplicar o efeito de voz de microfone velho." | `telaCinza` por cima de tudo (Furry incluso) da citação até o fim do comentário dele; voz de microfone velho só na citação. |
| 24/11/2026 | "A transição do 3:49 não ficou suave." | Era a troca de música (6 s misturando duas faixas de ritmos diferentes): trocas agora em 2,5 s, na pausa entre blocos. |
| 24/11/2026 | "Música é extremamente importante: uma música boa para cada momento"; "o gancho final tem que seguir o padrão Furry: assinatura com fundo preto, corte seco, cortando a música, só a voz". | Uma faixa por bloco com energia subindo até a virada; assinatura padrão mantida. |
| 24/11/2026 | "6:45 ficou bugado" (ampulheta animada girando em loop) e, sobre a etiqueta "SPOILER: VOLTA": "esse padrão aqui é IA slop, evitar". | Ícone animado anima uma vez só, na entrada. **Proibido: etiqueta inclinada com borda/moldura** (piada, carimbo, selo): agora é texto reto, grande, com contorno preto. Cena de ícones de 6:40 virou B-roll (notas caindo + névoa = futuro distante). |
| 24/11/2026 | Sobre a colagem do Furry P&B com círculo e palavras cruzando (5:16): "q porra é essa KKKK". | Colagem fora; volta o Furry colorido no centro com a frase legível. Texto nunca cortado pelo Furry; Furry sem cor só quando ele pedir. |
| 24/11/2026 | Sobre "Pessoa A vs Pessoa B" em texto (4:56): "esse modelo ficou maçante de texto nessa disposição". | Cena de duas curvas cruzando os R$ 100 mil; outras telas só de texto viraram moedas 3D ou tipografia em profundidade. |
| 24/11/2026 | "A música de 4:08 não ficou legal." | Rain Fuse fora da parte 07; duas opções para ele escolher. |
| 24/11/2026 | "Usar também mais dos ícones do Lucide... pode usar os ícones do Lucide Animation também." | No palco, todo ator com versão no Lucide Animated toca a animação em loop desde a entrada (antes eram estáticos); alguns estáticos trocam pelo parente animado (moedas → cifrão, % → selo de %). |
| 24/11/2026 | "Quando falo pão de queijo tinha que dar aquele som de rádio velho... ficou uma voz muito grave"; "na cena de pão de queijo podia deixar meio que um filtro cinza em cima, pra dizer que perdeu a graça". | Voz de rádio velho sem baixar o tom + chiado de disco + valsa filtrada; no "mas olha lá" o comercial congela e fica cinza. |
| 24/11/2026 | "Não precisa ser só com fundo preto... aquele template grid... ou até usar um fundo branco"; "dá uma olhada em todo o canal do Furry... pra pegar mais referência". | Fundo de papel claro quadriculado (`"papel": true`) quando um palco vem logo depois de outro; memes da pasta `Meme` em moldura nos momentos de humor (o canal usa ~2,5% do tempo). |
| 24/11/2026 | Sobre o close do Furry com fogo no gancho: "Essa cena aqui pode remover, ela só pode ser usada em momentos de alta tensão." | Saiu do gancho; vira recurso raro, só em alta tensão. |
| 24/11/2026 | "Algumas animações ficaram muito repetitivas... muda o iconezinho, mas o movimento é igual... muito enjoado. Principalmente nos primeiros 5 minutos... muito mais nos primeiros 30 segundos." | Regra no padrão: não repetir movimento em cenas vizinhas; gancho refeito com um recurso novo por corte (`slam`, `type-on`, contador, máquina 3D, close com fogo, câmera manual). |
| 24/11/2026 | "O Furry troca meio sem sentido... podia ficar mais tempo na tela e garantir que ele se enquadra sempre no meio perfeitamente... sempre faz a mesma animação para direita e para baixo." | Âncora fixa pelas pernas (`public/mascote/ancoras.json`), pose mínima de 2,5 s, entradas variadas e canto alternado. |
| 24/11/2026 | "Variar mais o efeito de luz e overlay da tela também"; "ficou bugando 14:10 com fundo branco". | `"look"` por trecho (pelicula, luz nas bordas, extra, leak), sem repetir a combinação do vizinho; catálogo em `D:\YT\!Assets\Overlays\catalogo.png`; `bun run video:qa` antes de mandar cópia. |
| 24/11/2026 | "O time da voz não ficou legal no pão de queijo... desiste corta no meio... pode fazer." | Só ganho (+7 dB no "-te") e respiros de 0,30–0,40 s em pausas; sem EQ nem compressão. |
| 22/11/2026 | "Essa cena de suar ficou bem estranha... cortado em momento estranho"; "pão de queijo KKKK, mudar o tom da voz para ficar mais irônico, estilo de rádio, e fazer uma cena mais engraçada... cortar o clima como um quebra-gelo". | Sequência sem B-roll no meio da frase. Cena `radio` (comercial "Rádio OFurry 177,0 FM") + `vozEfeito` só nessa frase. |
| 22/11/2026 | "Pão de queijo é CROASSA????"; "um png de pão de queijo simples, sem óculos escuros, algo bem simples, colado e amador"; "pode usar o agy para gerar a img". | Foto de pão de queijo gerada pelo `agy` (autorizado para este item), recortada com borda branca de figurinha e tremida de stop-motion. A regra geral de não usar imagem de IA em cena continua. |
| 22/11/2026 | Na cena do pão de queijo das 6:08: "passar mais um estilo de amador, tirar o preço de venda... remover o 'é isso' e o 'pão de queijo', apenas foto dele e deu". | Depois: "no estilo de overlay, por cima do fundo, como piada por poucos segundos". Só a foto colada torta e parada por cima da cena, ~1,2 s, sem nenhum texto. |
| 22/11/2026 | "Ficou muito poluído, deixar com o boneco no centro da tela, grande, com fundo cinza, para parecer que eu falei fora do roteiro." | Comentário fora do roteiro = fundo `cinza` chapado + Furry grande no centro, sem texto nem selo. |
| 22/11/2026 | Sobre o ícone com risco vermelho: "esse efeito ficou sendo spammado, mudar ou variar"; sobre o gráfico de linha: "é legal, mas ficou sendo spammado"; "B-roll... repetido muito, no máximo 2 vezes". | `riscaComo` (risco, x, carimbo, cai, apaga). Gráfico de linha de 16 para 5. **Cada B-roll ou foto no máximo 2 vezes por vídeo.** |
| 22/11/2026 | "'Desiste' ficou cortando do áudio e a transição muito rápida, não muito suave." | A cena fica até o fim da frase seguinte; sem efeito sonoro em cima da palavra. |
| 22/11/2026 | "A música do final, 14 min, poderia ser mais dramática"; "assinatura 'eu sou Furry, a gente se vê por aí' sem música, sem vídeo, apenas um fundo preto". | Trilha dramática desde 14:00; assinatura só com a voz sobre preto total (`telaPreta`). Depois da assinatura **mantém os 15 s de tela final** ("Manter tela final", 24/11/2026). |
| 21/11/2026 | "Na hora da máquina de imprimir dinheiro, o SVG ícone não ficou tão legal. Dá uma gerada nova, pega o Antigravity, segue o padrão do projeto, estilo dele... uma coisa mais legal, como no 3D, uma coisa diferente." | Cena `maquina3d` (CSS 3D de verdade, desenhada em código no estilo 2D do canal), escrita pelo `agy` pelo terminal e revisada aqui. Continua sem imagem gerada por IA. |
| 20/11/2026 | "Usar alguns B-roll mais variados e eu preciso que os primeiros 30 segundos sejam os mais dinâmicos possíveis. Pode baixar assets da internet." | Gancho com troca a cada ~0,7 s (B-roll real em corte rápido entre as cenas); B-roll real filmado e variado no vídeo todo, baixado de banco com licença comercial livre (Mixkit "Free"), créditos em `acervo/broll/CREDITOS.md`. |
| 20/11/2026 | "renderizar sempre o vídeo por partes e no final juntar tudo... mais fácil se eu quiser editar alguma parte em específico... separa de forma inteligente" | Vídeo sempre por partes (`video:dividir`, `final/partes.md`, `video:produzir --trechos XX`). |

## 2. Som e música

| Data | O que ele disse | O que virou |
|---|---|---|
| 20/11/2026 | "pode pegar music do YT Studio" (e deixou a biblioteca de áudio do Studio aberta no navegador). | Trilha da biblioteca de áudio do YouTube por padrão, sem crédito obrigatório. |
| 11–16/11/2026 (Na Hora do Almoço) | Efeito sonoro só em evento específico; rumble repetido reprovado; whoosh em legenda fora; trilha contínua, sem sumir nem trocar seco. | Regras de som do padrão (seção 6) e de `D:\YT\Docs\global\`. |
| 11/2026 | Música do Infraction: "só avisar" do crédito; não montar descrição sem ele pedir. | `video:montar` avisa no fim. |

## 3. Entrega

| Data | O que ele disse | O que virou |
|---|---|---|
| 17/11/2026 | Vídeo pronto em MP4, sempre Full HD, sem MOV transparente nem camadas para o Filmora. | `AGENTS.md` 0.3. |
| 17/11/2026 | Render sempre na placa de vídeo (RTX 3050). | `hf:render` com GPU por padrão. |

## 4. Números e narração

| Data | O que ele disse | O que virou |
|---|---|---|
| 20/11/2026 | Número da fala diferente da tabela (mês 120 × 124): "tinha que regravar alguns áudios, deixar esse pra depois também". | Tela mostra o número certo; a frase entra em `frases_para_regravar.txt`. |
| 20/11/2026 | Sobre a planilha mês a mês: "Não tenho, pode criar". | Simulação gerada e versionada (`videos/177/dados/`), tabela animada em código. |
| 20/11/2026 | O print `rate 7%.png` (taxas do Tesouro) vira prova da taxa, não "a simulação". | Cena `proof` no passo 1. |

## 5. Como trabalhar com ele

| Data | O que ele disse | O que virou |
|---|---|---|
| 20/11/2026 | "Me dê notificação quando tiver dúvida"; "celular manda notificação no Claude app e no desktop não precisa". | Dúvida que muda o trabalho → notificação curta no celular + pergunta na conversa. |
| 20/11/2026 | "você é o orquestrador, então você é a prioridade total. Você vai decidir como fazer tal cena e como fazer o roteiro para pegar a máxima atenção de vídeo." | Roteiro visual, técnica de cada cena e ritmo são decisão de quem edita. Reordenar/cortar narração: propor antes. |
| 20/11/2026 | Liberou o CLI do Antigravity (`agy`) para 3D. | Ferramenta disponível; mas imagem gerada por IA foi reprovada no mesmo dia (seção 1). |
| 20/11/2026 | "tem também os assets do Furry pra usar" e "é tudo aqui: D:\YT\!Assets". | `INDEX.md` e `docs/assets/inventario.md`. |
| 20/11/2026 | Quer este repositório como **a central de edição de todos os vídeos do canal**, no GitHub, com o padrão inteiro, um índice que ensine a navegar nas pastas e nos assets do PC, e uma pasta de referências para vídeos que ele vai mandar. | Repo `ofurry-edicoes`, `INDEX.md`, `referencias/`. |
