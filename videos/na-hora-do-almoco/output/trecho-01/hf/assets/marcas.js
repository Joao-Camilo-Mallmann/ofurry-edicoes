Almoco.MARCAS = {};

// desenha todas as marcas ate o trecho atual; as de trechos anteriores ja prontas
Almoco.marcasAte = function (tl, F, atual) { Object.keys(Almoco.MARCAS).sort().forEach(function (k) { Almoco.MARCAS[k](tl, F, k !== atual); }); };
