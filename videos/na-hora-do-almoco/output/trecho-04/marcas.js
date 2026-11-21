// marcas da folha feitas no trecho 04 (medo), tempos do trecho: circulos e marca vermelhos
Almoco.MARCAS['trecho-04'] = function (tl, F, pronto) {
  var A = window.Almoco;
  var l = F.acha('medo medo medo').linha;
  [2.63, 3.66, 4.46, 5.02, 5.5].forEach(function (t, k) {
    A.circula(tl, F, F.palavras(l, k, k), t, 0.4, 'vermelho', pronto, 40 + k);
  });
  A.marca(tl, F, F.palavras(l), 5.5, 0.35, 'vermelho', pronto);
  A.marca(tl, F, F.acha('Cada um guarda mais o seu segredo'), 8.95, 1.1, 'vermelho', pronto);
};
