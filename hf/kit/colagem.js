/*
 * OF.colagem: colagem editorial (referência do Pinterest, João 24/11/2026: "sair do padrão de ícone se mexe").
 * Recorte em preto e branco (Furry ou foto com fundo transparente) na frente de um círculo chapado da marca,
 * com palavras grandes cruzando a tela: umas atrás do recorte, outras na frente; fina e pesada misturadas.
 * Função pura do tempo. Carregado só nos trechos que usam a cena.
 *
 * p: { src (PNG com transparência), cor ('brand'), circulo: 0.62 (diâmetro em fração da altura),
 *      palavras: [{ at, texto, peso: 'fino'|'forte', x, y (0-1, centro), tam (px), atras: true, cor }] }
 */
(function (g) {
  var OF = g.OF;
  if (!OF) return;
  var W = 1920, H = 1080;
  var C = OF.C, E = OF.E, el = OF.el, prog = OF.prog;

  OF.colagem = function (root, p, t0, dur) {
    var box = el('div', { style: 'position:absolute;inset:0;overflow:hidden', 'data-layout-allow-overlap': '' }, root);
    var cam = el('div', { style: 'position:absolute;inset:0;transform-origin:50% 55%' }, box);
    var cor = C[p.cor || 'brand'] || p.cor;
    var d = Math.round((p.circulo || 0.62) * H);
    var circulo = el('div', { style: 'position:absolute;left:' + (W / 2 - d / 2) + 'px;top:' + (H * 0.5 - d / 2) + 'px;width:' + d + 'px;height:' + d + 'px;border-radius:50%;background:' + cor }, cam);
    var palavra = function (w) {
      var forte = w.peso !== 'fino';
      return el('div', {
        text: w.texto,
        style: 'position:absolute;left:0;top:0;white-space:nowrap;opacity:0;line-height:0.9;color:' + (C[w.cor || 'text'] || w.cor) + ';' +
          (forte ? OF.FONT_NUM + 'font-size:' + (w.tam || 260) + 'px;' : "font-family:'Montserrat',sans-serif;font-weight:300;letter-spacing:-0.02em;font-size:" + (w.tam || 150) + 'px;'),
      }, cam);
    };
    var atras = (p.palavras || []).filter(function (w) { return w.atras; }).map(function (w) { return { w: w, n: palavra(w) }; });
    var recorte = el('img', { src: p.src || '', alt: '', style: 'position:absolute;left:' + (W / 2 - 520) + 'px;top:' + (H - 1040) + 'px;width:1040px;height:1040px;object-fit:contain;filter:grayscale(1) contrast(1.25) brightness(1.05);transform-origin:50% 100%' }, cam);
    var frente = (p.palavras || []).filter(function (w) { return !w.atras; }).map(function (w) { return { w: w, n: palavra(w) }; });
    var todas = atras.concat(frente);
    return function (tl) {
      var T = t0 + tl;
      cam.style.transform = 'scale(' + (1 + 0.05 * Math.min(1, tl / Math.max(1, dur))).toFixed(4) + ')';
      var pc = prog(T, t0, 0.3, E.back);
      circulo.style.transform = 'scale(' + pc.toFixed(4) + ')';
      var pr = prog(T, t0 + 0.08, 0.35, E.out5);
      recorte.style.opacity = Math.min(1, pr * 1.5).toFixed(3);
      recorte.style.transform = 'translateY(' + ((1 - pr) * 140).toFixed(1) + 'px)';
      todas.forEach(function (o, i) {
        var at = o.w.at !== undefined ? o.w.at : t0;
        var e = T >= at ? prog(T, at, 0.28, E.out5) : 0;
        var lado = i % 2 ? 1 : -1;
        var x = (o.w.x !== undefined ? o.w.x : 0.5) * W, y = (o.w.y !== undefined ? o.w.y : 0.5) * H;
        // desliza de lado e continua andando devagar (a palavra cruza a tela)
        var anda = (T - at) * 26 * lado;
        o.n.style.opacity = T >= at ? Math.min(1, e * 1.6).toFixed(3) : '0';
        o.n.style.transform = 'translate(' + (x - o.n.offsetWidth / 2 + (1 - e) * 320 * lado + anda).toFixed(1) + 'px,' + (y - o.n.offsetHeight / 2).toFixed(1) + 'px)';
      });
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
