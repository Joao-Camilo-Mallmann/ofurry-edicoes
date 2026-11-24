/*
 * OF.slam: tipografia cinetica em profundidade. Cada linha voa de perto da camera (grande, borrada) e assenta;
 * as anteriores recuam no fundo e apagam um pouco, empilhando em 3D. Para ganchos e listas curtas faladas.
 * (Joao, 24/11/2026: "muda o iconezinho, mas o movimento e igual... muito enjoado", principalmente no gancho.)
 * Funcao pura do tempo. Carregado so nos trechos que usam a cena.
 *
 * p: { linhas: [{ at, texto, cor: 'text'|'hl'|'gain'|..., tam: 150, n: '1' }], numerada: true }
 */
(function (g) {
  var OF = g.OF;
  if (!OF) return;
  var W = 1920, H = 1080;
  var C = OF.C, E = OF.E, el = OF.el, prog = OF.prog;

  OF.slam = function (root, p, t0, dur) {
    var wrap = el('div', { style: 'position:absolute;inset:0;perspective:1200px;perspective-origin:50% 45%;overflow:hidden', 'data-layout-allow-overlap': '' }, root);
    var cam = el('div', { style: 'position:absolute;inset:0;transform-style:preserve-3d' }, wrap);
    var linhas = (p.linhas || []).map(function (l, i) {
      var cor = C[l.cor || (i === (p.linhas.length - 1) ? 'hl' : 'text')] || l.cor;
      var n = el('div', { style: 'position:absolute;left:0;top:0;width:' + W + 'px;text-align:center;white-space:nowrap;transform-origin:50% 50%;opacity:0;' + OF.FONT_NUM + 'font-size:' + (l.tam || 170) + 'px;line-height:1;color:' + cor + ';text-shadow:0 0 40px ' + cor + '55' }, cam);
      if (p.numerada !== false) el('span', { text: (l.n || String(i + 1)) + '  ', style: 'color:' + C.brand }, n);
      el('span', { text: l.texto }, n);
      return { n: n, l: l };
    });
    return function (tl) {
      var T = t0 + tl;
      var u = (T - t0) / Math.max(1, dur);
      cam.style.transform = 'rotateX(' + (8 - u * 6).toFixed(2) + 'deg) rotateY(' + (-10 + u * 16).toFixed(2) + 'deg)';
      var vistas = linhas.filter(function (o) { return T >= o.l.at; }).length;
      linhas.forEach(function (o, i) {
        if (T < o.l.at) { o.n.style.opacity = '0'; return; }
        var e = prog(T, o.l.at, 0.22, E.out5);
        // quantas linhas chegaram depois desta: cada uma empurra esta para o fundo
        var atras = vistas - 1 - i;
        var z = -230 * atras + (1 - e) * 900;
        var y = H / 2 - 60 - atras * 200 + (1 - e) * 60;
        var blur = (1 - e) * 16 + atras * 1.2;
        o.n.style.opacity = (Math.min(1, e * 1.4) * Math.max(0.35, 1 - atras * 0.28)).toFixed(3);
        o.n.style.filter = 'blur(' + blur.toFixed(1) + 'px)';
        o.n.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateZ(' + ((1 - e) * (i % 2 ? 7 : -7)).toFixed(2) + 'deg)';
      });
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
