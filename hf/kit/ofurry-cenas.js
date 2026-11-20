/*
 * OFurry: cenas de dados e metaforas (padrao de edicao v2, docs/padrao-edicao-ofurry.md).
 *
 * Cada cena e uma funcao PURA do tempo: OF.<tipo>(root, p, t0) monta o DOM uma vez e devolve render(tLocal).
 * O build chama House.drive(tl, 0, dur, render). Sem relogio, sem Math.random (contrato do HyperFrames).
 * Todos os tempos dentro de `p` (at, keyframes) estao em segundos DO TRECHO (ja resolvidos das ancoras "@frase");
 * t0 e o inicio da batida no trecho, entao T = t0 + tLocal.
 *
 * Tipos: grafico, tabela, balanca, maquina, calendario, formula, barra, comparar, lista, numeros, citacao, fim, palco (icones em movimento), piada, foto3d (assincrona).
 * Cores sempre pelo significado: --gain ganho/rendimento, --text aporte/seu dinheiro, --highlight virada/destaque,
 * --loss perda, --brand marca, --info apoio.
 */
(function (g) {
  if (g.OF) return;
  var OF = {};
  var W = 1920, H = 1080, NS = 'http://www.w3.org/2000/svg';
  var C = { text: '#fdfdfd', whisper: '#8c8c8c', gain: '#2ee04a', loss: '#e3141b', hl: '#f4e812', brand: '#ff9900', info: '#22d3ee', dim: 'rgba(255,255,255,0.18)' };
  OF.C = C;

  // ---------------------------------------------------------------- utilitarios
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var c01 = function (x) { return clamp(x, 0, 1); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var E = {
    out3: function (t) { return 1 - Math.pow(1 - t, 3); },
    out5: function (t) { return 1 - Math.pow(1 - t, 5); },
    io: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  OF.E = E;
  /** progresso 0-1 de uma entrada que comeca em `at` e dura `d` segundos */
  // +1 quadro: a entrada ja aparece no quadro em que a batida comeca (sem quadro vazio, que piscava na emenda dos trechos)
  var prog = function (T, at, d, ease) { if (at === undefined || at === null) return 1; var x = c01((T - at + 1 / 30) / (d || 0.25)); return (ease || E.out3)(x); };
  OF.prog = prog;
  /** interpola uma lista de keyframes [{at, ...k}] no campo k (transicao de `dur` s com ease io a partir de cada at) */
  function kf(list, T, k, def, dur) {
    if (!list || !list.length) return def;
    var v = list[0][k] !== undefined ? list[0][k] : def;
    for (var i = 1; i < list.length; i++) {
      var a = list[i];
      if (a[k] === undefined) continue;
      if (T <= a.at) break;
      var d = a.dur !== undefined ? a.dur : dur !== undefined ? dur : 0.9;
      var p = d <= 0 ? 1 : E.io(c01((T - a.at) / d));
      v = lerp(v, a[k], p);
    }
    return v;
  }
  OF.kf = kf;
  var el = function (tag, attrs, parent, ns) {
    var e = ns ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (var k in attrs) {
      if (k === 'style') e.style.cssText = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  };
  var svg = function (tag, attrs, parent) { return el(tag, attrs, parent, true); };
  OF.el = el;
  OF.svg = svg;

  /** "R$ 1.000", "R$ 177 mil", "R$ 5,65" */
  function brl(v, opts) {
    opts = opts || {};
    var neg = v < 0; v = Math.abs(v);
    var s;
    if (opts.mil && v >= 10000) {
      if (v >= 1e6) s = (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: v % 1e6 === 0 ? 0 : 2 }) + (v >= 2e6 ? ' milhões' : ' milhão');
      else s = Math.round(v / 1000).toLocaleString('pt-BR') + ' mil';
    } else {
      var dec = opts.dec !== undefined ? opts.dec : v < 100 && v % 1 !== 0 ? 2 : 0;
      s = v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }
    return (neg ? '-' : '') + (opts.semRS ? '' : 'R$ ') + s;
  }
  OF.brl = brl;

  /** Simulacao do canal: aporte no fim do mes, taxa constante. rend[m] = juros do mes m; P[m] = patrimonio no fim do mes m */
  function simula(meses, aporte, taxaAno) {
    var r = Math.pow(1 + taxaAno, 1 / 12) - 1, P = [0], rend = [0], bolso = [0];
    for (var m = 1; m <= meses; m++) {
      var j = P[m - 1] * r;
      rend.push(j);
      P.push(P[m - 1] + j + aporte);
      bolso.push(m * aporte);
    }
    return { r: r, P: P, rend: rend, bolso: bolso };
  }
  OF.simula = simula;
  var sample = function (arr, x) { var i = Math.floor(x), f = x - i; if (i >= arr.length - 1) return arr[arr.length - 1]; if (i < 0) return arr[0]; return lerp(arr[i], arr[i + 1], f); };

  function niceStep(span, n) {
    var raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }

  var FONT_CAP = "font-family:'Montserrat',sans-serif;font-weight:800;text-transform:uppercase;";
  var FONT_NUM = "font-family:'Bebas Neue','Montserrat',sans-serif;";
  OF.FONT_CAP = FONT_CAP;
  OF.FONT_NUM = FONT_NUM;

  /** palco com leve camera 2.5D (perspectiva + drift lento) */
  function stage(root, opts) {
    opts = opts || {};
    var wrap = el('div', { style: 'position:absolute;inset:0;perspective:1600px;perspective-origin:50% 45%' }, root);
    var cam = el('div', { style: 'position:absolute;inset:0;transform-style:preserve-3d;will-change:transform' }, wrap);
    return {
      cam: cam,
      move: function (T, t0, dur, amp) {
        amp = amp === undefined ? 1 : amp;
        var u = (T - t0) / Math.max(1, dur);
        var ry = (opts.ry !== undefined ? opts.ry : -5) * (1 - u * 0.8) * amp;
        var rx = (opts.rx !== undefined ? opts.rx : 3) * amp;
        var s = 1 + 0.045 * u * amp;
        cam.style.transform = 'rotateY(' + ry.toFixed(3) + 'deg) rotateX(' + rx.toFixed(3) + 'deg) scale(' + s.toFixed(4) + ')';
      },
    };
  }
  OF.stage = stage;

  /** texto que entra (pop/rise) em `at` e opcionalmente sai em `out` */
  function popText(node, T, at, out, kind) {
    var p = prog(T, at, kind === 'rise' ? 0.22 : 0.16, kind === 'rise' ? E.out5 : E.back);
    var o = out !== undefined && T >= out ? 1 - c01((T - out) / 0.15) : 1;
    var visible = at === undefined || T >= at;
    node.style.opacity = visible ? (Math.min(1, p * 1.6) * o).toFixed(3) : '0';
    node.style.transform = kind === 'rise' ? 'translateY(' + ((1 - p) * 40).toFixed(1) + 'px)' : 'scale(' + (0.5 + 0.5 * p).toFixed(3) + ')';
  }
  OF.popText = popText;

  // ================================================================ GRAFICO
  /*
   * p: { modo: 'rendimento' | 'patrimonio', meses: 130, aporte: 1000, taxa: 0.07,
   *      revela: [{at, mes}],             quanto da curva ja esta desenhado (mes, pode ser fracionario)
   *      vista:  [{at, x: 24, y: 1200}],  janela visivel (camera): eixo x 0..x meses, eixo y 0..y reais
   *      marcos: [{mes, at, rotulo, cor}], linha vertical + ponto + rotulo
   *      titulo, mostrarAporte (true), virada (true: destaca onde a curva cruza a reta) }
   */
  OF.grafico = function (root, p, t0, dur) {
    var modo = p.modo || 'rendimento', A = p.aporte || 1000, N = p.meses || 130;
    var sim = simula(N, A, p.taxa || 0.07);
    var serie = modo === 'rendimento' ? sim.rend : sim.P;
    var virMes = -1;
    if (modo === 'rendimento') for (var m = 1; m <= N; m++) if (sim.rend[m] >= A) { virMes = m; break; }
    var st = stage(root, { ry: -4, rx: 2 });
    var X0 = 250, X1 = 1690, Y0 = 860, Y1 = 210;
    var s = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, style: 'position:absolute;inset:0;overflow:visible' }, st.cam);
    var defs = svg('defs', {}, s);
    var gr = svg('linearGradient', { id: 'gfill', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: '0', 'stop-color': C.gain, 'stop-opacity': 0.35 }, gr);
    svg('stop', { offset: '1', 'stop-color': C.gain, 'stop-opacity': 0 }, gr);
    var gTicks = svg('g', {}, s);
    var axis = svg('path', { d: 'M' + X0 + ' ' + Y1 + ' L' + X0 + ' ' + Y0 + ' L' + X1 + ' ' + Y0, stroke: C.text, 'stroke-width': 3, fill: 'none', opacity: 0.85 }, s);
    var areaBolso = svg('path', { fill: 'rgba(253,253,253,0.16)', stroke: 'none' }, s);
    var area = svg('path', { fill: 'url(#gfill)', stroke: 'none' }, s);
    var aporteLine = svg('line', { stroke: C.text, 'stroke-width': 5, 'stroke-dasharray': '18 12', opacity: 0.9 }, s);
    var curve = svg('path', { fill: 'none', stroke: C.gain, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: 'filter:drop-shadow(0 0 14px ' + C.gain + 'aa)' }, s);
    var gMarcos = svg('g', {}, s);
    var head = svg('circle', { r: 16, fill: C.gain, style: 'filter:drop-shadow(0 0 18px ' + C.gain + ')' }, s);
    var ring = svg('circle', { r: 30, fill: 'none', stroke: C.hl, 'stroke-width': 6, opacity: 0 }, s);
    var lblAporte = el('div', { style: 'position:absolute;' + FONT_CAP + 'font-size:34px;color:' + C.text + ';white-space:nowrap' }, st.cam);
    var headLbl = el('div', { style: 'position:absolute;white-space:nowrap;text-align:left' }, st.cam);
    var headVal = el('div', { style: FONT_NUM + 'font-size:92px;line-height:0.9;color:' + C.gain + ';text-shadow:0 0 24px ' + C.gain + '88' }, headLbl);
    var headSub = el('div', { style: FONT_CAP + 'font-size:30px;color:' + C.text }, headLbl);
    var title = p.titulo ? el('div', { style: 'position:absolute;left:0;right:0;top:70px;text-align:center;' + FONT_CAP + 'font-size:54px;font-style:italic;font-weight:600;color:' + C.text, text: p.titulo }, root) : null;
    var viradaLbl = el('div', { style: 'position:absolute;' + FONT_CAP + 'font-size:46px;color:#000;background:' + C.hl + ';padding:6px 22px;white-space:nowrap;opacity:0', text: p.viradaTexto || 'A VIRADA' }, st.cam);
    var marcoEls = (p.marcos || []).map(function (mk) {
      var g1 = svg('g', { opacity: 0 }, gMarcos);
      var ln = svg('line', { stroke: mk.cor ? C[mk.cor] || mk.cor : C.text, 'stroke-width': 3, 'stroke-dasharray': '6 8' }, g1);
      var dot = svg('circle', { r: 11, fill: mk.cor ? C[mk.cor] || mk.cor : C.text }, g1);
      var lb = el('div', { style: 'position:absolute;' + FONT_CAP + 'font-size:32px;color:' + (mk.cor ? C[mk.cor] || mk.cor : C.text) + ';white-space:nowrap;text-align:center;opacity:0', text: mk.rotulo || 'MÊS ' + mk.mes }, st.cam);
      return { mk: mk, g: g1, ln: ln, dot: dot, lb: lb };
    });
    var tickEls = [];

    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.8);
      if (title) popText(title, T, t0, undefined, 'rise');
      var h = kf(p.revela, T, 'mes', N, 1.6);
      var vx = kf(p.vista, T, 'x', N, 1.2);
      var vy = kf(p.vista, T, 'y', modo === 'rendimento' ? 1200 : serie[N] * 1.1, 1.2);
      var sx = function (x) { return X0 + (x / vx) * (X1 - X0); };
      var sy = function (y) { return Y0 - (y / vy) * (Y0 - Y1); };
      var intro = prog(T, t0, 0.5);
      axis.style.opacity = intro;
      // ticks (pool de elementos reaproveitados: nada e criado/destruido por quadro)
      var used = 0;
      var tick = function (x1, y1, x2, y2, tx, ty, anchor, label) {
        if (!tickEls[used]) {
          var ln = svg('line', { stroke: C.dim, 'stroke-width': 1.5 }, gTicks);
          var tt = svg('text', { fill: C.whisper, 'font-family': 'Montserrat', 'font-weight': 700, 'font-size': 28 }, gTicks);
          tickEls[used] = { ln: ln, tt: tt };
        }
        var o = tickEls[used++];
        o.ln.setAttribute('x1', x1); o.ln.setAttribute('y1', y1); o.ln.setAttribute('x2', x2); o.ln.setAttribute('y2', y2);
        o.tt.setAttribute('x', tx); o.tt.setAttribute('y', ty); o.tt.setAttribute('text-anchor', anchor);
        if (o.tt.textContent !== label) o.tt.textContent = label;
        o.ln.style.display = ''; o.tt.style.display = '';
      };
      var stx = vx >= 30 ? niceStep(vx / 12, 6) * 12 : niceStep(vx, 6), sty = niceStep(vy, 4);
      stx = Math.max(1, Math.round(stx));
      for (var x = stx; x <= vx + 1e-6; x += stx) {
        var tx = sx(x);
        tick(tx, Y0, tx, Y1, tx, Y0 + 48, 'middle', x >= 12 && x % 12 === 0 ? 'ANO ' + x / 12 : 'MÊS ' + Math.round(x));
      }
      for (var y = sty; y <= vy + 1e-6; y += sty) {
        var ty = sy(y);
        tick(X0, ty, X1, ty, X0 - 22, ty + 10, 'end', brl(y, { mil: true }));
      }
      for (var u = used; u < tickEls.length; u++) { tickEls[u].ln.style.display = 'none'; tickEls[u].tt.style.display = 'none'; }
      gTicks.style.opacity = intro * 0.9;
      // curva ate h (clip no topo do grafico)
      var d = '', dA = '', dB = '', steps = Math.max(2, Math.ceil(h * 2));
      for (var i = 0; i <= steps; i++) {
        var xm = (h * i) / steps;
        var X = sx(xm), Y = Math.max(Y1 - 40, sy(sample(serie, xm)));
        d += (i ? ' L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1);
        if (modo === 'patrimonio') dB += (i ? ' L' : 'M') + X.toFixed(1) + ' ' + Math.max(Y1 - 40, sy(sample(sim.bolso, xm))).toFixed(1);
      }
      curve.setAttribute('d', h > 0.01 ? d : '');
      area.setAttribute('d', h > 0.01 ? d + ' L' + sx(h).toFixed(1) + ' ' + Y0 + ' L' + X0 + ' ' + Y0 + ' Z' : '');
      if (modo === 'patrimonio') areaBolso.setAttribute('d', h > 0.01 ? dB + ' L' + sx(h).toFixed(1) + ' ' + Y0 + ' L' + X0 + ' ' + Y0 + ' Z' : '');
      var hx = sx(h), hy = Math.max(Y1 - 40, sy(sample(serie, h)));
      // reta do aporte
      var showA = p.mostrarAporte !== false && modo === 'rendimento';
      if (showA) {
        var pa = prog(T, p.aporteAt !== undefined ? p.aporteAt : t0, 0.6, E.io);
        aporteLine.setAttribute('x1', X0); aporteLine.setAttribute('y1', sy(A));
        aporteLine.setAttribute('x2', lerp(X0, X1, pa)); aporteLine.setAttribute('y2', sy(A));
        aporteLine.style.opacity = sy(A) > Y1 - 30 ? 0.9 : 0;
        lblAporte.textContent = p.aporteTexto || 'APORTE ' + brl(A);
        lblAporte.style.left = (hx > X1 - 700 && Math.abs(hy - sy(A)) < 200 ? X0 + 24 : X1 - 330) + 'px';
        lblAporte.style.top = sy(A) - 58 + 'px';
        lblAporte.style.opacity = (pa * (sy(A) > Y1 - 30 ? 1 : 0)).toFixed(3);
      } else { aporteLine.style.opacity = 0; lblAporte.style.opacity = 0; }
      // cabeca
      head.setAttribute('cx', hx); head.setAttribute('cy', hy);
      head.style.opacity = h > 0.3 ? 1 : 0;
      var val = sample(serie, h);
      var shown = modo === 'rendimento' && val >= 300 ? Math.round(val / 10) * 10 : val;
      headVal.textContent = brl(shown, { mil: modo === 'patrimonio', dec: modo === 'rendimento' && val < 100 ? 2 : 0 }) + (modo === 'rendimento' ? '/MÊS' : '');
      headSub.textContent = p.semMes ? '' : 'MÊS ' + Math.max(0, Math.round(h));
      // rotulo da cabeca: acima e a direita; perto da borda direita vai para a esquerda da cabeca
      var nearRight = hx > X1 - 420;
      var lx = nearRight ? hx - 440 : hx + 34, ly = Math.max(Y1 - 60, hy - 150);
      headLbl.style.textAlign = nearRight ? 'right' : 'left';
      headLbl.style.width = nearRight ? '410px' : 'auto';
      headLbl.style.left = lx + 'px'; headLbl.style.top = ly + 'px';
      headLbl.style.opacity = h > 0.3 && p.rotuloCabeca !== false ? 1 : 0;
      // virada
      if (p.virada !== false && virMes > 0) {
        var pv = h >= virMes ? prog(T, null) : 0;
        var vX = sx(virMes), vY = sy(A);
        ring.setAttribute('cx', vX); ring.setAttribute('cy', vY);
        var since = h >= virMes ? Math.min(1, (h - virMes) / 3) : 0;
        ring.style.opacity = h >= virMes ? 1 : 0;
        ring.setAttribute('r', (30 + since * 14).toFixed(1));
        viradaLbl.style.opacity = h >= virMes ? '1' : '0';
        viradaLbl.style.left = Math.max(40, Math.min(vX - 140, W - 40 - viradaLbl.offsetWidth)) + 'px';
        viradaLbl.style.top = vY + 50 + 'px';
        viradaLbl.style.transform = 'scale(' + (0.6 + 0.4 * E.back(c01(since * 1.5))).toFixed(3) + ')';
        void pv;
      }
      // marcos
      marcoEls.forEach(function (o) {
        var mk = o.mk, on = T >= (mk.at !== undefined ? mk.at : -1) && h >= mk.mes - 0.01;
        var pm = on ? prog(T, mk.at, 0.3) : 0;
        var X = sx(mk.mes), Y = Math.max(Y1 - 40, sy(sample(serie, mk.mes)));
        o.ln.setAttribute('x1', X); o.ln.setAttribute('x2', X); o.ln.setAttribute('y1', Y0); o.ln.setAttribute('y2', lerp(Y0, Y, pm));
        o.dot.setAttribute('cx', X); o.dot.setAttribute('cy', Y);
        o.g.style.opacity = pm;
        var lado = mk.lado || (mk.acima === false ? 'baixo' : 'cima');
        o.lb.style.width = '440px';
        o.lb.style.textAlign = lado === 'esq' ? 'right' : lado === 'dir' ? 'left' : 'center';
        o.lb.style.left = (lado === 'esq' ? X - 470 : lado === 'dir' ? X + 30 : X - 220) + 'px';
        o.lb.style.top = (lado === 'cima' ? Y - 70 : lado === 'baixo' ? Y + 30 : Y - 20) + 'px';
        o.lb.style.opacity = pm;
        var out = mk.ate !== undefined && T > mk.ate ? 0 : 1;
        o.g.style.opacity = pm * out; o.lb.style.opacity = pm * out;
      });
    };
  };

  // ================================================================ TABELA (simulacao mes a mes)
  /*
   * p: { meses: 130, aporte, taxa, rolar: [{at, mes}], destaques: [{at, mes, cor, ate}], colunaDestaque: [{at, col, ate}],
   *      titulo }   colunas: MES, APORTE, RENDIMENTO, PATRIMONIO  (col 0..3)
   */
  OF.tabela = function (root, p, t0, dur) {
    var N = p.meses || 130, A = p.aporte || 1000;
    var sim = simula(N, A, p.taxa || 0.07);
    var st = stage(root, { ry: -7, rx: 5 });
    var RH = 86, VIS = 8, Wt = 1380, X = (W - Wt) / 2, TOP = 250;
    var cols = [{ t: 'MÊS', w: 0.16 }, { t: 'APORTE', w: 0.24 }, { t: 'RENDIMENTO', w: 0.28 }, { t: 'PATRIMÔNIO', w: 0.32 }];
    var card = el('div', { style: 'position:absolute;left:' + X + 'px;top:' + (TOP - 110) + 'px;width:' + Wt + 'px;height:' + (RH * VIS + 110) + 'px;background:#0b0b0b;box-shadow:0 0 0 2px rgba(255,255,255,.28),0 40px 140px rgba(46,224,74,.10);overflow:hidden' }, st.cam);
    var head = el('div', { style: 'position:absolute;left:0;right:0;top:0;height:110px;display:flex;background:#151515;border-bottom:3px solid rgba(255,255,255,.4);z-index:3' }, card);
    var colHi = cols.map(function (c, i) {
      return el('div', { style: 'flex:' + c.w + ';display:flex;align-items:center;justify-content:center;' + FONT_CAP + 'font-size:34px;color:' + (i === 2 ? C.gain : C.text), text: c.t }, head);
    });
    var body = el('div', { style: 'position:absolute;left:0;right:0;top:110px;bottom:0;overflow:hidden' }, card);
    var rows = el('div', { style: 'position:absolute;left:0;right:0;top:0' }, body);
    var rowEls = [];
    for (var m = 1; m <= N; m++) {
      var r = el('div', { style: 'position:absolute;left:0;right:0;top:' + (m - 1) * RH + 'px;height:' + RH + 'px;display:flex;border-bottom:1.5px solid rgba(255,255,255,.12)' }, rows);
      var vals = [String(m), brl(A), brl(sim.rend[m], { dec: 2 }), brl(sim.P[m], { dec: 0 })];
      vals.forEach(function (v, i) {
        el('div', { style: 'flex:' + cols[i].w + ';display:flex;align-items:center;justify-content:center;' + FONT_NUM + 'font-size:60px;color:' + (i === 2 ? C.gain : i === 0 ? C.whisper : C.text), text: v }, r);
      });
      rowEls.push(r);
    }
    var hiBox = el('div', { style: 'position:absolute;left:-6px;right:-6px;height:' + (RH + 8) + 'px;border:6px solid ' + C.hl + ';box-shadow:0 0 26px ' + C.hl + '99;opacity:0;z-index:2' }, body);
    var colBox = el('div', { style: 'position:absolute;top:0;bottom:0;border:6px solid ' + C.hl + ';opacity:0;z-index:4;pointer-events:none' }, card);
    var title = p.titulo ? el('div', { style: 'position:absolute;left:0;right:0;top:40px;text-align:center;' + FONT_CAP + 'font-size:50px;font-style:italic;font-weight:600;color:' + C.text, text: p.titulo }, root) : null;
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 1);
      var pin = prog(T, t0, 0.35, E.out5);
      card.style.opacity = Math.min(1, pin * 1.5);
      card.style.transform = 'translateY(' + ((1 - pin) * 120).toFixed(1) + 'px) rotateX(' + ((1 - pin) * 18).toFixed(2) + 'deg)';
      card.style.filter = 'blur(' + ((1 - pin) * 14).toFixed(1) + 'px)';
      if (title) popText(title, T, t0, undefined, 'rise');
      var mes = kf(p.rolar, T, 'mes', 1, 1.1);
      var topRow = clamp(mes - 1 - (VIS - 1) / 2, 0, N - VIS);
      rows.style.transform = 'translateY(' + (-topRow * RH).toFixed(1) + 'px)';
      // destaque de linha
      var hi = null;
      (p.destaques || []).forEach(function (d) { if (T >= d.at && (d.ate === undefined || T < d.ate)) hi = d; });
      if (hi) {
        var y = (hi.mes - 1 - topRow) * RH - 4;
        hiBox.style.top = y + 'px';
        hiBox.style.borderColor = C[hi.cor || 'hl'] || C.hl;
        var ph = prog(T, hi.at, 0.25);
        hiBox.style.opacity = ph;
        hiBox.style.transform = 'scaleX(' + (0.92 + 0.08 * ph).toFixed(3) + ')';
        rowEls.forEach(function (r, i) { r.style.background = i === hi.mes - 1 ? 'rgba(244,232,18,0.10)' : 'transparent'; });
      } else { hiBox.style.opacity = 0; rowEls.forEach(function (r) { r.style.background = 'transparent'; }); }
      var ch = null;
      (p.colunaDestaque || []).forEach(function (d) { if (T >= d.at && (d.ate === undefined || T < d.ate)) ch = d; });
      if (ch) {
        var left = 0; for (var i = 0; i < ch.col; i++) left += cols[i].w;
        colBox.style.left = left * Wt + 'px'; colBox.style.width = cols[ch.col].w * Wt + 'px';
        colBox.style.opacity = prog(T, ch.at, 0.25);
      } else colBox.style.opacity = 0;
      void colHi;
    };
  };

  // ================================================================ BALANCA
  /* p: { esquerda: 'APORTE', direita: 'RENDIMENTO', base: 1000, valores: [{at, v}], formato: 'brl' } */
  OF.balanca = function (root, p, t0, dur) {
    var base = p.base || 1000;
    var st = stage(root, { ry: 0, rx: 4 });
    var cx = W / 2, py = 330, arm = 560;
    var s = svg('svg', { width: W, height: H, style: 'position:absolute;inset:0;overflow:visible' }, st.cam);
    var stroke = { stroke: C.text, 'stroke-width': 8, 'stroke-linecap': 'round', fill: 'none' };
    svg('path', Object.assign({ d: 'M' + cx + ' ' + py + ' L' + cx + ' 900 M' + (cx - 170) + ' 900 L' + (cx + 170) + ' 900' }, stroke), s);
    svg('circle', { cx: cx, cy: py, r: 18, fill: C.brand }, s);
    var beam = svg('g', {}, s);
    svg('line', Object.assign({ x1: cx - arm, y1: py, x2: cx + arm, y2: py }, stroke), beam);
    var mkPan = function (side) {
      var g1 = svg('g', {}, s);
      var x = cx + side * arm;
      svg('path', Object.assign({ d: 'M' + x + ' 0 L' + (x - 150) + ' 230 M' + x + ' 0 L' + (x + 150) + ' 230' }, stroke, { 'stroke-width': 4, opacity: 0.8 }), g1);
      var pan = svg('path', Object.assign({ d: 'M' + (x - 190) + ' 230 Q' + x + ' 320 ' + (x + 190) + ' 230 Z' }, stroke, { fill: '#0d0d0d' }), g1);
      return { g: g1, pan: pan, x: x };
    };
    var L = mkPan(-1), R = mkPan(1);
    var mkLbl = function (txt, color) {
      var d = el('div', { style: 'position:absolute;width:520px;text-align:center' }, st.cam);
      var v = el('div', { style: FONT_NUM + 'font-size:120px;line-height:0.9;color:' + color + ';text-shadow:0 0 28px ' + color + '77' }, d);
      el('div', { style: FONT_CAP + 'font-size:38px;color:' + C.text, text: txt }, d);
      return { d: d, v: v };
    };
    var lL = mkLbl(p.esquerda || 'APORTE', C.text), lR = mkLbl(p.direita || 'RENDIMENTO', C.gain);
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.6);
      var pin = prog(T, t0, 0.35, E.out5);
      st.cam.style.opacity = pin;
      var v = kf(p.valores, T, 'v', 0, 1.0);
      var ratio = clamp((v - base) / base, -1, 1);
      var wob = Math.sin(T * 2.2) * 0.4 * (1 - Math.abs(ratio));
      // exagero controlado: 0,1% de diferenca ja inclina ~4 graus (a virada tem que ser visivel)
      var ang = 13 * (ratio < 0 ? -1 : 1) * Math.sqrt(Math.min(1, Math.abs(ratio) * 120)) + wob;
      beam.setAttribute('transform', 'rotate(' + ang.toFixed(3) + ' ' + cx + ' ' + py + ')');
      var rad = (ang * Math.PI) / 180;
      [[L, -1], [R, 1]].forEach(function (o) {
        var dy = Math.sin(rad) * arm * o[1];
        var dx = Math.cos(rad) * arm * o[1] - arm * o[1];
        o[0].g.setAttribute('transform', 'translate(' + dx.toFixed(1) + ' ' + (py + dy).toFixed(1) + ')');
      });
      var dyL = Math.sin(rad) * arm * -1, dyR = Math.sin(rad) * arm;
      lL.d.style.left = cx - arm - 260 + 'px'; lL.d.style.top = py + dyL + 340 + 'px';
      lR.d.style.left = cx + arm - 260 + 'px'; lR.d.style.top = py + dyR + 340 + 'px';
      lL.v.textContent = brl(base);
      lR.v.textContent = brl(v, { dec: v < 100 && v % 1 ? 2 : 0 });
      var win = v >= base;
      R.pan.setAttribute('stroke', win ? C.gain : C.text);
      R.pan.style.filter = win ? 'drop-shadow(0 0 22px ' + C.gain + ')' : 'none';
    };
  };

  // ================================================================ MAQUINA DE IMPRIMIR DINHEIRO
  /* p: { ligaAt, ritmo: [{at, v}] notas por segundo, contador: [{at, v}] valor do visor, rotulo: 'R$ 1.000/MÊS',
          x: 0.5 (centro), escala: 1 } */
  OF.maquina = function (root, p, t0, dur) {
    var st = stage(root, { ry: -10, rx: 6 });
    var sc = p.escala || 1, cx = (p.x !== undefined ? p.x : 0.5) * W;
    var box = el('div', { style: 'position:absolute;left:' + (cx - 380 * sc) + 'px;top:' + (230) + 'px;width:' + 760 * sc + 'px;height:' + 620 * sc + 'px;transform-style:preserve-3d' }, st.cam);
    var s = svg('svg', { width: 760 * sc, height: 620 * sc, viewBox: '0 0 760 620', style: 'position:absolute;inset:0;overflow:visible' }, box);
    var S = { stroke: C.text, 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    // corpo em 2.5D: frente + topo + lateral
    svg('path', Object.assign({ d: 'M120 170 L200 110 L700 110 L620 170 Z', fill: '#1a1a1a' }, S), s);
    svg('path', Object.assign({ d: 'M620 170 L700 110 L700 470 L620 540 Z', fill: '#101010' }, S), s);
    svg('rect', Object.assign({ x: 120, y: 170, width: 500, height: 370, rx: 18, fill: '#151515' }, S), s);
    // visor
    svg('rect', Object.assign({ x: 165, y: 205, width: 410, height: 120, rx: 10, fill: '#050505' }, S, { 'stroke-width': 4 }), s);
    var lamp = svg('circle', { cx: 585, cy: 380, r: 20, fill: '#333', stroke: C.text, 'stroke-width': 4 }, s);
    // engrenagens
    var gears = [[230, 420, 52], [330, 450, 36]].map(function (gd) {
      var g1 = svg('g', {}, s);
      var path = '';
      for (var k = 0; k < 10; k++) {
        var a0 = (k / 10) * Math.PI * 2, a1 = a0 + Math.PI / 10;
        var r0 = gd[2], r1 = gd[2] * 1.22;
        path += (k ? ' L' : 'M') + (gd[0] + Math.cos(a0) * r1).toFixed(1) + ' ' + (gd[1] + Math.sin(a0) * r1).toFixed(1) + ' L' + (gd[0] + Math.cos(a1) * r1).toFixed(1) + ' ' + (gd[1] + Math.sin(a1) * r1).toFixed(1) + ' L' + (gd[0] + Math.cos(a1) * r0).toFixed(1) + ' ' + (gd[1] + Math.sin(a1) * r0).toFixed(1) + ' L' + (gd[0] + Math.cos(a1 + Math.PI / 10) * r0).toFixed(1) + ' ' + (gd[1] + Math.sin(a1 + Math.PI / 10) * r0).toFixed(1);
      }
      svg('path', Object.assign({ d: path + ' Z', fill: 'none' }, S, { 'stroke-width': 5, stroke: C.brand }), g1);
      svg('circle', { cx: gd[0], cy: gd[1], r: 10, fill: C.brand }, g1);
      return { g: g1, d: gd };
    });
    // fenda de saida
    svg('rect', Object.assign({ x: 400, y: 505, width: 190, height: 16, rx: 6, fill: '#000' }, S, { 'stroke-width': 4 }), s);
    var visor = el('div', { style: 'position:absolute;left:' + 165 * sc + 'px;top:' + 205 * sc + 'px;width:' + 410 * sc + 'px;height:' + 120 * sc + 'px;display:flex;align-items:center;justify-content:center;' + FONT_NUM + 'font-size:' + 92 * sc + 'px;color:' + C.gain + ';text-shadow:0 0 20px ' + C.gain }, box);
    var notesLayer = el('div', { style: 'position:absolute;inset:0;overflow:visible' }, st.cam);
    // rotulo por cima das notas, com sombra para ler mesmo com nota passando atras
    var label = el('div', { style: 'position:absolute;left:0;right:0;top:' + (p.rotuloY !== undefined ? p.rotuloY * H : 230 + 650 * sc) + 'px;text-align:center;' + FONT_CAP + 'font-size:56px;color:' + C.text + ';text-shadow:0 0 18px #000,0 0 36px #000' }, st.cam);
    var MAXN = 26, notes = [];
    for (var i = 0; i < MAXN; i++) {
      var n = el('div', { style: 'position:absolute;width:150px;height:72px;border-radius:6px;background:linear-gradient(135deg,#2ee04a,#17a832);border:3px solid #b9ffc5;display:flex;align-items:center;justify-content:center;' + FONT_NUM + 'font-size:46px;color:#063d12;opacity:0;box-shadow:0 0 18px rgba(46,224,74,.5)', text: 'R$' }, notesLayer);
      notes.push(n);
    }
    var rng = function (k) { var x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.9);
      var pin = prog(T, t0, 0.4, E.out5);
      box.style.opacity = Math.min(1, pin * 1.4);
      box.style.transform = 'translateY(' + ((1 - pin) * 200).toFixed(1) + 'px) rotateY(' + (-14 + Math.sin(T * 0.6) * 2).toFixed(2) + 'deg)';
      var on = p.ligaAt !== undefined ? T >= p.ligaAt : true;
      var since = on ? T - (p.ligaAt !== undefined ? p.ligaAt : t0) : 0;
      lamp.setAttribute('fill', on ? C.gain : '#333');
      lamp.style.filter = on ? 'drop-shadow(0 0 16px ' + C.gain + ')' : 'none';
      var v = on ? kf(p.ritmo, T, 'v', 2, 1.2) : 0;
      gears.forEach(function (gg, k) { gg.g.setAttribute('transform', 'rotate(' + ((k ? -1.45 : 1) * since * v * 80).toFixed(2) + ' ' + gg.d[0] + ' ' + gg.d[1] + ')'); });
      var shake = on ? Math.sin(T * 40) * 1.6 * Math.min(1, v / 3) : 0;
      s.style.transform = 'translate(' + shake.toFixed(2) + 'px,' + (Math.abs(shake) * 0.5).toFixed(2) + 'px)';
      var cont = kf(p.contador, T, 'v', 0, 1.0);
      visor.textContent = on ? brl(Math.round(cont)) : '- - -';
      label.textContent = p.rotulo || '';
      label.style.opacity = prog(T, p.rotuloAt !== undefined ? p.rotuloAt : t0 + 0.3, 0.3);
      // notas: integra o ritmo de forma aproximada (taxa media) -> indice
      var emitted = on ? since * Math.max(0.0001, v) : 0;
      for (var i2 = 0; i2 < MAXN; i2++) {
        var n = notes[i2];
        var k = Math.floor(emitted) - i2;
        if (!on || k < 0) { n.style.opacity = 0; continue; }
        var age = (emitted - Math.floor(emitted) + i2) / Math.max(0.5, v);
        if (age > 2.6) { n.style.opacity = 0; continue; }
        var rx = rng(k), ry = rng(k + 99);
        var bx = cx - 380 * sc + 495 * sc - 75, by = 230 + 505 * sc;
        var x = bx + (rx - 0.3) * 900 * age, y = by + 60 * age + 500 * age * age * 0.35 - (ry * 260 * age);
        var rot = (rx - 0.5) * 400 * age;
        n.style.opacity = age < 0.08 ? age / 0.08 : age > 2.1 ? (2.6 - age) / 0.5 : 1;
        n.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + rot.toFixed(1) + 'deg) scale(' + (0.6 + Math.min(1, age * 3) * 0.5).toFixed(3) + ')';
      }
    };
  };

  // ================================================================ CALENDARIO (120 quadradinhos = 120 meses)
  /* p: { meses: 120, preenche: [{at, m}], marcos: [{mes, at, cor, rotulo}], idade: 25 (opcional: mostra 25 -> 35),
          titulo } */
  OF.calendario = function (root, p, t0, dur) {
    var N = p.meses || 120, COLS = 12, ROWS = Math.ceil(N / COLS), CS = 62, GAP = 12;
    var gw = COLS * CS + (COLS - 1) * GAP, gh = ROWS * CS + (ROWS - 1) * GAP;
    var st = stage(root, { ry: -8, rx: 10 });
    var X = (W - gw) / 2 + (p.idade !== undefined ? 160 : 0), Y = 200;
    var grid = el('div', { style: 'position:absolute;left:' + X + 'px;top:' + Y + 'px;width:' + gw + 'px;height:' + gh + 'px' }, st.cam);
    var cells = [];
    for (var i = 0; i < N; i++) {
      var c = el('div', { style: 'position:absolute;left:' + (i % COLS) * (CS + GAP) + 'px;top:' + Math.floor(i / COLS) * (CS + GAP) + 'px;width:' + CS + 'px;height:' + CS + 'px;border-radius:8px;border:2.5px solid rgba(255,255,255,.35)' }, grid);
      cells.push(c);
    }
    var yl = [];
    for (var r = 0; r < ROWS; r++) yl.push(el('div', { style: 'position:absolute;left:' + (X - 150) + 'px;top:' + (Y + r * (CS + GAP) + 10) + 'px;width:130px;text-align:right;' + FONT_CAP + 'font-size:30px;color:' + C.whisper, text: 'ANO ' + (r + 1) }, st.cam));
    var side = p.idade !== undefined ? el('div', { style: 'position:absolute;left:' + (X - 560) + 'px;top:' + (Y + gh / 2 - 160) + 'px;width:340px;text-align:center' }, st.cam) : null;
    var idadeV, idadeL;
    if (side) {
      idadeV = el('div', { style: FONT_NUM + 'font-size:230px;line-height:0.85;color:' + C.text }, side);
      idadeL = el('div', { style: FONT_CAP + 'font-size:40px;color:' + C.text, text: 'ANOS' }, side);
    }
    var title = p.titulo ? el('div', { style: 'position:absolute;left:0;right:0;top:70px;text-align:center;' + FONT_CAP + 'font-size:54px;font-style:italic;font-weight:600;color:' + C.text, text: p.titulo }, root) : null;
    var mlab = (p.marcos || []).map(function (mk) { return el('div', { style: 'position:absolute;' + FONT_CAP + 'font-size:30px;color:#000;padding:4px 14px;white-space:nowrap;opacity:0;background:' + (C[mk.cor] || C.hl), text: mk.rotulo || 'MÊS ' + mk.mes }, st.cam); });
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.8);
      if (title) popText(title, T, t0, undefined, 'rise');
      var pin = prog(T, t0, 0.4, E.out5);
      grid.style.opacity = pin;
      var m = kf(p.preenche, T, 'm', 0, 1.6);
      var marks = {};
      (p.marcos || []).forEach(function (mk, k) {
        if (T >= mk.at) marks[mk.mes] = mk.cor || 'hl';
        var on = T >= mk.at ? prog(T, mk.at, 0.2, E.back) : 0;
        var cxp = X + ((mk.mes - 1) % COLS) * (CS + GAP) + CS / 2, cyp = Y + Math.floor((mk.mes - 1) / COLS) * (CS + GAP);
        mlab[k].style.left = cxp - 90 + 'px'; mlab[k].style.top = cyp - 52 + 'px';
        mlab[k].style.opacity = on * (mk.ate !== undefined && T > mk.ate ? 0 : 1);
        mlab[k].style.transform = 'scale(' + (0.6 + 0.4 * on).toFixed(3) + ')';
      });
      for (var i = 0; i < N; i++) {
        var f = c01(m - i);
        var col = marks[i + 1] ? C[marks[i + 1]] || C.hl : C.gain;
        cells[i].style.background = f > 0 ? col : 'transparent';
        cells[i].style.opacity = f > 0 ? (0.35 + 0.65 * f).toFixed(3) : '1';
        cells[i].style.boxShadow = marks[i + 1] && f > 0 ? '0 0 22px ' + col : 'none';
        cells[i].style.transform = f > 0 && f < 1 ? 'scale(' + (0.7 + 0.3 * f).toFixed(3) + ')' : 'none';
      }
      yl.forEach(function (n, r) { n.style.opacity = (pin * (m > r * COLS ? 1 : 0.45)).toFixed(3); });
      if (side) {
        idadeV.textContent = String(Math.floor(p.idade + Math.min(N, m) / 12));
        side.style.opacity = pin;
        void idadeL;
      }
    };
  };

  // ================================================================ FORMULA (aporte x 177 = meta)
  /* p: { linhas: [{at, a: 'R$ 500', b: 'R$ 88 MIL', destaque}], operador: '× 177 =', titulo, tituloAt } */
  OF.formula = function (root, p, t0, dur) {
    var st = stage(root, { ry: -3, rx: 2 });
    var n = p.linhas.length, RH = n > 2 ? 190 : 230;
    var top = (H - n * RH) / 2 + (p.titulo ? 60 : 0);
    var title = p.titulo ? el('div', { style: 'position:absolute;left:0;right:0;top:' + (top - 150) + 'px;text-align:center;' + FONT_CAP + 'font-size:62px;color:' + C.text, text: p.titulo }, st.cam) : null;
    var rows = p.linhas.map(function (ln, i) {
      var r = el('div', { style: 'position:absolute;left:0;right:0;top:' + (top + i * RH) + 'px;height:' + RH + 'px;display:flex;align-items:center;justify-content:center;gap:46px' }, st.cam);
      var fs = ln.tam || p.tam || 170;
      var a = el('div', { style: FONT_NUM + 'font-size:' + fs + 'px;white-space:nowrap;color:' + C.text + ';width:640px;text-align:right', text: ln.a }, r);
      var op = el('div', { style: FONT_NUM + 'font-size:120px;color:' + C.brand + ';white-space:nowrap', text: ln.op || p.operador || '× 177 =' }, r);
      var b = el('div', { style: FONT_NUM + 'font-size:' + fs + 'px;white-space:nowrap;color:' + (ln.cor ? C[ln.cor] : C.gain) + ';width:640px;text-align:left;text-shadow:0 0 30px ' + (ln.cor ? C[ln.cor] : C.gain) + '66', text: ln.b }, r);
      return { r: r, a: a, op: op, b: b, ln: ln };
    });
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.7);
      if (title) popText(title, T, p.tituloAt !== undefined ? p.tituloAt : t0, undefined, 'rise');
      rows.forEach(function (o) {
        var at = o.ln.at !== undefined ? o.ln.at : t0;
        popText(o.a, T, at, undefined, 'rise');
        popText(o.op, T, at + 0.12, undefined, 'pop');
        popText(o.b, T, o.ln.bAt !== undefined ? o.ln.bAt : at + 0.3, undefined, 'pop');
        var dim = o.ln.ate !== undefined && T > o.ln.ate ? 0.3 : 1;
        o.r.style.opacity = dim;
      });
    };
  };

  // ================================================================ BARRA dividida (177 = 123 + 54)
  /* p: { total: 'R$ 177 MIL', totalAt, partes: [{at, valor: 123000, rotulo: 'DO SEU BOLSO', cor: 'text'}], titulo } */
  OF.barra = function (root, p, t0, dur) {
    var st = stage(root, { ry: -6, rx: 4 });
    var BW = 1500, BH = 170, X = (W - BW) / 2, Y = 470;
    var sum = p.partes.reduce(function (a, b) { return a + b.valor; }, 0);
    var tot = el('div', { style: 'position:absolute;left:0;right:0;top:' + (Y - 280) + 'px;text-align:center;' + FONT_NUM + 'font-size:210px;line-height:1;color:' + C.text, text: p.total || brl(sum, { mil: true }) }, st.cam);
    var frame = el('div', { style: 'position:absolute;left:' + X + 'px;top:' + Y + 'px;width:' + BW + 'px;height:' + BH + 'px;border:4px solid rgba(255,255,255,.7);border-radius:14px;overflow:hidden' }, st.cam);
    var acc = 0;
    var parts = p.partes.map(function (pt) {
      var w = (pt.valor / sum) * BW;
      var color = C[pt.cor || 'gain'] || pt.cor;
      var seg = el('div', { style: 'position:absolute;top:0;bottom:0;left:' + acc + 'px;width:' + w + 'px;background:' + color + ';transform-origin:0 50%' }, frame);
      var lb = el('div', { style: 'position:absolute;top:' + (Y + BH + 30) + 'px;left:' + (X + acc) + 'px;width:' + Math.max(w, 300) + 'px;text-align:' + (acc > 0 ? 'right' : 'left') + ';' + (acc > 0 ? 'margin-left:' + (w - Math.max(w, 300)) + 'px;' : '') }, st.cam);
      var v = el('div', { style: FONT_NUM + 'font-size:120px;line-height:1;color:' + color }, lb);
      el('div', { style: FONT_CAP + 'font-size:36px;color:' + C.text, text: pt.rotulo }, lb);
      acc += w;
      return { seg: seg, lb: lb, v: v, pt: pt };
    });
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.7);
      popText(tot, T, p.totalAt !== undefined ? p.totalAt : t0, undefined, 'rise');
      frame.style.opacity = prog(T, t0, 0.3);
      parts.forEach(function (o) {
        var at = o.pt.at !== undefined ? o.pt.at : t0;
        var pr = prog(T, at, 0.5, E.out3);
        o.seg.style.transform = 'scaleX(' + pr.toFixed(4) + ')';
        o.lb.style.opacity = T >= at ? Math.min(1, pr * 2) : 0;
        o.v.textContent = brl(o.pt.valor * pr, { mil: true });
      });
    };
  };

  // ================================================================ COMPARAR (A vs B)
  /* p: { itens: [{at, titulo: 'R$ 100 MIL', valor: 'R$ 565', sub: 'POR MÊS', cor: 'text'}], vs: 'VS' } */
  OF.comparar = function (root, p, t0, dur) {
    var st = stage(root, { ry: 0, rx: 3 });
    var n = p.itens.length;
    var cols = p.itens.map(function (it, i) {
      var cx = n === 1 ? W / 2 : W * (0.27 + (0.46 * i) / (n - 1));
      var d = el('div', { style: 'position:absolute;left:' + (cx - 380) + 'px;width:760px;top:270px;text-align:center' }, st.cam);
      var t = el('div', { style: FONT_CAP + 'font-size:62px;white-space:nowrap;color:' + C.text, text: it.titulo }, d);
      var v = el('div', { style: FONT_NUM + 'font-size:' + (it.tam || 250) + 'px;white-space:nowrap;line-height:0.95;margin-top:20px;color:' + (C[it.cor || 'gain'] || it.cor) + ';text-shadow:0 0 34px ' + (C[it.cor || 'gain'] || it.cor) + '66', text: it.valor }, d);
      var s2 = el('div', { style: FONT_CAP + 'font-size:44px;color:' + C.whisper, text: it.sub || '' }, d);
      return { d: d, t: t, v: v, s: s2, it: it };
    });
    var vs = n > 1 ? el('div', { style: 'position:absolute;left:0;right:0;top:450px;text-align:center;' + FONT_NUM + 'font-size:110px;color:' + C.brand, text: p.vs || 'VS' }, st.cam) : null;
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.6);
      cols.forEach(function (o) {
        var at = o.it.at !== undefined ? o.it.at : t0;
        popText(o.t, T, at, undefined, 'rise');
        popText(o.v, T, o.it.valorAt !== undefined ? o.it.valorAt : at + 0.15, undefined, 'pop');
        popText(o.s, T, (o.it.valorAt !== undefined ? o.it.valorAt : at + 0.15) + 0.1, undefined, 'rise');
        o.d.style.filter = o.it.apagaAt !== undefined && T > o.it.apagaAt ? 'grayscale(1) brightness(.45)' : 'none';
      });
      if (vs) popText(vs, T, cols[1].it.at !== undefined ? cols[1].it.at - 0.1 : t0, undefined, 'pop');
    };
  };

  // ================================================================ LISTA de passos (1, 2, 3)
  /* p: { titulo, itens: [{at, n: '1', texto: 'QUANTO RENDE HOJE', icone svg opcional}], ativo: [{at, i}] } */
  OF.lista = function (root, p, t0, dur) {
    var st = stage(root, { ry: -6, rx: 3 });
    var n = p.itens.length;
    var title = p.titulo ? el('div', { style: 'position:absolute;left:0;right:0;top:110px;text-align:center;' + FONT_CAP + 'font-size:56px;font-style:italic;font-weight:600;color:' + C.text, text: p.titulo }, st.cam) : null;
    var rows = p.itens.map(function (it, i) {
      var r = el('div', { style: 'position:absolute;left:330px;right:200px;top:' + (290 + i * 200) + 'px;height:170px;display:flex;align-items:center;gap:50px' }, st.cam);
      var num = el('div', { style: FONT_NUM + 'font-size:190px;color:' + C.brand + ';width:150px;text-align:center', text: it.n || String(i + 1) }, r);
      var tx = el('div', { style: FONT_CAP + 'font-size:72px;color:' + C.text + ';white-space:nowrap', text: it.texto }, r);
      return { r: r, num: num, tx: tx, it: it };
    });
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.6);
      if (title) popText(title, T, t0, undefined, 'rise');
      var ativo = -1;
      (p.ativo || []).forEach(function (a) { if (T >= a.at) ativo = a.i; });
      rows.forEach(function (o, i) {
        var at = o.it.at !== undefined ? o.it.at : t0;
        popText(o.r, T, at, undefined, 'rise');
        if (T >= at) {
          var on = ativo < 0 || ativo === i;
          o.r.style.opacity = on ? 1 : 0.28;
          o.tx.style.color = ativo === i ? C.hl : C.text;
        }
      });
      void n;
    };
  };

  // ================================================================ NUMEROS em sequencia (marcos 10 mil, 50 mil, 100 mil...)
  /* p: { itens: [{at, valor: '10 MIL', cor, risca}], riscaAt, rotulo } -> numeros lado a lado que entram em pop */
  OF.numeros = function (root, p, t0, dur) {
    var st = stage(root, { ry: 0, rx: 2 });
    var n = p.itens.length;
    var cols = p.itens.map(function (it, i) {
      var cx = n === 1 ? W / 2 : W * (0.2 + (0.6 * i) / (n - 1));
      var d = el('div', { style: 'position:absolute;left:' + (cx - 300) + 'px;width:600px;top:' + (p.y || 330) + 'px;text-align:center' }, st.cam);
      var v = el('div', { style: FONT_NUM + 'font-size:' + (p.tamanho || 200) + 'px;line-height:1;color:' + (C[it.cor || 'text'] || it.cor), text: it.valor }, d);
      var sub = it.sub ? el('div', { style: FONT_CAP + 'font-size:40px;color:' + C.whisper, text: it.sub }, d) : null;
      var line = svg('svg', { width: 600, height: 200, style: 'position:absolute;left:0;top:0;overflow:visible' }, d);
      var l = svg('line', { x1: 60, y1: 170, x2: 540, y2: 40, stroke: C.loss, 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-dasharray': 600, 'stroke-dashoffset': 600 }, line);
      return { d: d, v: v, sub: sub, l: l, it: it };
    });
    var rot = p.rotulo ? el('div', { style: 'position:absolute;left:0;right:0;top:' + ((p.y || 330) + 290) + 'px;text-align:center;' + FONT_CAP + 'font-size:60px;color:' + C.text, text: p.rotulo }, st.cam) : null;
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.6);
      cols.forEach(function (o) {
        popText(o.d, T, o.it.at !== undefined ? o.it.at : t0, undefined, 'pop');
        var ra = o.it.riscaAt !== undefined ? o.it.riscaAt : p.riscaAt;
        o.l.setAttribute('stroke-dashoffset', ra === undefined || T < ra ? '600' : (600 * (1 - prog(T, ra, 0.25))).toFixed(1));
        if (ra !== undefined && T > ra) o.v.style.color = C.whisper;
      });
      if (rot) popText(rot, T, p.rotuloAt !== undefined ? p.rotuloAt : t0, undefined, 'rise');
    };
  };

  // ================================================================ CITACAO (frase famosa + autor + selo)
  /* p: { texto: 'OS JUROS COMPOSTOS SÃO A 8ª MARAVILHA DO MUNDO', autor: 'ALBERT EINSTEIN', autorAt, selo: 'ATRIBUÍDA', seloAt } */
  OF.citacao = function (root, p, t0, dur) {
    var st = stage(root, { ry: -4, rx: 2 });
    var box = el('div', { style: 'position:absolute;left:260px;right:260px;top:300px;text-align:center' }, st.cam);
    var q = el('div', { style: FONT_NUM + 'font-size:220px;line-height:0.6;color:' + C.brand + ';height:110px', text: '“' }, box);
    var words = String(p.texto).split(' ');
    var line = el('div', { style: "font-family:'Montserrat',sans-serif;font-weight:600;font-style:italic;font-size:76px;line-height:1.18;color:" + C.text + ';text-transform:uppercase' }, box);
    var spans = words.map(function (w) { return el('span', { style: 'display:inline-block;margin:0 12px;opacity:0', text: w }, line); });
    var autor = el('div', { style: FONT_CAP + 'font-size:42px;color:' + C.whisper + ';margin-top:46px;letter-spacing:0.06em', text: '— ' + (p.autor || '') }, box);
    var selo = p.selo ? el('div', { style: 'position:absolute;right:330px;top:690px;' + FONT_CAP + 'font-size:52px;color:' + C.loss + ';border:7px solid ' + C.loss + ';padding:6px 26px;border-radius:10px;opacity:0;transform-origin:50% 50%', text: p.selo }, st.cam) : null;
    var per = Math.min(0.12, (dur * 0.45) / Math.max(1, words.length));
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.6);
      popText(q, T, t0, undefined, 'pop');
      spans.forEach(function (sp, i) { var a = t0 + 0.15 + i * per; var pr = prog(T, a, 0.18, E.out3); sp.style.opacity = pr; sp.style.transform = 'translateY(' + ((1 - pr) * 24).toFixed(1) + 'px)'; });
      popText(autor, T, p.autorAt !== undefined ? p.autorAt : t0 + 0.4 + words.length * per, undefined, 'rise');
      if (selo) {
        var sp = prog(T, p.seloAt, 0.14, E.out3);
        selo.style.opacity = p.seloAt !== undefined && T >= p.seloAt ? 1 : 0;
        selo.style.transform = 'rotate(-12deg) scale(' + (2.2 - 1.2 * sp).toFixed(3) + ')';
      }
    };
  };

  // ================================================================ FIM (tela do proximo video)
  /* p: { titulo: 'COMO INVESTIR MELHOR QUE 90% DAS PESSOAS', chamada: 'PRÓXIMO VÍDEO', tituloAt }
     Deixa um quadro vazio (16:9) a esquerda para o card de fim de tela do YouTube. */
  OF.fim = function (root, p, t0, dur) {
    var st = stage(root, { ry: 3, rx: 2 });
    var fx = 150, fy = 250, fw = 960, fh = 540;
    var frame = el('div', { style: 'position:absolute;left:' + fx + 'px;top:' + fy + 'px;width:' + fw + 'px;height:' + fh + 'px;border:5px solid ' + C.brand + ';border-radius:18px;box-shadow:0 0 50px rgba(255,153,0,.35),inset 0 0 80px rgba(255,153,0,.10)' }, st.cam);
    var play = svg('svg', { width: 160, height: 160, viewBox: '0 0 24 24', style: 'position:absolute;left:' + (fw / 2 - 80) + 'px;top:' + (fh / 2 - 80) + 'px;opacity:0.5' }, frame);
    svg('polygon', { points: '8,5 19,12 8,19', fill: C.brand }, play);
    var chamada = el('div', { style: 'position:absolute;left:' + (fx + fw + 70) + 'px;top:' + (fy + 10) + 'px;' + FONT_CAP + 'font-size:40px;color:' + C.brand, text: p.chamada || 'PRÓXIMO VÍDEO' }, st.cam);
    var titulo = el('div', { style: 'position:absolute;left:' + (fx + fw + 70) + 'px;top:' + (fy + 80) + 'px;width:620px;' + FONT_CAP + 'font-size:66px;line-height:1.08;color:' + C.text, text: p.titulo || '' }, st.cam);
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.5);
      var pf = prog(T, t0, 0.4, E.out5);
      frame.style.opacity = pf;
      frame.style.transform = 'scale(' + (0.85 + 0.15 * pf).toFixed(3) + ')';
      popText(chamada, T, t0 + 0.2, undefined, 'rise');
      popText(titulo, T, p.tituloAt !== undefined ? p.tituloAt : t0 + 0.35, undefined, 'rise');
    };
  };

  var VS = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }';
  var FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uImg; uniform sampler2D uDepth;',
    'uniform vec2 uRes; uniform vec2 uImgRes; uniform vec2 uAnchor;',
    'uniform float uZoom; uniform vec2 uPan; uniform vec2 uPar; uniform float uFocus;',
    'uniform vec2 uBlur; uniform float uFade; uniform float uGrain; uniform float uVig; uniform float uSeed;',
    'uniform float uSat; uniform float uWarm; uniform float uBright; uniform float uContrast; uniform float uRot; uniform float uInset; uniform float uSoft; uniform float uLift;',
    'float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }',
    // enquadramento "cover" que nunca sai da imagem: zoom minimo e centro travados pela margem do parallax e da rotacao
    'vec2 cover(vec2 uv){',
    '  float ca = uRes.x/uRes.y; float ia = uImgRes.x/uImgRes.y;',
    '  vec2 s = vec2(1.0); if (ia > ca) s.x = ca/ia; else s.y = ia/ca;',
    '  float m = length(uPar)*0.55 + abs(sin(uRot))*0.45 + 0.004;',
    '  float z = max(uZoom, 1.0/(1.0-2.0*m));',
    '  vec2 h = 0.5*s/z;',
    '  vec2 a = vec2(mix(s.x*0.5, 1.0-s.x*0.5, uAnchor.x), mix(1.0-s.y*0.5, s.y*0.5, uAnchor.y));',
    '  vec2 c = clamp(a + uPan*s, h + m, 1.0 - h - m);',
    '  vec2 q = (uv-0.5); float co = cos(uRot), si = sin(uRot);',
    '  q.x *= ca; q = vec2(q.x*co - q.y*si, q.x*si + q.y*co); q.x /= ca;',
    '  return c + q*s/z;',
    '}',
    'vec2 ins(vec2 uv){ return uInset + clamp(uv,0.0,1.0)*(1.0-2.0*uInset); }',
    'vec3 samp(vec2 uv){',
    '  vec2 off = vec2(0.0);',
    '  for (int i=0;i<5;i++){ float d = texture2D(uDepth, ins(uv+off)).r; off = uPar*(d-uFocus); }',
    '  vec2 u = ins(uv+off); vec3 c = texture2D(uImg, u).rgb;',
    '  if (uSoft > 0.0) { vec2 e = uSoft/uImgRes; c = (c*2.0 + texture2D(uImg,u+vec2(e.x,0.)).rgb + texture2D(uImg,u-vec2(e.x,0.)).rgb + texture2D(uImg,u+vec2(0.,e.y)).rgb + texture2D(uImg,u-vec2(0.,e.y)).rgb)/6.0; }',
    '  return c;',
    '}',
    'void main(){',
    '  vec2 uv = cover(vUv);',
    '  vec3 col;',
    '  if (length(uBlur) > 0.0005) { col = vec3(0.0); for (int i=0;i<13;i++){ float t = float(i)/12.0-0.5; col += samp(uv+uBlur*t); } col /= 13.0; }',
    '  else col = samp(uv);',
    '  float l = dot(col, vec3(0.299,0.587,0.114));',
    '  col = mix(vec3(l), col, uSat);',
    '  col = (col-0.5)*uContrast+0.5;',
    '  col *= vec3(1.0+0.07*uWarm, 1.0+0.015*uWarm, 1.0-0.09*uWarm);',
    '  col = col*uBright + vec3(0.025,0.02,0.015);',
    '  vec2 q = vUv-0.5; q.x *= uRes.x/uRes.y;',
    '  col *= 1.0 - uVig*smoothstep(0.35, 1.25, length(q));',
    '  col = col*(1.0-uLift) + uLift*vec3(0.58,0.55,0.5);',
    '  col += (hash(floor(vUv*uRes*0.75)+uSeed)-0.5)*uGrain;',
    '  col *= (1.0-uFade);',
    '  gl_FragColor = vec4(clamp(col,0.0,1.0),1.0);',
    '}'
  ].join('\n');


  // ================================================================ FOTO 3D (imagem + mapa de profundidade, WebGL)
  /* p: { src, depth (opcional: sem mapa vira plano), camera: [{at, zoom, x, y, px, py, rot, dur}],
          grade: {sat, contrast, bright, warm}, grain, vignette }
     Gere o mapa com: python -I scripts/hf/profundidade.py <pasta> <pasta-saida> (Depth Anything V2, na placa).
     ASSINCRONA: devolve uma Promise<render>; o build registra a timeline depois que as imagens carregam. */
  OF.foto3d = function (root, p, t0, dur) {
    var cv = el('canvas', { width: W, height: H, style: 'position:absolute;inset:0;width:' + W + 'px;height:' + H + 'px' }, root);
    var gl = cv.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
    var load = function (src) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('nao carregou ' + src)); }; im.src = src; }); };
    var flat = function () { var c = document.createElement('canvas'); c.width = c.height = 2; var x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 2, 2); return c; };
    function sh(type, s0) { var s = gl.createShader(type); gl.shaderSource(s, s0); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uImg', 'uDepth', 'uRes', 'uImgRes', 'uAnchor', 'uZoom', 'uPan', 'uPar', 'uFocus', 'uBlur', 'uFade', 'uGrain', 'uVig', 'uSeed', 'uSat', 'uWarm', 'uBright', 'uContrast', 'uRot', 'uInset', 'uSoft', 'uLift']
      .forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    function tex(unit, img) {
      var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR); });
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); });
    }
    var g0 = Object.assign({ sat: 1, contrast: 1.04, bright: 1, warm: 0 }, p.grade || {});
    return Promise.all([load(p.src), p.depth ? load(p.depth).catch(flat) : Promise.resolve(flat())]).then(function (r) {
      tex(0, r[0]); tex(1, r[1]);
      gl.uniform1i(U.uImg, 0); gl.uniform1i(U.uDepth, 1);
      gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uImgRes, r[0].naturalWidth, r[0].naturalHeight);
      gl.uniform2f(U.uAnchor, p.anchorX == null ? 0.5 : p.anchorX, p.anchorY == null ? 0.5 : p.anchorY);
      gl.uniform1f(U.uInset, 0.003);
      gl.viewport(0, 0, W, H);
      var cam = p.camera || [{ at: t0, zoom: 1.0, px: -0.6, py: 0.15 }, { at: t0 + 0.01, zoom: 1.12, px: 0.6, py: -0.1, dur: dur }];
      return function (tl) {
        var T = t0 + tl;
        var k = function (n, d) { return kf(cam, T, n, d, dur); };
        gl.uniform1f(U.uZoom, k('zoom', 1)); gl.uniform2f(U.uPan, k('x', 0), k('y', 0));
        gl.uniform2f(U.uPar, k('px', 0) * 0.04, k('py', 0) * 0.04);
        gl.uniform1f(U.uFocus, k('focus', 0.5)); gl.uniform1f(U.uRot, (k('rot', 0) * Math.PI) / 180);
        var fadeIn = 1 - prog(T, t0, 0.35, E.out3), fadeOut = p.saida === false ? 0 : c01((T - (t0 + dur - 0.25)) / 0.25);
        gl.uniform2f(U.uBlur, 0, fadeIn * 0.02); gl.uniform1f(U.uFade, Math.max(fadeIn * 0.9, fadeOut));
        gl.uniform1f(U.uGrain, p.grain == null ? 0.03 : p.grain); gl.uniform1f(U.uSoft, 0); gl.uniform1f(U.uLift, 0);
        gl.uniform1f(U.uVig, p.vignette == null ? 0.35 : p.vignette);
        gl.uniform1f(U.uSeed, Math.floor(T * 24) * 7.13);
        gl.uniform1f(U.uSat, g0.sat); gl.uniform1f(U.uWarm, g0.warm); gl.uniform1f(U.uBright, g0.bright); gl.uniform1f(U.uContrast, g0.contrast);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
    });
  };

  // ================================================================ PALCO DE ICONES (motion de icones no preto)
  /* O "jeito Furry": icones de traco branco que entram, andam, trocam de lugar, mandam coisas um para o outro.
     p: { atores: [{ id, icone: 'wallet' (nome Lucide; o build injeta `svg`), rotulo, cor, tam: 260,
                     keys: [{ at, x, y, s, r, o, dur }]   x,y = 0..1 da tela; s escala; r rotacao (graus); o opacidade
                     entra: 'pop'|'rise'|'whip' (no 1o key), riscaAt, sai: at, pulsaAt: [at...], balanca: false (sem idle) }],
          fluxos: [{ de: id, para: id, at, ate, icone: 'coins' (svg injetado), cor, tam: 70, por: 3 (itens/s), viagem: 0.9, arco: -0.18 }],
          setas:  [{ de: id, para: id, at, ate, cor, rotulo }],
          textos: [{ at, ate, texto, x, y, tam: 84, cor, fonte: 'cap'|'num' }] }  */
  var k01 = function (s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return h / 97; };
  OF.palco = function (root, p, t0, dur) {
    var st = stage(root, { ry: 0, rx: 0 });
    var sv = svg('svg', { width: W, height: H, style: 'position:absolute;inset:0;overflow:visible' }, st.cam);
    var atores = {};
    (p.atores || []).forEach(function (a, k) {
      var size = a.tam || 260, color = C[a.cor || 'text'] || a.cor;
      var box = el('div', { style: 'position:absolute;left:0;top:0;width:' + size + 'px;display:flex;flex-direction:column;align-items:center;opacity:0' }, st.cam);
      var ic = el('div', { style: 'line-height:0;color:' + color + ';filter:drop-shadow(0 0 ' + Math.round(size / 12) + 'px ' + color + 'aa)', html: a.svg || '' }, box);
      var lb = a.rotulo ? el('div', { style: FONT_CAP + 'font-size:' + Math.round(Math.max(28, size / 6.5)) + 'px;color:' + C.text + ';white-space:nowrap;margin-top:14px', text: a.rotulo }, box) : null;
      var risco = a.riscaAt !== undefined ? svg('line', { stroke: C.loss, 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-dasharray': 1000, 'stroke-dashoffset': 1000 }, sv) : null;
      var key = a.id || 'a' + k;
      atores[key] = { key: key, a: a, box: box, ic: ic, lb: lb, size: size, risco: risco, x: 0, y: 0, s: 1 };
    });
    var setas = (p.setas || []).map(function (s0) {
      var g1 = svg('g', { opacity: 0 }, sv);
      var col = C[s0.cor || 'text'] || s0.cor;
      var ln = svg('path', { fill: 'none', stroke: col, 'stroke-width': 6, 'stroke-dasharray': '16 14', 'stroke-linecap': 'round' }, g1);
      var hd = svg('path', { fill: col }, g1);
      var lb = s0.rotulo ? el('div', { style: 'position:absolute;left:0;top:0;' + FONT_CAP + 'font-size:34px;color:' + col + ';white-space:nowrap;opacity:0', text: s0.rotulo }, st.cam) : null;
      return { s: s0, g: g1, ln: ln, hd: hd, lb: lb };
    });
    var fluxos = (p.fluxos || []).map(function (f) {
      var col = C[f.cor || 'gain'] || f.cor;
      var a0 = f.at !== undefined ? f.at : t0, a1 = f.ate !== undefined ? f.ate : t0 + dur;
      var n = Math.min(60, Math.ceil((a1 - a0) * (f.por || 3)) + 1);
      var itens = [];
      for (var i = 0; i < n; i++) itens.push(el('div', { style: 'position:absolute;left:0;top:0;line-height:0;color:' + col + ';opacity:0;filter:drop-shadow(0 0 8px ' + col + ')', html: f.svg || '<svg width="40" height="40"><circle cx="20" cy="20" r="16" fill="' + col + '"/></svg>' }, st.cam));
      return { f: f, itens: itens, a0: a0, a1: a1 };
    });
    var textos = (p.textos || []).map(function (t) {
      return { t: t, n: el('div', { style: 'position:absolute;left:0;top:0;transform-origin:50% 50%;white-space:nowrap;' + (t.fonte === 'num' ? FONT_NUM : FONT_CAP) + 'font-size:' + (t.tam || 84) + 'px;color:' + (C[t.cor || 'text'] || t.cor) + ';opacity:0', text: t.texto }, st.cam) };
    });
    var pos = function (o, T) {
      var ks = o.a.keys || [{ at: t0, x: 0.5, y: 0.45 }];
      return { x: kf(ks, T, 'x', 0.5, 0.7) * W, y: kf(ks, T, 'y', 0.45, 0.7) * H, s: kf(ks, T, 's', 1, 0.7), r: kf(ks, T, 'r', 0, 0.7), o: kf(ks, T, 'o', 1, 0.4) };
    };
    return function (tl) {
      var T = t0 + tl;
      st.move(T, t0, dur, 0.4);
      Object.keys(atores).forEach(function (id) {
        var o = atores[id], a = o.a, ks = a.keys || [{ at: t0 }];
        var at = ks[0].at !== undefined ? ks[0].at : t0;
        var q = pos(o, T);
        var kind = a.entra || 'pop';
        var pe = prog(T, at, kind === 'pop' ? 0.18 : 0.25, kind === 'pop' ? E.back : E.out5);
        var sai = a.sai !== undefined ? c01((T - a.sai) / 0.2) : 0;
        var vis = T >= at ? 1 : 0;
        var idle = a.balanca === false ? 0 : 1;
        var bob = Math.sin((T + k01(id)) * 2.1) * 6 * idle, tilt = Math.sin((T + k01(id)) * 1.3) * 2 * idle;
        var dx = kind === 'whip' ? (1 - pe) * -260 : 0, dy = kind === 'rise' ? (1 - pe) * 120 : 0;
        var sc = q.s * (kind === 'pop' ? 0.4 + 0.6 * pe : 1);
        (a.pulsaAt || []).forEach(function (pa) { var d = T - pa; if (d >= 0 && d < 0.35) sc *= 1 + 0.18 * Math.sin((d / 0.35) * Math.PI); });
        o.box.style.opacity = (vis * Math.min(1, pe * 1.5) * q.o * (1 - sai)).toFixed(3);
        o.box.style.transform = 'translate(' + (q.x - o.size / 2 + dx).toFixed(1) + 'px,' + (q.y - o.size / 2 + bob + dy + sai * 60).toFixed(1) + 'px) rotate(' + (q.r + tilt).toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
        o.box.style.filter = 'none';
        o.x = q.x; o.y = q.y; o.s = q.s;
        if (o.risco) {
          var r = o.size * 0.45 * q.s;
          o.risco.setAttribute('x1', q.x - r); o.risco.setAttribute('y1', q.y + r); o.risco.setAttribute('x2', q.x + r); o.risco.setAttribute('y2', q.y - r);
          o.risco.setAttribute('stroke-dashoffset', (1000 * (1 - prog(T, a.riscaAt, 0.22))).toFixed(1));
          o.risco.style.opacity = vis * (1 - sai);
          o.ic.style.color = T > a.riscaAt ? C.whisper : C[a.cor || 'text'] || a.cor;
        }
      });
      setas.forEach(function (o) {
        var A = atores[o.s.de], B = atores[o.s.para];
        if (!A || !B) return;
        var on = T >= o.s.at && (o.s.ate === undefined || T < o.s.ate);
        var pr = prog(T, o.s.at, 0.35, E.out3);
        var ang = Math.atan2(B.y - A.y, B.x - A.x), gapA = A.size * 0.6 * A.s, gapB = B.size * 0.6 * B.s;
        var x1 = A.x + Math.cos(ang) * gapA, y1 = A.y + Math.sin(ang) * gapA;
        var x2 = B.x - Math.cos(ang) * gapB, y2 = B.y - Math.sin(ang) * gapB;
        var xe = lerp(x1, x2, pr), ye = lerp(y1, y2, pr);
        o.ln.setAttribute('d', 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' L' + xe.toFixed(1) + ' ' + ye.toFixed(1));
        o.ln.setAttribute('stroke-dashoffset', (-T * 60).toFixed(1));
        var hx = Math.cos(ang), hy = Math.sin(ang);
        o.hd.setAttribute('d', 'M' + (xe + hx * 18).toFixed(1) + ' ' + (ye + hy * 18).toFixed(1) + ' L' + (xe - hx * 14 - hy * 16).toFixed(1) + ' ' + (ye - hy * 14 + hx * 16).toFixed(1) + ' L' + (xe - hx * 14 + hy * 16).toFixed(1) + ' ' + (ye - hy * 14 - hx * 16).toFixed(1) + ' Z');
        o.g.style.opacity = on ? 1 : 0;
        if (o.lb) { o.lb.style.opacity = on ? pr : 0; o.lb.style.transform = 'translate(' + ((x1 + x2) / 2 - o.lb.offsetWidth / 2).toFixed(1) + 'px,' + ((y1 + y2) / 2 - 70).toFixed(1) + 'px)'; }
      });
      fluxos.forEach(function (o) {
        var A = atores[o.f.de], B = atores[o.f.para], f = o.f;
        var por = f.por || 3, viagem = f.viagem || 0.9;
        o.itens.forEach(function (n, i) {
          var nasce = o.a0 + i / por, u = (T - nasce) / viagem;
          if (!A || !B || nasce > o.a1 || u < 0 || u > 1) { n.style.opacity = 0; return; }
          var e = E.io(u), arco = (f.arco !== undefined ? f.arco : -0.18) * Math.hypot(B.x - A.x, B.y - A.y);
          var x = lerp(A.x, B.x, e), y = lerp(A.y, B.y, e) + arco * Math.sin(Math.PI * e);
          var sz = (f.tam || 100) / 2;
          n.style.opacity = (u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1).toFixed(3);
          n.style.transform = 'translate(' + (x - sz).toFixed(1) + 'px,' + (y - sz).toFixed(1) + 'px) rotate(' + (u * 220 * (i % 2 ? 1 : -1)).toFixed(1) + 'deg) scale(' + (0.7 + 0.3 * Math.sin(Math.PI * u)).toFixed(3) + ')';
        });
        if (B && T >= o.a0 + viagem && T < o.a1 + viagem) B.box.style.filter = 'drop-shadow(0 0 24px ' + (C[f.cor || 'gain'] || f.cor) + ')';
      });
      textos.forEach(function (o) {
        var t = o.t, on = T >= t.at && (t.ate === undefined || T < t.ate);
        var pr = prog(T, t.at, 0.16, E.back);
        o.n.style.opacity = on ? Math.min(1, pr * 1.5) : 0;
        o.n.style.transform = 'translate(' + ((t.x !== undefined ? t.x : 0.5) * W - o.n.offsetWidth / 2).toFixed(1) + 'px,' + ((t.y !== undefined ? t.y : 0.8) * H - o.n.offsetHeight / 2).toFixed(1) + 'px) scale(' + (0.5 + 0.5 * pr).toFixed(3) + ')';
      });
    };
  };

  // ================================================================ PIADA RELAMPAGO (easter egg de pausar o video)
  /* Piada NA CARA, mas que dura ~1 s (ou poucos quadros): quem pausa o video acha. Pedido do Joao (20/11/2026):
     "piadas mais na cara, mas que duram no maximo um segundo ou poucos frames, pra ter que parar o video e encontrar".
     p: { texto, at, dura: 0.9 (segundos na tela; 0.2 = poucos quadros), x: 0.5, y: 0.5, rot: -4, cor: 'hl', tam: 72,
          fundo: true (tarja preta atras, para ler por cima de qualquer cena), alinha: 'center'|'left' }
     Batida extra POR CIMA de outra cena (vem depois no array de beats). Entra e sai SECO (corte), sem fade. */
  OF.piada = function (root, p, t0, dur) {
    var cor = C[p.cor || 'hl'] || p.cor;
    var n = el('div', { style: "position:absolute;left:0;top:0;font-family:'Montserrat',sans-serif;font-weight:800;font-style:italic;text-transform:uppercase;font-size:" + (p.tam || 72) + 'px;line-height:1.05;color:' + cor + ';white-space:nowrap;opacity:0;transform-origin:50% 50%;' + (p.fundo === false ? 'text-shadow:0 0 18px #000,0 0 30px #000;' : 'background:#000;padding:10px 26px;box-shadow:0 0 0 4px ' + cor + ';'), text: p.texto }, root);
    return function (tl) {
      var T = t0 + tl, at = p.at !== undefined ? p.at : t0, fim = p.ate !== undefined ? p.ate : at + (p.dura !== undefined ? p.dura : 0.9);
      var on = T >= at && T < fim;
      var x = (p.x !== undefined ? p.x : 0.5) * W - (p.alinha === 'left' ? 0 : n.offsetWidth / 2), y = (p.y !== undefined ? p.y : 0.5) * H - n.offsetHeight / 2;
      n.style.opacity = on ? '1' : '0';
      // 2 quadros de "soco" na entrada
      var k = on && T - at < 2 / 30 ? 1.12 : 1;
      n.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (p.rot !== undefined ? p.rot : -4) + 'deg) scale(' + k + ')';
    };
  };

  g.OF = OF;
})(typeof window !== 'undefined' ? window : globalThis);
