// marcas da folha feitas no trecho 05 (a familia), tempos do trecho
Almoco.MARCAS['trecho-05'] = function (tl, F, pronto) {
  var A = window.Almoco;
  A.marca(tl, F, F.acha('O pai na cabeceira'), 7.45, 1.0, 'amarelo', pronto);
  A.marca(tl, F, F.acha('minha mãe me chama'), 9.6, 1.0, 'amarelo', pronto);
  A.marca(tl, F, F.acha('minha irmã mais nova'), 11.6, 1.0, 'amarelo', pronto);
  A.marca(tl, F, F.acha('Negra cabeleira'), 13.1, 0.8, 'amarelo', pronto);
  var avo = F.acha('Minha avó reclama');
  A.marca(tl, F, avo, 14.95, 1.0, 'amarelo', pronto);
  A.circula(tl, F, F.acha('É hora do almoço', avo.linha + 1), 16.2, 0.6, 'preto', pronto, 31);
};
