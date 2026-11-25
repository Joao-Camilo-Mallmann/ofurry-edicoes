/*
 * Quebra-gelo do pao de queijo (Joao, 22/11/2026: "estilo de radio... uma cena mais engracada... cortar o clima como um
 * quebra-gelo"; "um png de pao de queijo simples, sem oculos escuros, algo bem simples, colado e amador").
 * Funcao pura do tempo, como as cenas de ofurry-cenas.js. Carregado so nos trechos que usam estas cenas.
 * O pao e um PNG recortado (src) que entra no corte seco e treme em stop-motion, como figurinha colada.
 *
 * OF.radio:     { src, radio: 'RÁDIO OFURRY', fm: '177,0 FM', texto: 'DOIS PÃO DE QUEIJO', preco: 'R$ 5', textoAt, precoAt, saiAt }
 *               Em saiAt o comercial CONGELA e fica cinza ("perdeu a graca", Joao 24/11/2026).
 * OF.paoQueijo: { src, x, y, tam, rot } so a foto, colada torta e parada por cima da cena anterior (overlay).
 */
(function (g) {
  var OF = g.OF;
  if (!OF) return;
  var W = 1920, H = 1080, PW = 400, PH = 380;
  var C = OF.C, E = OF.E, el = OF.el, svg = OF.svg, prog = OF.prog;
  var FONT_NUM = OF.FONT_NUM, FONT_CAP = OF.FONT_CAP;

  function pao(parent, src) {
    var n = el('div', { style: 'position:absolute;left:0;top:0;width:' + PW + 'px;height:' + PH + 'px;transform-origin:50% 50%;opacity:0' }, parent);
    el('img', { src: src || '', alt: '', style: 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block' }, n);
    return n;
  }

  // tremidinha de stop-motion: muda de pose 9x por segundo
  function treme(T, k) {
    var f = Math.floor(T * 9) + k * 13;
    var a = Math.sin(f * 127.1 + 311.7) * 43758.5453, b = Math.sin(f * 269.5 + 183.3) * 43758.5453;
    a -= Math.floor(a);
    b -= Math.floor(b);
    return { x: (a - 0.5) * 16, y: (b - 0.5) * 12, r: (a - 0.5) * 9 };
  }

  function estrela(parent) {
    var pts = [], N = 16, cx = 170, cy = 170;
    for (var i = 0; i < N * 2; i++) {
      var r = i % 2 ? 128 : 168, a = (i / (N * 2)) * Math.PI * 2;
      pts.push((cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1));
    }
    var s = svg('svg', { width: 340, height: 340, viewBox: '0 0 340 340', style: 'position:absolute;left:0;top:0;overflow:visible' }, parent);
    svg('polygon', { points: pts.join(' '), fill: C.loss, stroke: '#fff', 'stroke-width': 8, 'stroke-linejoin': 'round' }, s);
  }

  OF.radio = function (root, p, t0, dur) {
    var saiAt = p.saiAt !== undefined ? p.saiAt : t0 + dur;
    var textoAt = p.textoAt !== undefined ? p.textoAt : t0 + 0.12;
    var precoAt = p.precoAt !== undefined ? p.precoAt : t0 + 0.55;
    var box = el('div', { style: 'position:absolute;inset:0;overflow:hidden', 'data-layout-allow-overlap': '' }, root);
    var comercial = el('div', { style: 'position:absolute;inset:0;overflow:hidden;background:' + C.hl }, box);
    var raios = el('div', { style: 'position:absolute;left:' + (W / 2 - 1400) + 'px;top:' + (H / 2 - 1400) + 'px;width:2800px;height:2800px;background:repeating-conic-gradient(' + C.hl + ' 0deg 12deg,' + C.brand + ' 12deg 24deg)' }, comercial);

    var faixa = el('div', { style: 'position:absolute;left:0;right:0;top:34px;text-align:center' }, comercial);
    var noAr = el('div', { style: 'display:inline-flex;align-items:center;gap:22px;background:#000;color:#fff;padding:10px 36px 12px;' + FONT_CAP + 'font-size:46px;white-space:nowrap' }, faixa);
    var ponto = el('span', { style: 'display:inline-block;width:30px;height:30px;border-radius:50%;background:' + C.loss }, noAr);
    el('span', { text: p.radio || 'RÁDIO OFURRY' }, noAr);
    el('span', { text: p.fm || '177,0 FM', style: 'color:' + C.hl }, noAr);

    var titulo = el('div', { style: 'position:absolute;left:0;right:0;top:800px;text-align:center;white-space:nowrap;' + FONT_NUM + 'font-size:210px;line-height:1;color:#000;text-shadow:7px 7px 0 #fff;opacity:0', text: p.texto || 'DOIS PÃO DE QUEIJO' }, comercial);

    var selo = el('div', { style: 'position:absolute;left:1470px;top:170px;width:340px;height:340px;opacity:0' }, comercial);
    estrela(selo);
    el('div', { text: 'SÓ', style: 'position:absolute;left:0;right:0;top:78px;text-align:center;' + FONT_CAP + 'font-size:42px;color:#fff' }, selo);
    el('div', { text: p.preco || 'R$ 5', style: 'position:absolute;left:0;right:0;top:118px;text-align:center;white-space:nowrap;' + FONT_NUM + 'font-size:130px;line-height:1;color:#fff' }, selo);

    var paes = [
      { n: pao(box, p.src), x: 540, xFim: 760, y: 410, at: t0, rot: -7 },
      { n: pao(box, p.src), x: 985, xFim: 950, y: 395, at: t0 + 0.2, rot: 8 },
    ];

    return function (tl) {
      var T = t0 + tl;
      var fora = T >= saiAt;
      var Tq = Math.min(T, saiAt); // depois do saiAt tudo para: a piada perdeu a graca
      var cinza = fora ? 'grayscale(1) brightness(0.55) contrast(0.9)' : 'none';
      comercial.style.filter = cinza;
      raios.style.transform = 'rotate(' + ((Tq - t0) * 34).toFixed(2) + 'deg)';
      ponto.style.opacity = Math.sin((Tq - t0) * 18) > -0.3 ? '1' : '0.25';
      var pt = T >= textoAt ? prog(T, textoAt, 0.16, E.back) : 0;
      titulo.style.opacity = T >= textoAt ? Math.min(1, pt * 1.6).toFixed(3) : '0';
      titulo.style.transform = 'scale(' + (0.6 + 0.4 * pt).toFixed(3) + ')';
      var ps = T >= precoAt ? prog(T, precoAt, 0.18, E.back) : 0;
      selo.style.opacity = T >= precoAt ? '1' : '0';
      selo.style.transform = 'rotate(' + (-12 + Math.sin((Tq - t0) * 9) * 4).toFixed(2) + 'deg) scale(' + (ps * (1 + Math.sin((Tq - t0) * 16) * 0.04)).toFixed(3) + ')';

      paes.forEach(function (o, k) {
        var j = treme(Tq, k), x = o.x + j.x, y = o.y + j.y, r = o.rot + j.r, esc = 1;
        o.n.style.filter = cinza;
        o.n.style.opacity = T >= o.at ? '1' : '0';
        o.n.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + r.toFixed(2) + 'deg) scale(' + esc + ')';
      });
    };
  };

  // Volta da piada em outro momento: so a foto do pao de queijo, colada torta e parada POR CIMA da cena que ja esta
  // na tela, por pouco tempo, como quem jogou a imagem no slide. Sem fundo, titulo, preco ou texto
  // (Joao, 22/11/2026: "apenas foto dele e deu"; "estilo overlay, por cima do fundo, como piada por poucos segundos").
  OF.paoQueijo = function (root, p) {
    var box = el('div', { style: 'position:absolute;inset:0;overflow:hidden', 'data-layout-allow-overlap': '' }, root);
    var tam = p.tam || 480, x = (p.x !== undefined ? p.x : 0.5) * W - tam / 2, y = (p.y !== undefined ? p.y : 0.5) * H - tam / 2;
    el('img', { src: p.src || '', alt: '', style: 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + tam + 'px;height:' + tam + 'px;object-fit:contain;transform:rotate(' + (p.rot !== undefined ? p.rot : -7) + 'deg)' }, box);
    return function () {};
  };
})(typeof window !== 'undefined' ? window : globalThis);
