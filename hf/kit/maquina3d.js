/*
 * OFurry: cena 3D "maquina de imprimir dinheiro" (CSS 3D preserve-3d + SVG vetorial plano).
 * Carregado DEPOIS de hf/kit/ofurry-cenas.js; registra OF.maquina3d com os mesmos parametros de OF.maquina.
 *
 * Contrato HyperFrames:
 * - Funcao pura do tempo T = t0 + tl (sem estado acumulado, sem aleatoriedade nao-deterministica, sem timers).
 * - Pool fixo de notas e particulas, dentro de containers com data-layout-allow-overlap="".
 * - Visual plano OFurry: fundo preto, contornos brancos grossos, sombreado chapado por face (sem AI slop).
 */
(function (g) {
  var OF = g.OF;
  if (!OF) return;

  var W = 1920, H = 1080;
  var C = OF.C, E = OF.E, el = OF.el, svg = OF.svg;
  var prog = OF.prog, kf = OF.kf, brl = OF.brl;
  var FONT_CAP = OF.FONT_CAP, FONT_NUM = OF.FONT_NUM;
  var uid = 0;

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var c01 = function (x) { return clamp(x, 0, 1); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var rng = function (k) {
    var x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  /** Desenha caminho SVG de engrenagem industrial com dentes trapezoidais */
  function gearPath(cx, cy, r0, r1, teeth) {
    var d = '', step = (Math.PI * 2) / teeth;
    for (var k = 0; k < teeth; k++) {
      var a0 = k * step;
      var a1 = a0 + step * 0.14;
      var a2 = a0 + step * 0.42;
      var a3 = a0 + step * 0.56;
      var pts = [
        [cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0],
        [cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1],
        [cx + Math.cos(a2) * r1, cy + Math.sin(a2) * r1],
        [cx + Math.cos(a3) * r0, cy + Math.sin(a3) * r0],
      ];
      for (var j = 0; j < pts.length; j++) {
        d += (k === 0 && j === 0 ? 'M' : ' L') + pts[j][0].toFixed(1) + ' ' + pts[j][1].toFixed(1);
      }
    }
    return d + ' Z';
  }

  /** Arco circular SVG (0 deg = topo, sentido horario) */
  function arcPath(cx, cy, r, a0Deg, a1Deg) {
    var a0 = ((a0Deg - 90) * Math.PI) / 180;
    var a1 = ((a1Deg - 90) * Math.PI) / 180;
    var x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    var x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    var large = a1Deg - a0Deg > 180 ? 1 : 0;
    return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
  }

  /** Monta um prisma 3D real com 6 faces chapadas e contorno branco */
  function makeBox(parent, w, h, d, opts) {
    opts = opts || {};
    var bw = opts.border !== undefined ? opts.border : 6;
    var bc = opts.borderColor || C.text;
    var box = el('div', {
      style: 'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;' + (opts.style || ''),
    }, parent);

    function mkFace(fw, fh, tr, bg, extra) {
      return el('div', {
        style:
          'position:absolute;left:' + (-fw / 2).toFixed(1) + 'px;top:' + (-fh / 2).toFixed(1) + 'px;' +
          'width:' + fw + 'px;height:' + fh + 'px;box-sizing:border-box;' +
          'background:' + bg + ';border:' + bw + 'px solid ' + bc + ';' +
          'backface-visibility:hidden;transform-style:preserve-3d;' +
          'transform:' + tr + ';' + (extra || ''),
      }, box);
    }

    var faces = {
      box: box,
      front: mkFace(w, h, 'translateZ(' + (d / 2).toFixed(1) + 'px)', opts.front || '#1e1e1e'),
      back: mkFace(w, h, 'rotateY(180deg) translateZ(' + (d / 2).toFixed(1) + 'px)', opts.back || '#0a0a0a'),
      right: mkFace(d, h, 'rotateY(90deg) translateZ(' + (w / 2).toFixed(1) + 'px)', opts.right || '#0e0e0e'),
      left: mkFace(d, h, 'rotateY(-90deg) translateZ(' + (w / 2).toFixed(1) + 'px)', opts.left || '#141414'),
      top: mkFace(w, d, 'rotateX(90deg) translateZ(' + (h / 2).toFixed(1) + 'px)', opts.top || '#151515'),
      bottom: mkFace(w, d, 'rotateX(-90deg) translateZ(' + (h / 2).toFixed(1) + 'px)', opts.bottom || '#080808'),
    };
    return faces;
  }

  /** Cria uma engrenagem vetorial dentro de um SVG */
  function buildGearSVG(parent, cx, cy, r0, r1, teeth, fillCol, strokeCol) {
    var g1 = svg('g', {}, parent);
    svg('path', {
      d: gearPath(cx, cy, r0, r1, teeth),
      fill: fillCol,
      stroke: strokeCol,
      'stroke-width': 4,
      'stroke-linejoin': 'round',
    }, g1);
    svg('circle', { cx: cx, cy: cy, r: (r0 * 0.62).toFixed(1), fill: '#120d06', stroke: fillCol, 'stroke-width': 5 }, g1);
    for (var s = 0; s < 4; s++) {
      var a = (s * Math.PI) / 2;
      svg('line', {
        x1: (cx + Math.cos(a) * r0 * 0.22).toFixed(1),
        y1: (cy + Math.sin(a) * r0 * 0.22).toFixed(1),
        x2: (cx + Math.cos(a) * r0 * 0.64).toFixed(1),
        y2: (cy + Math.sin(a) * r0 * 0.64).toFixed(1),
        stroke: fillCol,
        'stroke-width': 8,
        'stroke-linecap': 'round',
      }, g1);
    }
    svg('circle', { cx: cx, cy: cy, r: (r0 * 0.24).toFixed(1), fill: fillCol, stroke: strokeCol, 'stroke-width': 3.5 }, g1);
    svg('circle', { cx: cx, cy: cy, r: 5, fill: '#0d0d0d' }, g1);
    return g1;
  }

  // ================================================================ MAQUINA 3D
  /*
   * p: {
   *   ligaAt,                    // tempo (s) em que a maquina liga (antes fica parada, lampada apagada, visor "- - -")
   *   ritmo: [{at, v, dur}],     // notas por segundo (interpolado com OF.kf)
   *   contador: [{at, v, dur}],  // valor no visor em reais (OF.brl)
   *   rotulo, rotuloAt, rotuloY, // legenda embaixo (rotuloY 0..1 opcional)
   *   escala: 1,                 // escala global da maquina
   *   x: 0.5                     // centro horizontal (0..1)
   * }
   */
  OF.maquina3d = function (root, p, t0, dur) {
    p = p || {};
    var id = 'ofm3d_' + (++uid);
    var sc = p.escala !== undefined ? p.escala : 1;
    var cx = (p.x !== undefined ? p.x : 0.5) * W;
    var cy = p.y !== undefined ? p.y * H : 505; // y (0-1) opcional: centro vertical da maquina
    var totalDur = dur && dur > 0 ? dur : 8;
    var hasLiga = p.ligaAt !== undefined && p.ligaAt !== null;
    var tLiga = hasLiga ? p.ligaAt : t0;

    // ------------------------------------------------------------ integracao deterministica do ritmo
    // Tabela imutavel pre-calculada a partir de p.ritmo: garante fase/nascimentos 100% puros em qualquer ordem de quadros.
    var DT = 1 / 60;
    var tTab0 = Math.min(t0, tLiga) - 0.5;
    var tTab1 = Math.max(t0 + totalDur, tLiga + 10) + 4;
    var nSteps = Math.max(2, Math.ceil((tTab1 - tTab0) / DT));
    var cum = new Float64Array(nSteps + 1);
    var ritmoAt = function (t) {
      if (t < tLiga) return 0;
      return Math.max(0, kf(p.ritmo, t, 'v', 2, 1.2));
    };
    var acc = 0;
    for (var si = 1; si <= nSteps; si++) {
      var ta = tTab0 + (si - 1) * DT;
      var tb = tTab0 + si * DT;
      if (tb <= tLiga) {
        cum[si] = 0;
      } else if (ta < tLiga) {
        var span = tb - tLiga;
        acc += 0.5 * (ritmoAt(tLiga) + ritmoAt(tb)) * span;
        cum[si] = acc;
      } else {
        acc += 0.5 * (ritmoAt(ta) + ritmoAt(tb)) * DT;
        cum[si] = acc;
      }
    }
    var vEnd = ritmoAt(tTab0 + nSteps * DT);

    function emittedAt(T) {
      if (T <= tLiga) return 0;
      var idx = (T - tTab0) / DT;
      if (idx <= 0) return 0;
      if (idx >= nSteps) return cum[nSteps] + Math.max(0, vEnd) * (T - (tTab0 + nSteps * DT));
      var i0 = Math.floor(idx);
      var f = idx - i0;
      return lerp(cum[i0], cum[i0 + 1], f);
    }

    function birthTime(thresh) {
      if (thresh <= 0) return tLiga;
      if (thresh >= cum[nSteps]) {
        return vEnd > 1e-4 ? tTab0 + nSteps * DT + (thresh - cum[nSteps]) / vEnd : tTab0 + nSteps * DT + 999;
      }
      var lo = 0, hi = nSteps;
      while (lo + 1 < hi) {
        var mid = (lo + hi) >> 1;
        if (cum[mid] <= thresh) lo = mid;
        else hi = mid;
      }
      var dv = cum[hi] - cum[lo];
      var f = dv > 1e-9 ? (thresh - cum[lo]) / dv : 0;
      return tTab0 + (lo + f) * DT;
    }

    // ------------------------------------------------------------ palco 3D
    var st = OF.stage(root, { ry: -28, rx: -12 });
    var wrap = st.cam.parentNode;
    wrap.style.perspective = '1600px';
    wrap.style.perspectiveOrigin = '50% 45%';
    st.cam.style.transformOrigin = cx.toFixed(1) + 'px ' + cy + 'px';

    // Ancora centrada na maquina
    var anchor = el('div', {
      style: 'position:absolute;left:' + cx.toFixed(1) + 'px;top:' + cy + 'px;width:0;height:0;transform-style:preserve-3d',
    }, st.cam);

    // Dimensoes do corpo principal
    var BW = 520, BH = 370, BD = 280;

    // ------------------------------------------------------------ halo no chao (plano horizontal 3D)
    var floorWrap = el('div', {
      style: 'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;transform:scale3d(' + sc + ',' + sc + ',' + sc + ')',
    }, anchor);
    var floorDisc = el('div', {
      style:
        'position:absolute;left:-320px;top:-190px;width:640px;height:380px;border-radius:50%;' +
        'border:3px dashed rgba(253,253,253,0.18);background:radial-gradient(ellipse at center,rgba(46,224,74,0.18) 0%,rgba(46,224,74,0) 68%);' +
        'transform:translateY(' + (BH / 2 + 34) + 'px) rotateX(90deg)',
    }, floorWrap);

    // ------------------------------------------------------------ rig principal da maquina
    var rig = el('div', {
      style: 'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d',
    }, anchor);

    // Pes 3D (2 trilhos sob o chassi)
    [-168, 168].forEach(function (fx) {
      var foot = makeBox(rig, 108, 30, 232, {
        border: 5,
        front: '#262626',
        right: '#111111',
        top: '#181818',
        style: 'transform:translate3d(' + fx + 'px,' + (BH / 2 + 15) + 'px,0px)',
      });
      el('div', { style: 'position:absolute;left:10px;right:10px;top:7px;height:6px;background:' + C.brand }, foot.front);
    });

    // Corpo principal (chassi)
    var chassis = makeBox(rig, BW, BH, BD, {
      border: 6,
      front: '#1e1e1e',
      top: '#151515',
      right: '#0e0e0e',
      left: '#141414',
      back: '#0a0a0a',
      bottom: '#080808',
    });

    // Detalhe plano no topo do chassi (tampa + faixa laranja da marca)
    var topSvg = svg('svg', {
      width: BW, height: BD, viewBox: '0 0 ' + BW + ' ' + BD,
      style: 'position:absolute;left:-6px;top:-6px;pointer-events:none',
    }, chassis.top);
    svg('rect', { x: 24, y: BD - 42, width: BW - 48, height: 14, rx: 4, fill: C.brand }, topSvg);
    svg('rect', { x: 28, y: 24, width: 220, height: 185, rx: 10, fill: '#111111', stroke: 'rgba(253,253,253,0.22)', 'stroke-width': 3 }, topSvg);

    // ------------------------------------------------------------ chamine 3D (topo-direita-fundo)
    var CHIM_X = 152, CHIM_Z = -44;
    makeBox(rig, 78, 92, 78, {
      border: 5,
      front: '#1c1c1c',
      right: '#101010',
      top: '#050505',
      style: 'transform:translate3d(' + CHIM_X + 'px,' + (-BH / 2 - 46) + 'px,' + CHIM_Z + 'px)',
    });
    makeBox(rig, 100, 24, 100, {
      border: 5,
      front: C.brand,
      right: '#c47400',
      left: '#d98200',
      top: '#050505',
      style: 'transform:translate3d(' + CHIM_X + 'px,' + (-BH / 2 - 104) + 'px,' + CHIM_Z + 'px)',
    });

    // ------------------------------------------------------------ pistao / prensa 3D (topo-esquerda)
    var PIST_X = -72, PIST_Z = 10;
    // Base fixa do pistao
    makeBox(rig, 184, 24, 142, {
      border: 5,
      front: '#262626',
      right: '#131313',
      top: '#1a1a1a',
      style: 'transform:translate3d(' + PIST_X + 'px,' + (-BH / 2 - 12) + 'px,' + PIST_Z + 'px)',
    });
    // Parte movel do pistao (desce batendo no ritmo)
    var pistonMove = el('div', {
      style: 'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d',
    }, rig);
    // Haste metalica
    makeBox(pistonMove, 50, 68, 50, {
      border: 5,
      front: '#3a3a3a',
      right: '#222222',
      top: '#2e2e2e',
      style: 'transform:translate3d(' + PIST_X + 'px,' + (-BH / 2 - 58) + 'px,' + PIST_Z + 'px)',
    });
    // Cabeca da prensa (laranja da marca)
    makeBox(pistonMove, 158, 34, 118, {
      border: 5,
      front: C.brand,
      right: '#c47400',
      left: '#db8300',
      top: '#ffad2e',
      bottom: '#9c5c00',
      style: 'transform:translate3d(' + PIST_X + 'px,' + (-BH / 2 - 108) + 'px,' + PIST_Z + 'px)',
    });

    // ------------------------------------------------------------ face lateral direita: engrenagens 3D + alavanca
    var sideMount = el('div', {
      style:
        'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;' +
        'transform:rotateY(90deg) translateZ(' + (BW / 2) + 'px)',
    }, rig);

    // Painel sutil na lateral direita
    var sidePanelSvg = svg('svg', {
      width: BD, height: BH, viewBox: '0 0 ' + BD + ' ' + BH,
      style: 'position:absolute;left:' + (-BD / 2) + 'px;top:' + (-BH / 2) + 'px;pointer-events:none;transform:translateZ(1px)',
    }, sideMount);
    svg('rect', { x: 20, y: 24, width: BD - 40, height: BH - 48, rx: 12, fill: 'none', stroke: 'rgba(253,253,253,0.18)', 'stroke-width': 3 }, sidePanelSvg);
    // Rebites da lateral
    [[34, 38], [BD - 34, 38], [34, BH - 38], [BD - 34, BH - 38]].forEach(function (pt) {
      svg('circle', { cx: pt[0], cy: pt[1], r: 5, fill: 'rgba(253,253,253,0.38)' }, sidePanelSvg);
    });

    // Engrenagens em 2 camadas Z para espessura 3D real na face lateral
    var gearLayers = [
      { z: 5, fill: '#b36600', stroke: '#d8d8d8' },
      { z: 15, fill: C.brand, stroke: C.text },
    ].map(function (ly) {
      var sv = svg('svg', {
        width: 300, height: 300, viewBox: '-150 -150 300 300',
        style: 'position:absolute;left:-150px;top:-150px;overflow:visible;pointer-events:none;transform:translateZ(' + ly.z + 'px)',
      }, sideMount);
      var gBig = buildGearSVG(sv, 32, 34, 56, 72, 12, ly.fill, ly.stroke);
      var gSmall = buildGearSVG(sv, -48, -36, 36, 50, 8, ly.fill, ly.stroke);
      return { big: gBig, small: gSmall };
    });

    // Alavanca lateral 3D que bombeia no ritmo (montada na frente-inferior da face direita)
    var leverPivot = el('div', {
      style:
        'position:absolute;left:-86px;top:108px;width:0;height:0;transform-style:preserve-3d;' +
        'transform:translateZ(22px)',
    }, sideMount);
    var leverSvg = svg('svg', {
      width: 150, height: 150, viewBox: '-85 -115 150 150',
      style: 'position:absolute;left:-85px;top:-115px;overflow:visible;pointer-events:none',
    }, leverPivot);
    // Eixo fixo
    svg('circle', { cx: 0, cy: 0, r: 17, fill: '#222', stroke: C.text, 'stroke-width': 5 }, leverSvg);
    var leverArm = svg('g', {}, leverSvg);
    svg('line', { x1: 0, y1: 0, x2: -32, y2: -74, stroke: C.text, 'stroke-width': 14, 'stroke-linecap': 'round' }, leverArm);
    svg('line', { x1: 0, y1: 0, x2: -32, y2: -74, stroke: '#222', 'stroke-width': 6, 'stroke-linecap': 'round' }, leverArm);
    svg('circle', { cx: -32, cy: -74, r: 17, fill: C.hl, stroke: C.text, 'stroke-width': 4.5 }, leverArm);
    svg('circle', { cx: 0, cy: 0, r: 6, fill: C.brand }, leverSvg);

    // ------------------------------------------------------------ face frontal: visor, lampada, medidor, rolo, fenda
    var frontSvg = svg('svg', {
      width: BW, height: BH, viewBox: '0 0 ' + BW + ' ' + BH,
      style: 'position:absolute;left:-6px;top:-6px;overflow:visible;pointer-events:none',
    }, chassis.front);

    // Defs (clipPath unico para o rolo giratorio)
    var defs = svg('defs', {}, frontSvg);
    var clip = svg('clipPath', { id: id + '_rclip' }, defs);
    svg('rect', { x: 204, y: 170, width: 282, height: 68, rx: 8 }, clip);

    // Rebites nos 4 cantos da frente
    [[18, 18], [BW - 18, 18], [18, BH - 18], [BW - 18, BH - 18]].forEach(function (pt) {
      svg('circle', { cx: pt[0], cy: pt[1], r: 5, fill: 'rgba(253,253,253,0.45)' }, frontSvg);
    });

    // Moldura do Visor
    svg('rect', { x: 28, y: 26, width: 364, height: 112, rx: 10, fill: '#050505', stroke: C.text, 'stroke-width': 5 }, frontSvg);
    var visorFrameGlow = svg('rect', { x: 35, y: 33, width: 350, height: 98, rx: 6, fill: 'none', stroke: C.gain, 'stroke-width': 2.5, opacity: 0 }, frontSvg);
    // Linhas sutis de tela no visor
    var visorScan = svg('g', { opacity: 0 }, frontSvg);
    for (var sl = 0; sl < 4; sl++) {
      svg('line', { x1: 38, y1: 48 + sl * 23, x2: 382, y2: 48 + sl * 23, stroke: C.gain, 'stroke-width': 1, opacity: 0.14 }, visorScan);
    }

    // Lampada indicadora (canto superior direito)
    var lampHalo = svg('circle', { cx: 448, cy: 70, r: 44, fill: C.gain, opacity: 0 }, frontSvg);
    var lampPulse = svg('circle', { cx: 448, cy: 70, r: 30, fill: 'none', stroke: C.gain, 'stroke-width': 5, opacity: 0 }, frontSvg);
    svg('circle', { cx: 448, cy: 70, r: 30, fill: '#111', stroke: C.text, 'stroke-width': 5 }, frontSvg);
    var lampBulb = svg('circle', { cx: 448, cy: 70, r: 22, fill: '#2c2c2c' }, frontSvg);
    svg('path', { d: 'M436 62 A13 13 0 0 1 452 54', fill: 'none', stroke: '#fdfdfd', 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: 0.7 }, frontSvg);
    var lampPill = svg('rect', { x: 418, y: 112, width: 60, height: 24, rx: 5, fill: '#101010', stroke: 'rgba(253,253,253,0.4)', 'stroke-width': 2.5 }, frontSvg);
    var lampTxt = svg('text', {
      x: 448, y: 129, 'text-anchor': 'middle',
      'font-family': 'Montserrat, sans-serif', 'font-weight': 800, 'font-size': 15, fill: C.whisper,
    }, frontSvg);
    lampTxt.textContent = 'OFF';

    // Medidor de pressao (canto inferior esquerdo)
    var GX = 104, GY = 252, GR = 66;
    svg('circle', { cx: GX, cy: GY, r: GR, fill: '#080808', stroke: C.text, 'stroke-width': 5 }, frontSvg);
    svg('path', { d: arcPath(GX, GY, GR - 14, -128, -22), fill: 'none', stroke: C.gain, 'stroke-width': 9, 'stroke-linecap': 'butt' }, frontSvg);
    svg('path', { d: arcPath(GX, GY, GR - 14, -18, 62), fill: 'none', stroke: C.brand, 'stroke-width': 9, 'stroke-linecap': 'butt' }, frontSvg);
    svg('path', { d: arcPath(GX, GY, GR - 14, 66, 128), fill: 'none', stroke: C.hl, 'stroke-width': 9, 'stroke-linecap': 'butt' }, frontSvg);
    for (var tk = 0; tk < 7; tk++) {
      var taDeg = -128 + (tk / 6) * 256;
      var taRad = ((taDeg - 90) * Math.PI) / 180;
      svg('line', {
        x1: (GX + Math.cos(taRad) * (GR - 22)).toFixed(1),
        y1: (GY + Math.sin(taRad) * (GR - 22)).toFixed(1),
        x2: (GX + Math.cos(taRad) * (GR - 8)).toFixed(1),
        y2: (GY + Math.sin(taRad) * (GR - 8)).toFixed(1),
        stroke: C.text, 'stroke-width': 2.5,
      }, frontSvg);
    }
    var gaugeNeedle = svg('g', {}, frontSvg);
    svg('polygon', { points: GX + ',' + (GY - 48) + ' ' + (GX - 5) + ',' + (GY + 8) + ' ' + (GX + 5) + ',' + (GY + 8), fill: C.brand, stroke: C.text, 'stroke-width': 1.5 }, gaugeNeedle);
    svg('circle', { cx: GX, cy: GY, r: 9, fill: C.text }, frontSvg);
    svg('circle', { cx: GX, cy: GY, r: 3.5, fill: '#111' }, frontSvg);

    // Janela do rolo / prensa giratorio
    var RX = 204, RY = 170, RW = 282, RH = 68;
    svg('rect', { x: RX, y: RY, width: RW, height: RH, rx: 8, fill: '#0b0b0b' }, frontSvg);
    var rollerClipG = svg('g', { 'clip-path': 'url(#' + id + '_rclip)' }, frontSvg);
    // Corpo do cilindro (sombreado chapado em 3 faixas horizontais)
    svg('rect', { x: RX, y: RY, width: RW, height: RH, fill: '#222222' }, rollerClipG);
    svg('rect', { x: RX, y: RY + 8, width: RW, height: 14, fill: '#363636' }, rollerClipG);
    svg('rect', { x: RX, y: RY + RH - 18, width: RW, height: 18, fill: '#101010' }, rollerClipG);
    // Nervuras laranjas que rolam continuamente
    var N_RIBS = 5;
    var rollerRibs = [];
    for (var ri = 0; ri < N_RIBS; ri++) {
      rollerRibs.push(svg('rect', {
        x: RX + 12, y: RY, width: RW - 24, height: 8, rx: 3, fill: C.brand,
      }, rollerClipG));
    }
    // Laterais do eixo do rolo
    svg('rect', { x: RX, y: RY, width: 12, height: RH, fill: '#141414' }, rollerClipG);
    svg('rect', { x: RX + RW - 12, y: RY, width: 12, height: RH, fill: '#141414' }, rollerClipG);
    // Moldura da janela do rolo por cima
    svg('rect', { x: RX, y: RY, width: RW, height: RH, rx: 8, fill: 'none', stroke: C.text, 'stroke-width': 5 }, frontSvg);

    // Fenda de saida das notas (parte inferior direita)
    var SX = 214, SY = 272, SW = 262, SH = 30;
    var slotGlow = svg('rect', { x: SX + 6, y: SY + 4, width: SW - 12, height: SH - 8, rx: 4, fill: C.gain, opacity: 0 }, frontSvg);
    svg('rect', { x: SX, y: SY, width: SW, height: SH, rx: 6, fill: '#000000', stroke: C.text, 'stroke-width': 5 }, frontSvg);
    svg('rect', { x: SX + 10, y: SY + 7, width: SW - 20, height: SH - 14, rx: 3, fill: '#030303' }, frontSvg);

    // Calha / bandeja 3D logo abaixo da fenda (saliente em +Z, inclinada para baixo)
    var SLOT_LOCAL_X = (SX + SW / 2) - BW / 2; // +85
    var SLOT_LOCAL_Y = (SY + SH / 2) - BH / 2; // +102
    makeBox(rig, SW + 8, 16, 56, {
      border: 4,
      front: C.brand,
      top: '#242424',
      right: '#121212',
      left: '#181818',
      bottom: '#0c0c0c',
      style: 'transform:translate3d(' + SLOT_LOCAL_X + 'px,' + (SLOT_LOCAL_Y + 22) + 'px,' + (BD / 2 + 22) + 'px) rotateX(-22deg)',
    });

    // Texto do visor em HTML (sobre a face frontal, dentro da moldura)
    var visor = el('div', {
      style:
        'position:absolute;left:22px;top:20px;width:364px;height:112px;' +
        'display:flex;align-items:center;justify-content:center;white-space:nowrap;' +
        FONT_NUM + 'font-size:84px;line-height:1;letter-spacing:0.02em;color:#444;' +
        'transform:translateZ(2px);backface-visibility:hidden',
      text: '- - -',
    }, chassis.front);

    // ------------------------------------------------------------ camada 3D de moedas/estrelas da chamine
    var chimneyLayer = el('div', {
      style:
        'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;' +
        'transform:scale3d(' + sc + ',' + sc + ',' + sc + ')',
      'data-layout-allow-overlap': '',
    }, anchor);

    var MAXC = 14;
    var puffs = [];
    for (var ci = 0; ci < MAXC; ci++) {
      var isStar = ci % 2 === 0;
      var pf = el('div', {
        style:
          'position:absolute;left:-26px;top:-26px;width:52px;height:52px;opacity:0;' +
          'display:flex;align-items:center;justify-content:center;pointer-events:none',
      }, chimneyLayer);
      var pSvg = svg('svg', { width: 52, height: 52, viewBox: '0 0 52 52' }, pf);
      if (isStar) {
        svg('polygon', {
          points: '26,4 32.2,18.2 47.6,19.6 35.8,29.6 39.4,44.8 26,36.6 12.6,44.8 16.2,29.6 4.4,19.6 19.8,18.2',
          fill: C.hl, stroke: C.text, 'stroke-width': 3.5, 'stroke-linejoin': 'round',
        }, pSvg);
      } else {
        svg('circle', { cx: 26, cy: 26, r: 20, fill: C.brand, stroke: C.text, 'stroke-width': 4 }, pSvg);
        svg('circle', { cx: 26, cy: 26, r: 13.5, fill: 'none', stroke: C.hl, 'stroke-width': 2.5 }, pSvg);
        var cTxt = svg('text', {
          x: 26, y: 33, 'text-anchor': 'middle',
          'font-family': 'Bebas Neue, Montserrat, sans-serif', 'font-size': 22, 'font-weight': 700, fill: '#111',
        }, pSvg);
        cTxt.textContent = '$';
      }
      puffs.push(pf);
    }

    // ------------------------------------------------------------ camada 3D de notas voando (pool fixo <= 30)
    var notesLayer = el('div', {
      style:
        'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;' +
        'transform:scale3d(' + sc + ',' + sc + ',' + sc + ')',
      'data-layout-allow-overlap': '',
    }, anchor);

    var MAXN = 28;
    var notes = [];
    for (var ni = 0; ni < MAXN; ni++) {
      var nb = el('div', {
        style:
          'position:absolute;left:-74px;top:-37px;width:148px;height:74px;opacity:0;' +
          'pointer-events:none;will-change:transform,opacity',
      }, notesLayer);
      var bSvg = svg('svg', { width: 148, height: 74, viewBox: '0 0 148 74' }, nb);
      svg('rect', { x: 3, y: 3, width: 142, height: 68, rx: 7, fill: C.gain, stroke: C.text, 'stroke-width': 4.5 }, bSvg);
      svg('rect', { x: 12, y: 11, width: 124, height: 52, rx: 4, fill: 'none', stroke: '#0b5c1c', 'stroke-width': 3 }, bSvg);
      svg('ellipse', { cx: 74, cy: 37, rx: 32, ry: 22, fill: '#22c43c', stroke: '#0b5c1c', 'stroke-width': 2.5 }, bSvg);
      svg('circle', { cx: 24, cy: 37, r: 5, fill: '#0b5c1c' }, bSvg);
      svg('circle', { cx: 124, cy: 37, r: 5, fill: '#0b5c1c' }, bSvg);
      var nTxt = svg('text', {
        x: 74, y: 50, 'text-anchor': 'middle',
        'font-family': 'Bebas Neue, Montserrat, sans-serif', 'font-size': 42, fill: '#04330e',
      }, bSvg);
      nTxt.textContent = 'R$';
      notes.push(nb);
    }

    // ------------------------------------------------------------ rotulo embaixo (sempre legivel, fora do 3D)
    var rotTop = p.rotuloY !== undefined ? p.rotuloY * H : Math.min(940, Math.round(cy + 375 * sc));
    var label = el('div', {
      style:
        'position:absolute;left:0;right:0;top:' + rotTop + 'px;text-align:center;z-index:20;' +
        FONT_CAP + 'font-size:56px;color:' + C.text + ';opacity:0;' +
        'text-shadow:0 4px 18px #000,0 0 36px #000',
      text: p.rotulo || '',
    }, root);

    // ------------------------------------------------------------ funcao pura de renderizacao
    function introOffsetY(t) {
      var pr = prog(t, t0, 0.52, E.back);
      return (1 - pr) * 230;
    }

    return function (tl) {
      var T = t0 + tl;
      var u = c01((T - t0) / Math.max(1, totalDur));

      // 1. Entrada com mola (~0.52s) e opacidade no wrapper externo (nao achata preserve-3d)
      var pin = prog(T, t0, 0.52, E.back);
      var fadeIn = c01((T - t0 + 1 / 30) / 0.16);
      wrap.style.opacity = fadeIn.toFixed(3);

      // 2. Camera 3D orbitando devagar (-30 deg -> -15 deg em Y, leve inclinacao X)
      var camRy = -30 + 15 * E.io(u) + Math.sin((T - t0) * 0.65) * 1.1;
      var camRx = -13 + 3.5 * u + Math.cos((T - t0) * 0.5) * 0.7;
      var camScale = 1 + 0.04 * u;
      st.cam.style.transform =
        'rotateX(' + camRx.toFixed(3) + 'deg) rotateY(' + camRy.toFixed(3) + 'deg) scale(' + camScale.toFixed(4) + ')';

      // 3. Estado ligado/desligado, ritmo e fase integrada
      var on = hasLiga ? T >= tLiga : true;
      var v = on ? ritmoAt(T) : 0;
      var emitted = on ? emittedAt(T) : 0;

      // 4. Tranco ao ligar (3-4 quadros de impacto + amortecimento rapido)
      var kx = 0, ky = 0, ksx = 1, ksy = 1;
      var sinceLiga = on ? T - tLiga : -1;
      if (on && sinceLiga >= 0 && sinceLiga < 0.24) {
        var kenv = Math.exp(-sinceLiga * 16) * (1 - c01(sinceLiga / 0.24));
        kx = Math.sin(sinceLiga * 150) * 13 * kenv;
        ky = -Math.abs(Math.cos(sinceLiga * 100)) * 11 * kenv;
        ksx = 1 + 0.085 * Math.sin(sinceLiga * 64) * kenv;
        ksy = 1 - 0.075 * Math.sin(sinceLiga * 64) * kenv;
      }

      // 5. Batida ritmica por nota (pulinho leve da maquina + pistao + alavanca)
      var BILL_OFFSET = 0.05;
      var lastK = on && emitted >= BILL_OFFSET ? Math.floor(emitted - BILL_OFFSET) : -1;
      var timeSinceBill = lastK >= 0 ? Math.max(0, T - birthTime(lastK + BILL_OFFSET)) : 99;
      var hopAmp = Math.min(1, 3.2 / Math.max(1.2, v));
      var beatEnv = timeSinceBill < 0.16 ? Math.sin((timeSinceBill / 0.16) * Math.PI) : 0;
      var hopY = on ? -beatEnv * 10 * hopAmp : 0;
      var hopSx = on ? 1 + beatEnv * 0.022 * hopAmp : 1;
      var hopSy = on ? 1 - beatEnv * 0.022 * hopAmp : 1;

      // Vibracao sutil do motor rodando
      var vib = on ? Math.min(1, v / 4) : 0;
      var vibX = Math.sin(T * 54) * 1.4 * vib;
      var vibY = Math.cos(T * 47) * 1.0 * vib;

      // Aplica transform no rig principal
      var introY = (1 - pin) * 230;
      var introS = 0.52 + 0.48 * pin;
      var introSpin = (1 - pin) * -18;
      rig.style.transform =
        'translate3d(' + (kx + vibX).toFixed(2) + 'px,' + (introY + ky + hopY + vibY).toFixed(2) + 'px,0px) ' +
        'rotateY(' + introSpin.toFixed(2) + 'deg) ' +
        'scale3d(' + (sc * introS * ksx * hopSx).toFixed(4) + ',' + (sc * introS * ksy * hopSy).toFixed(4) + ',' + (sc * introS).toFixed(4) + ')';

      // Halo no chao reage ao ligar e ao ritmo
      floorDisc.style.opacity = (0.35 + (on ? 0.45 + beatEnv * 0.2 : 0)).toFixed(3);
      floorDisc.style.borderColor = on ? 'rgba(46,224,74,0.38)' : 'rgba(253,253,253,0.16)';

      // 6. Pistao no topo (bate para baixo a cada nota) e alavanca lateral
      var pistonDown = on ? (timeSinceBill < 0.18 ? Math.sin((timeSinceBill / 0.18) * Math.PI) * 34 : 0) : 0;
      pistonMove.style.transform = 'translateY(' + pistonDown.toFixed(2) + 'px)';
      var leverDeg = on ? -10 - beatEnv * 38 - (0.5 + 0.5 * Math.sin(emitted * Math.PI * 2)) * 8 : -6;
      leverArm.setAttribute('transform', 'rotate(' + leverDeg.toFixed(2) + ' 0 0)');

      // 7. Engrenagens laterais em 3D (relacao exata 12:8 = -1.5x)
      var bigAng = emitted * 72;
      var smallAng = -bigAng * 1.5 + 22.5;
      for (var gl = 0; gl < gearLayers.length; gl++) {
        gearLayers[gl].big.setAttribute('transform', 'rotate(' + bigAng.toFixed(2) + ' 32 34)');
        gearLayers[gl].small.setAttribute('transform', 'rotate(' + smallAng.toFixed(2) + ' -48 -36)');
      }

      // 8. Rolo/prensa giratorio na frente
      var rollSpan = RH + 16;
      var rollStep = rollSpan / N_RIBS;
      for (var ri = 0; ri < N_RIBS; ri++) {
        var ryPos = RY - 8 + ((emitted * 46 + ri * rollStep) % rollSpan);
        rollerRibs[ri].setAttribute('y', ryPos.toFixed(1));
      }

      // 9. Medidor de pressao (ponteiro sobe com o ritmo)
      var targetAng = on ? -112 + clamp(v / 9, 0, 1) * 236 + Math.sin(T * 42) * 3.2 * Math.min(1, v / 2) : -128;
      gaugeNeedle.setAttribute('transform', 'rotate(' + clamp(targetAng, -128, 128).toFixed(2) + ' ' + GX + ' ' + GY + ')');

      // 10. Lampada e brilho da fenda
      lampBulb.setAttribute('fill', on ? C.gain : '#2c2c2c');
      lampHalo.setAttribute('opacity', on ? (0.28 + 0.08 * Math.sin(T * 10)).toFixed(3) : '0');
      lampPill.setAttribute('stroke', on ? C.gain : 'rgba(253,253,253,0.35)');
      lampTxt.setAttribute('fill', on ? C.gain : C.whisper);
      if (lampTxt.textContent !== (on ? 'ON' : 'OFF')) lampTxt.textContent = on ? 'ON' : 'OFF';
      if (on && sinceLiga >= 0 && sinceLiga < 0.36) {
        var lp = sinceLiga / 0.36;
        lampPulse.setAttribute('r', (30 + lp * 34).toFixed(1));
        lampPulse.setAttribute('opacity', (1 - lp).toFixed(3));
      } else {
        lampPulse.setAttribute('r', '30');
        lampPulse.setAttribute('opacity', '0');
      }
      slotGlow.setAttribute('opacity', on ? (0.35 + beatEnv * 0.45).toFixed(3) : '0');

      // 11. Visor numerico (OF.brl)
      var cont = kf(p.contador, T, 'v', 0, 1.0);
      var txt = on ? brl(Math.round(cont)) : '- - -';
      if (visor.textContent !== txt) visor.textContent = txt;
      visor.style.fontSize = (txt.length > 11 ? 60 : txt.length > 9 ? 70 : 84) + 'px';
      visor.style.color = on ? C.gain : '#444444';
      visor.style.textShadow = on ? '0 0 18px rgba(46,224,74,0.75)' : 'none';
      visorFrameGlow.setAttribute('opacity', on ? '0.45' : '0');
      visorScan.setAttribute('opacity', on ? '1' : '0');

      // 12. Moedas e estrelas saindo da chamine 3D (slot estavel kc % MAXC preserva estrela/moeda por particula)
      var C_RATE = 0.65, C_OFF = 0.2, C_LIFE = 1.65;
      var emittedC = emitted * C_RATE;
      var lastC = on && emittedC >= C_OFF ? Math.floor(emittedC - C_OFF) : -1;
      for (var ci0 = 0; ci0 < MAXC; ci0++) { puffs[ci0].style.opacity = '0'; puffs[ci0].style.transform = 'none'; }
      if (on && lastC >= 0) {
        for (var ci = 0; ci < MAXC; ci++) {
          var kc = lastC - ci;
          if (kc < 0) break;
          var tBirthC = birthTime((kc + C_OFF) / C_RATE);
          var ageC = T - tBirthC;
          if (ageC < 0 || ageC > C_LIFE) continue;
          var pf = puffs[kc % MAXC];
          var uc = ageC / C_LIFE;
          var r1 = rng(kc * 13 + 3), r2 = rng(kc * 13 + 29), r3 = rng(kc * 13 + 71);
          var cxP = CHIM_X + (r1 - 0.5) * 28 + (r2 - 0.42) * 190 * uc;
          var cyP = -BH / 2 - 110 + introOffsetY(tBirthC) - 270 * E.out3(uc);
          var czP = CHIM_Z + (r3 - 0.35) * 140 * uc;
          var cScale = (0.35 + 0.75 * E.back(c01(ageC / 0.22))) * (1 - 0.25 * uc);
          var cOp = ageC < 0.08 ? ageC / 0.08 : uc > 0.7 ? (1 - uc) / 0.3 : 1;
          pf.style.opacity = c01(cOp).toFixed(3);
          pf.style.transform =
            'translate3d(' + cxP.toFixed(1) + 'px,' + cyP.toFixed(1) + 'px,' + czP.toFixed(1) + 'px) ' +
            'rotateY(' + ((r1 - 0.5) * 520 * uc).toFixed(1) + 'deg) ' +
            'rotateZ(' + ((r2 - 0.5) * 320 * uc).toFixed(1) + 'deg) ' +
            'scale(' + cScale.toFixed(3) + ')';
        }
      }

      // 13. Notas voando em 3D para fora da fenda em direcao a camera (sem cobrir visor nem rotulo)
      var LIFE = 2.05;
      for (var ni0 = 0; ni0 < MAXN; ni0++) { notes[ni0].style.opacity = '0'; notes[ni0].style.transform = 'none'; }
      if (on && lastK >= 0) {
        for (var ni = 0; ni < MAXN; ni++) {
          var k = lastK - ni;
          if (k < 0) break;
          var tBirth = birthTime(k + BILL_OFFSET);
          var age = T - tBirth;
          if (age < 0 || age > LIFE) continue;
          var nb = notes[k % MAXN];
          var rA = rng(k * 7 + 1), rB = rng(k * 7 + 19), rC = rng(k * 7 + 53), rD = rng(k * 7 + 97);

          // Fase de saida pela calha (0..0.14s) -> voo livre em 3D (+Z em direcao a camera)
          var eject = c01(age / 0.14);
          var fly = Math.max(0, age - 0.1);
          var spawnY = SLOT_LOCAL_Y + introOffsetY(tBirth);

          // Espalha para os lados e suavemente para baixo (nunca sobe sobre o visor)
          var spreadX = (rA - 0.44) * 620;
          var flutter = Math.sin(fly * (7 + rB * 5) + rC * 6.28) * 18 * Math.min(1, fly * 2.5);
          var bx = SLOT_LOCAL_X + (rD - 0.5) * 26 * eject + spreadX * fly + flutter;
          var by = spawnY + 18 * eject + (22 + rB * 52) * fly + 58 * fly * fly;
          var bz = (BD / 2 - 6) + 92 * eject + (280 + rC * 130) * fly;

          // Giro 3D de papel voando
          var rotX = -22 * eject + (rB - 0.5) * 280 * fly;
          var rotY = (rA - 0.5) * 340 * fly;
          var rotZ = (rD - 0.5) * 260 * fly;
          var bScale = 0.72 + 0.34 * E.out3(c01(age / 0.35));

          var bOp = age < 0.05 ? age / 0.05 : age > LIFE - 0.45 ? (LIFE - age) / 0.45 : 1;
          nb.style.opacity = c01(bOp).toFixed(3);
          nb.style.transform =
            'translate3d(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px,' + bz.toFixed(1) + 'px) ' +
            'rotateX(' + rotX.toFixed(1) + 'deg) ' +
            'rotateY(' + rotY.toFixed(1) + 'deg) ' +
            'rotateZ(' + rotZ.toFixed(1) + 'deg) ' +
            'scale(' + bScale.toFixed(3) + ')';
        }
      }

      // 14. Rotulo inferior
      if (p.rotulo) {
        OF.popText(label, T, p.rotuloAt !== undefined ? p.rotuloAt : t0 + 0.3, undefined, 'rise');
      } else {
        label.style.opacity = '0';
      }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
