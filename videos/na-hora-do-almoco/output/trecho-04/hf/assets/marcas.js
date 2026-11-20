Almoco.MARCAS = {};
// trecho-02
// marcas da folha feitas no trecho 02 (tempos do trecho); pronto=true = ja desenhadas (trechos seguintes)
Almoco.MARCAS['trecho-02'] = function (tl, F, pronto) {
  var A = window.Almoco;
  A.marca(tl, F, F.acha('No centro da sala'), 4.25, 1.3, 'amarelo', pronto);
  A.marca(tl, F, F.acha('diante da mesa'), 5.9, 1.4, 'amarelo', pronto);
  A.marca(tl, F, F.acha('No fundo do prato'), 7.45, 1.3, 'amarelo', pronto);
  A.marca(tl, F, F.acha('comida e tristeza'), 8.9, 1.5, 'amarelo', pronto);
  A.nota(tl, F, F.acha('comida e tristeza'), 'não é só comida', 0, 10.6, 'preto', pronto);
};

// trecho-04
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

// desenha todas as marcas ate o trecho atual; as de trechos anteriores ja prontas
Almoco.marcasAte = function (tl, F, atual) { Object.keys(Almoco.MARCAS).sort().forEach(function (k) { Almoco.MARCAS[k](tl, F, k !== atual); }); };
