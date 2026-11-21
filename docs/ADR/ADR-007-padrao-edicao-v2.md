# ADR-007: Padrão de edição v2: vídeo inteiro no repo, cenas de dados e âncoras por frase

**Status:** Aceito (pilotos do vídeo 177 aprovados pelo João em 2026-11-20)
**Data:** 2026-11-20
**Referência:** evolui o ADR-001 (arquitetura) e a skill `ofurry-house-motion`; o "como editar" está em
`docs/padrao-edicao-ofurry.md`.

---

## 1. Contexto

- O repo nasceu para gerar camadas de motion com alfa por cima da edição feita fora (Premiere/CapCut). Desde
  17/11/2026 a entrega é o **vídeo pronto** (AGENTS.md 0.3), e o João quer que o repo seja a **central de edição de
  todos os vídeos** do canal: ele traz roteiro + narração, o repo faz o resto.
- O fluxo HyperFrames (`beats.json` → `hf:build` → `hf:render`) parava no MP4 de cada trecho, só com a narração: sem
  trilha, sem efeitos, sem montagem. O "Na Hora do Almoço" resolveu isso com um kit próprio, com caminhos fixos e
  composições escritas à mão.
- Tempos absolutos: toda regravação obrigava a refazer `beats.json`, sons e cortes. O 177 vai receber 5–7 frases
  regravadas depois da edição.
- Vídeos de finanças precisam de gráficos e metáforas de dados (curva, tabela, balança); o kit da casa só tinha
  legenda, ícone, número, mascote e print.

## 2. Decisão

1. **Âncoras por frase em vez de segundos.** Qualquer tempo do `beats.json` (batidas, keyframes, sfx) pode ser
   `"@frase"` (`"@64 reais>"`, `"@mil reais#2+0.3"`), resolvido no build contra as palavras do trecho
   (`scripts/video/ancoras.ts`). Cada trecho no `video.json` tem `de` (frase de abertura).
   `video:sincronizar` re-transcreve, reaplica `midia/revisao.json` (correções de texto) e recorta todos os trechos
   pelas frases. Âncora que sumiu → o build para e mostra o trecho mais parecido.
2. **Batida `cena` + kit `hf/kit/ofurry-cenas.js`.** Doze cenas de dados/metáforas (gráfico com câmera, tabela,
   balança, máquina, calendário, fórmula, barra, comparar, lista, números, citação, fim), cada uma como **função pura
   do tempo** (DOM/SVG recalculado por quadro, sem relógio nem aleatório), em 2.5D (CSS 3D + SVG). Determinístico,
   barato de renderizar (~0,6× tempo real na RTX 3050), parametrizado por keyframes ancorados.
3. **Áudio no nível do vídeo, não do trecho.** `video:montar` refaz o áudio inteiro: narração + `trilha.json`
   (uma curva contínua, crossfade, cada faixa nivelada 21 LU abaixo da voz) + `sfx` de todos os trechos, e normaliza
   em -14 LUFS. O vídeo dos trechos é juntado sem reencodar.
4. **`video:produzir`**: build de tudo, render só do que mudou na imagem (impressão visual por hash), montagem.
5. **Produção em paralelo por trecho**: o storyboard aprovado + a referência do kit bastam para dividir os trechos
   entre agentes, cada um com seus arquivos.

## 3. Consequências

- (+) Regravação vira 2 comandos (`video:sincronizar --audio`, `video:produzir`); só os trechos afetados renderizam.
- (+) Um vídeo de 14 min sai em ~25 min de render; prévias com som de verdade (`video:montar --trechos`).
- (+) Vale para qualquer vídeo: nada de caminho fixo por vídeo.
- (−) Âncora ambígua (frase repetida) exige `#n`; frase regravada com outras palavras exige ajustar a âncora.
- (−) As cenas recalculam o DOM a cada quadro: cenas muito pesadas (milhares de nós) ficariam lentas. Até aqui, ok.
- (−) 3D de verdade (Three.js) ainda não está no kit; fica reservado a um objeto-herói por vídeo.
- O kit Remotion (`src/house/`) não renderiza a batida `cena`; ele segue só para os trechos antigos do COE.
