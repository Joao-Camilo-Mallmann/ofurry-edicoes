/*
 * OF.duasCurvas: o mesmo patrimonio em momentos diferentes da curva (Joao, 24/11/2026: "esse modelo ficou macante de
 * texto nessa disposicao"; a comparacao se mostra com imagem, nao com dois blocos de texto).
 * Duas curvas de patrimonio (aportes diferentes, mesma taxa) cruzam a mesma linha de R$ 100 mil em meses diferentes:
 * a de aporte alto ainda esta no trecho quase reto (comeco da curva); a de aporte baixo ja esta dobrando (perto da virada).
 * Funcao pura do tempo. Carregado so nos trechos que usam a cena.
 *
 * p: { linha: 100000, meses: 180, taxa: 0.07,
 *      curvas: [{ at, aporte: 1000, rotulo: 'A', sub: 'COMEÇO DA CURVA', cor: 'text', dur: 1.2 }, ...],
 *      destaques: [{ at, texto, alvo: 'tempo' | 'taxa' }] }
 */
(function (g) {
  var OF = g.OF;
  if (!OF) return;
  var W = 1920, H = 1080;
  var C = OF.C, E = OF.E, el = OF.el, svg = OF.svg, prog = OF.prog;

  OF.duasCurvas = function (root, p, t0, dur) {
    var meses = p.meses || 180, linha = p.linha || 100000, taxa = p.taxa || 0.07;
    var st = OF.stage(root, { ry: -10, rx: 8 });
    var X0 = 260, X1 = 1680, Y0 = 860, Y1 = 190, yMax = linha * 1.5;
    var xm = function (m) { return X0 + (m / meses) * (X1 - X0); };
    var yv = function (v) { return Y0 - (Math.min(v, yMax) / yMax) * (Y0 - Y1); };
    var s = svg('svg', { width: W, height: H, style: 'position:absolute;inset:0;overflow:visible' }, st.cam);
    svg('path', { d: 'M' + X0 + ' ' + Y1 + ' L' + X0 + ' ' + Y0 + ' L' + X1 + ' ' + Y0, fill: 'none', stroke: C.text, 'stroke-width': 3, opacity: 0.7 }, s);
    var ly = yv(linha);
    var linhaEl = svg('line', { x1: X0, y1: ly, x2: X1, y2: ly, stroke: C.hl, 'stroke-width': 4, 'stroke-dasharray': '18 12' }, s);
    var rotLinha = el('div', { style: 'position:absolute;left:' + (X0 + 16) + 'px;top:' + (ly - 62) + 'px;white-space:nowrap;' + OF.FONT_NUM + 'font-size:58px;color:' + C.hl, text: 'R$ ' + Math.round(linha / 1000) + ' MIL' }, st.cam);
    var eixoT = el('div', { style: 'position:absolute;left:' + (X1 - 220) + 'px;top:' + (Y0 + 16) + 'px;width:220px;text-align:right;' + OF.FONT_CAP + 'font-size:30px;color:' + C.whisper, text: 'TEMPO →' }, st.cam);
    var curvas = (p.curvas || []).map(function (c, i) {
      var sim = OF.simula(meses, c.aporte || 1000, taxa);
      var cruza = 0;
      for (var m = 1; m <= meses; m++) if (sim.P[m] >= linha) { cruza = m; break; }
      var col = C[c.cor || (i ? 'gain' : 'text')] || c.cor;
      var d = '';
      for (m = 0; m <= meses; m++) d += (m ? ' L' : 'M') + xm(m).toFixed(1) + ' ' + yv(sim.P[m]).toFixed(1);
      var path = svg('path', { d: d, fill: 'none', stroke: col, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: 'filter:drop-shadow(0 0 12px ' + col + '88)' }, s);
      var L = path.getTotalLength ? path.getTotalLength() : 3000;
      path.setAttribute('stroke-dasharray', L.toFixed(1));
      var dot = svg('circle', { cx: xm(cruza), cy: ly, r: 0, fill: col, stroke: '#000', 'stroke-width': 4 }, s);
      var lb = el('div', { style: 'position:absolute;left:' + (xm(cruza) - 200) + 'px;width:400px;text-align:center;top:' + (ly + (i ? -190 : 36)) + 'px;opacity:0' }, st.cam);
      el('div', { text: c.rotulo || (i ? 'B' : 'A'), style: OF.FONT_NUM + 'font-size:96px;line-height:1;color:' + col }, lb);
      el('div', { text: c.sub || '', style: OF.FONT_CAP + 'font-size:30px;color:' + C.text + ';white-space:nowrap' }, lb);
      return { c: c, path: path, L: L, dot: dot, lb: lb, frac: cruza / meses };
    });
    var dest = (p.destaques || []).map(function (d0) {
      return { d: d0, n: el('div', { text: d0.texto, style: 'position:absolute;left:0;right:0;top:70px;text-align:center;' + OF.FONT_CAP + 'font-size:72px;color:' + C.hl + ';opacity:0' }, root) };
    });
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.8);
      linhaEl.style.opacity = prog(T, t0, 0.3);
      rotLinha.style.opacity = prog(T, t0 + 0.15, 0.3);
      curvas.forEach(function (o) {
        var at = o.c.at !== undefined ? o.c.at : t0;
        var pr = T >= at ? prog(T, at, o.c.dur || 1.2, E.io) : 0;
        // a curva desenha ate cruzar a linha e depois segue um pouco
        var ate = Math.min(1, pr * (o.frac + 0.12) / 1);
        o.path.setAttribute('stroke-dashoffset', (o.L * (1 - ate)).toFixed(1));
        o.path.style.opacity = T >= at ? 1 : 0;
        var chegou = pr * (o.frac + 0.12) >= o.frac;
        var pd = chegou ? prog(T, at + (o.c.dur || 1.2) * (o.frac / (o.frac + 0.12)), 0.25, E.back) : 0;
        o.dot.setAttribute('r', (16 * pd).toFixed(1));
        o.lb.style.opacity = pd.toFixed(3);
        o.lb.style.transform = 'translateY(' + ((1 - pd) * 24).toFixed(1) + 'px)';
      });
      var ativo = null;
      dest.forEach(function (o) { if (T >= o.d.at) ativo = o; });
      dest.forEach(function (o) {
        o.n.style.opacity = o === ativo ? prog(T, o.d.at, 0.2).toFixed(3) : '0';
      });
      eixoT.style.color = ativo && ativo.d.alvo === 'tempo' ? C.hl : C.whisper;
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
