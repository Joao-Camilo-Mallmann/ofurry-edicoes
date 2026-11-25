/*
 * OFurry: cena 3D "pilha de moedas" (CSS 3D preserve-3d + SVG vetorial plano).
 * Carregado DEPOIS de hf/kit/ofurry-cenas.js; registra OF.moedas3d.
 *
 * Contrato HyperFrames:
 * - Funcao pura do tempo T = t0 + tl (sem estado acumulado, sem aleatoriedade nao-deterministica, sem timers).
 * - Pool fixo de moedas (maximo 40 por pilha), dentro de containers com data-layout-allow-overlap="".
 * - Tela 1920x1080 sem fundo pintado; visual ilustracao vetorial limpa com moedas cilindricas 3D reais.
 */
(function (g) {
  var OF = g.OF;
  if (!OF) return;

  var W = 1920, H = 1080;
  var C = OF.C, E = OF.E, el = OF.el, svg = OF.svg;
  var prog = OF.prog, kf = OF.kf, brl = OF.brl;
  var FONT_CAP = OF.FONT_CAP, FONT_NUM = OF.FONT_NUM;

  var MAX_COINS = 40;
  var N_SIDES = 16;

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var c01 = function (x) { return clamp(x, 0, 1); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var rng = function (k) {
    var x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  /** Paleta vetorial plana por cor semantica ('hl' | 'text' | 'gain') */
  function coinTheme(corKey) {
    if (corKey === 'gain') {
      return {
        ink: '#0d2611',
        rimShades: ['#4dff68', '#d5e03a', '#b5c221', '#7d9414', '#4a610c'],
        groove: 'rgba(13, 38, 17, 0.44)',
        rimHighlight: C.gain,
        capOuter: '#d8e33b',
        capInner: '#c4cf2b',
        capRing: C.gain,
        capBevel: '#6d8212',
        shine: '#80ff95',
        shineOp: 0.56,
        rsMain: '#124218',
        rsEmboss: '#b2ffbd',
        bottomFill: '#4a610c',
        accent: C.gain,
        haloBg: 'radial-gradient(ellipse at center,rgba(46,224,74,0.28) 0%,rgba(46,224,74,0) 68%)',
        haloBorder: 'rgba(46,224,74,0.44)',
        flashColor: '#9effac',
        flashStroke: C.gain,
        labelColor: C.gain,
      };
    }
    if (corKey === 'text') {
      return {
        ink: '#241504',
        rimShades: ['#fff6c4', '#f7c948', '#de9b18', '#ad6c08', '#754403'],
        groove: 'rgba(36, 21, 4, 0.42)',
        rimHighlight: '#fff4bd',
        capOuter: '#f7c948',
        capInner: '#e6a71e',
        capRing: '#fff3ba',
        capBevel: '#a86706',
        shine: '#fff5c4',
        shineOp: 0.68,
        rsMain: '#5e3400',
        rsEmboss: '#fff7d6',
        bottomFill: '#754403',
        accent: C.text,
        haloBg: 'radial-gradient(ellipse at center,rgba(253,253,253,0.16) 0%,rgba(253,253,253,0) 68%)',
        haloBorder: 'rgba(253,253,253,0.28)',
        flashColor: '#fff9d6',
        flashStroke: C.text,
        labelColor: C.text,
      };
    }
    var customAccent = corKey && C[corKey] ? C[corKey] : (corKey && corKey[0] === '#' ? corKey : C.hl);
    return {
      ink: '#241404',
      rimShades: ['#fff194', '#ffd230', '#eba00e', '#bd7205', '#824602'],
      groove: 'rgba(36, 20, 4, 0.44)',
      rimHighlight: '#fff194',
      capOuter: '#ffd230',
      capInner: '#f5b414',
      capRing: '#fff4a8',
      capBevel: '#b86e04',
      shine: '#ffec85',
      shineOp: 0.72,
      rsMain: '#693900',
      rsEmboss: '#fff6ba',
      bottomFill: '#824602',
      accent: customAccent,
      haloBg: 'radial-gradient(ellipse at center,rgba(244,232,18,0.22) 0%,rgba(244,232,18,0) 68%)',
      haloBorder: 'rgba(244,232,18,0.34)',
      flashColor: '#fff8bf',
      flashStroke: C.hl,
      labelColor: customAccent,
    };
  }

  /** Seleciona tom chapado da faceta lateral conforme direcao da luz (-32 deg) */
  function facetShade(aDeg, theme) {
    var dot = Math.cos(((aDeg + 32) * Math.PI) / 180);
    if (dot > 0.88) return theme.rimShades[0];
    if (dot > 0.52) return theme.rimShades[1];
    if (dot > 0.08) return theme.rimShades[2];
    if (dot > -0.38) return theme.rimShades[3];
    return theme.rimShades[4];
  }

  /** Constroi o SVG da tampa superior da moeda com "R$" gravado */
  function buildCapSVG(parent, diam, theme, capAngleDeg) {
    var s = svg('svg', {
      width: diam,
      height: diam,
      viewBox: '-110 -110 220 220',
      style: 'position:absolute;left:0;top:0;display:block;pointer-events:none;transform:rotate(' + capAngleDeg.toFixed(1) + 'deg)',
    }, parent);

    // Disco externo + contorno escuro fino
    svg('circle', {
      cx: 0, cy: 0, r: 106,
      fill: theme.capOuter,
      stroke: theme.ink,
      'stroke-width': 5.5,
    }, s);

    // Anel elevado interno (no ganho, brilho verde OF.C.gain na borda)
    svg('circle', {
      cx: 0, cy: 0, r: 91,
      fill: theme.capInner,
      stroke: theme.capRing,
      'stroke-width': 6,
    }, s);

    // Friso escuro interno (baixo relevo)
    svg('circle', {
      cx: 0, cy: 0, r: 84,
      fill: 'none',
      stroke: theme.capBevel,
      'stroke-width': 3,
    }, s);

    // Duas faixas diagonais chapadas de brilho vetorial (pre-recortadas dentro do raio 81)
    svg('polygon', {
      points: '-68,-34 -34,-68 58,24 24,58',
      fill: theme.shine,
      opacity: theme.shineOp,
    }, s);
    svg('polygon', {
      points: '-16,-78 6,-78 78,-6 78,16',
      fill: theme.shine,
      opacity: (theme.shineOp * 0.7).toFixed(2),
    }, s);

    // 8 pontos decorativos discretos ao redor da borda gravada
    for (var d = 0; d < 8; d++) {
      var a = (d * Math.PI) / 4;
      svg('circle', {
        cx: (Math.cos(a) * 72).toFixed(1),
        cy: (Math.sin(a) * 72).toFixed(1),
        r: 3.3,
        fill: theme.capBevel,
      }, s);
    }

    // "R$" gravado em relevo limpo (sombra clara + corpo escuro)
    var rsHi = svg('text', {
      x: 3, y: 31,
      'text-anchor': 'middle',
      'font-family': 'Bebas Neue, Montserrat, sans-serif',
      'font-weight': 700,
      'font-size': 92,
      'letter-spacing': '0.02em',
      fill: theme.rsEmboss,
      opacity: 0.85,
    }, s);
    rsHi.textContent = 'R$';

    var rs = svg('text', {
      x: 0, y: 28,
      'text-anchor': 'middle',
      'font-family': 'Bebas Neue, Montserrat, sans-serif',
      'font-weight': 700,
      'font-size': 92,
      'letter-spacing': '0.02em',
      fill: theme.rsMain,
      stroke: theme.ink,
      'stroke-width': 2.2,
      'paint-order': 'stroke',
    }, s);
    rs.textContent = 'R$';

    return s;
  }

  /** Monta UMA moeda cilindrica 3D real (tampa superior "R$", tampa inferior, 16 facetas serrilhadas) */
  function makeCoin3D(parent, radius, thick, theme, capAngleDeg, isGain) {
    var diam = radius * 2;
    var rCirc = radius - 0.6;
    var rAp = rCirc * Math.cos(Math.PI / N_SIDES);
    var fw = 2 * rCirc * Math.sin(Math.PI / N_SIDES) + 1.8;
    var halfH = thick / 2;

    var coin = el('div', {
      style:
        'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;' +
        'display:none;pointer-events:none;will-change:transform',
    }, parent);

    // Facetas da borda serrilhada
    for (var k = 0; k < N_SIDES; k++) {
      var aDeg = (k * 360) / N_SIDES;
      var shade = facetShade(aDeg, theme);
      var isLitEdge = isGain && Math.cos(((aDeg + 32) * Math.PI) / 180) > 0.65;
      var topBorder = isLitEdge ? theme.rimHighlight : theme.ink;
      el('div', {
        style:
          'position:absolute;left:' + (-fw / 2).toFixed(2) + 'px;top:' + (-halfH).toFixed(2) + 'px;' +
          'width:' + fw.toFixed(2) + 'px;height:' + thick.toFixed(2) + 'px;box-sizing:border-box;' +
          'background-color:' + shade + ';' +
          'background-image:repeating-linear-gradient(90deg,transparent 0px,transparent 5px,' + theme.groove + ' 5px,' + theme.groove + ' 7.5px);' +
          'border-top:2px solid ' + topBorder + ';border-bottom:2px solid ' + theme.ink + ';' +
          'backface-visibility:hidden;' +
          'transform:rotateY(' + aDeg.toFixed(2) + 'deg) translateZ(' + rAp.toFixed(2) + 'px)',
      }, coin);
    }

    // Tampa inferior fechada (evita buraco se uma moeda inclinar na queda)
    el('div', {
      style:
        'position:absolute;left:' + (-radius).toFixed(1) + 'px;top:' + (-radius).toFixed(1) + 'px;' +
        'width:' + diam + 'px;height:' + diam + 'px;border-radius:50%;box-sizing:border-box;' +
        'background:' + theme.bottomFill + ';border:3px solid ' + theme.ink + ';' +
        'backface-visibility:hidden;' +
        'transform:rotateX(-90deg) translateZ(' + (halfH + 0.2).toFixed(2) + 'px)',
    }, coin);

    // Tampa superior com SVG "R$"
    var topCap = el('div', {
      style:
        'position:absolute;left:' + (-radius).toFixed(1) + 'px;top:' + (-radius).toFixed(1) + 'px;' +
        'width:' + diam + 'px;height:' + diam + 'px;border-radius:50%;' +
        'backface-visibility:hidden;' +
        'transform:rotateX(90deg) translateZ(' + (halfH + 0.45).toFixed(2) + 'px)',
    }, coin);
    buildCapSVG(topCap, diam, theme, capAngleDeg);

    return coin;
  }

  /** Estrela de brilho vetorial de 4 pontas (flash da ultima moeda) */
  function makeSparkle(parent, size, fillCol, strokeCol) {
    var wrap = el('div', {
      style:
        'position:absolute;left:' + (-size / 2) + 'px;top:' + (-size / 2) + 'px;' +
        'width:' + size + 'px;height:' + size + 'px;opacity:0;pointer-events:none',
    }, parent);
    var s = svg('svg', { width: size, height: size, viewBox: '-50 -50 100 100' }, wrap);
    svg('path', {
      d: 'M0,-46 C4,-11 11,-4 46,0 C11,4 4,11 0,46 C-4,11 -11,4 -46,0 C-11,-4 -4,-11 0,-46 Z',
      fill: fillCol,
      stroke: strokeCol,
      'stroke-width': 3.5,
      'stroke-linejoin': 'round',
    }, s);
    svg('circle', { cx: 0, cy: 0, r: 7, fill: '#ffffff' }, s);
    return wrap;
  }

  /** Avalia valor (numero, string ou keyframes [{at, v, dur}] com OF.kf + OF.brl) */
  function normalizeValorKeys(list) {
    if (!Array.isArray(list) || !list.length) return null;
    if (list.length === 1 && list[0].dur !== undefined && list[0].dur > 0) {
      return [{ at: list[0].at - 0.001, v: 0 }, list[0]];
    }
    return list;
  }

  function formatValor(spec, normKeys, T) {
    if (normKeys) {
      var v = kf(normKeys, T, 'v', 0, 1.0);
      return brl(Math.round(v), { mil: true });
    }
    if (typeof spec === 'number') return brl(Math.round(spec), { mil: true });
    if (typeof spec === 'string') return spec;
    return '';
  }

  // ================================================================ MOEDAS 3D
  /*
   * p: {
   *   pilhas: [{
   *     at,                         // inicio do empilhamento (s; padrao t0)
   *     ate,                        // quantas moedas no fim (max 40; padrao 20)
   *     dur,                        // duracao do empilhamento (s)
   *     rotulo,                     // texto embaixo (ex. 'DO SEU BOLSO')
   *     cor: 'text'|'gain'|'hl',    // cor semantica ('gain' = tom esverdeado + brilho verde na borda)
   *     valor                       // opcional: contador proprio da pilha (numero, string ou [{at,v,dur}])
   *   }],
   *   valor: [{ at, v, dur }],      // contador principal em cima da pilha (OF.kf + OF.brl com { mil: true })
   *   titulo,                       // titulo opcional no topo
   *   x: 0.5                        // centro horizontal 0-1 (padrao 0.5)
   * }
   */
  OF.moedas3d = function (root, p, t0, dur) {
    p = p || {};
    var totalDur = dur && dur > 0 ? dur : 6;
    var sc = p.escala !== undefined ? p.escala : 1;
    var cx = (p.x !== undefined ? p.x : 0.5) * W;
    var baseY = p.y !== undefined ? p.y * H : 835;

    var rawPilhas = Array.isArray(p.pilhas) && p.pilhas.length
      ? p.pilhas
      : [{ at: t0, ate: 20, dur: Math.min(2.4, totalDur * 0.6), rotulo: '', cor: 'hl' }];
    var nP = rawPilhas.length;

    // Dimensoes coerentes entre todas as pilhas (proporcao real de altura)
    var maxAte = 1;
    for (var m = 0; m < nP; m++) {
      var cCount = clamp(Math.round(rawPilhas[m].ate !== undefined ? rawPilhas[m].ate : 20), 0, MAX_COINS);
      if (cCount > maxAte) maxAte = cCount;
    }
    var coinR = nP === 1 ? 122 : nP === 2 ? 110 : Math.max(76, Math.round(112 - (nP - 2) * 14));
    var coinH = clamp(Math.round(500 / Math.max(20, maxAte)), 12, 20);
    var spacing = nP === 1 ? 0 : nP === 2 ? 600 : Math.min(480, Math.round(1120 / (nP - 1)));

    // ------------------------------------------------------------ palco 3D
    var st = OF.stage(root, { ry: -25, rx: -12 });
    var wrap = st.cam.parentNode;
    wrap.style.perspective = '1600px';
    wrap.style.perspectiveOrigin = ((cx / W) * 100).toFixed(1) + '% 34%';
    var pivotY = Math.round(baseY - Math.min(260, (maxAte * coinH) * 0.5));
    st.cam.style.transformOrigin = cx.toFixed(1) + 'px ' + pivotY + 'px';

    // Ancora 3D no chao central
    var sceneAnchor = el('div', {
      style:
        'position:absolute;left:' + cx.toFixed(1) + 'px;top:' + baseY.toFixed(1) + 'px;' +
        'width:0;height:0;transform-style:preserve-3d;' +
        'transform:scale3d(' + sc + ',' + sc + ',' + sc + ')',
      'data-layout-allow-overlap': '',
    }, st.cam);

    // ------------------------------------------------------------ constroi cada pilha (pool fixo)
    var stacks = [];
    for (var pi = 0; pi < nP; pi++) {
      var pl = rawPilhas[pi] || {};
      var corKey = pl.cor || (nP === 2 && pi === 1 ? 'gain' : 'hl');
      var theme = coinTheme(corKey);
      var isGain = corKey === 'gain';
      var count = clamp(Math.round(pl.ate !== undefined ? pl.ate : 20), 0, MAX_COINS);
      var offsetX = nP === 1 ? 0 : (pi - (nP - 1) / 2) * spacing;
      var plAt = pl.at !== undefined ? pl.at : t0;
      var stackDur = pl.dur !== undefined ? Math.max(0.2, pl.dur) : Math.max(0.8, Math.min(2.6, totalDur * 0.58));
      var fallDur = Math.min(0.24, Math.max(0.13, stackDur * 0.42));
      var bounceDur = 0.21;

      var tLand0 = plAt + fallDur;
      var tLandLast = Math.max(tLand0, plAt + stackDur);

      var stackRoot = el('div', {
        style:
          'position:absolute;left:' + offsetX.toFixed(1) + 'px;top:0;width:0;height:0;' +
          'transform-style:preserve-3d',
        'data-layout-allow-overlap': '',
      }, sceneAnchor);

      // Halo no plano do chao (sem pintar o fundo da cena)
      var haloR = Math.round(coinR * 1.48);
      var floorDisc = el('div', {
        style:
          'position:absolute;left:' + (-haloR) + 'px;top:' + (-haloR) + 'px;' +
          'width:' + (haloR * 2) + 'px;height:' + (haloR * 2) + 'px;border-radius:50%;' +
          'border:3px dashed ' + theme.haloBorder + ';background:' + theme.haloBg + ';' +
          'transform:translateY(3px) rotateX(90deg);pointer-events:none',
      }, stackRoot);

      // Rig da coluna de moedas (reage com leve recuo elastico ao impacto)
      var colRig = el('div', {
        style:
          'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;' +
          'transform-origin:0 0',
        'data-layout-allow-overlap': '', 'data-layout-ignore': '', // moedas sao decoracao: o "R$" gravado pode ficar atras da moeda de cima
      }, stackRoot);

      // Pool fixo de moedas desta pilha
      var coins = [];
      for (var ci = 0; ci < count; ci++) {
        var seed = (pi + 1) * 997 + ci * 31;
        var capAng = (rng(seed + 1) - 0.5) * 28;
        var jitterScale = ci === 0 ? 0.25 : 1;
        var jx = (rng(seed + 2) - 0.5) * 9.5 * jitterScale;
        var jz = (rng(seed + 3) - 0.5) * 9.5 * jitterScale;
        var tLand = count <= 1 ? tLand0 : lerp(tLand0, tLandLast, ci / (count - 1));
        var tStart = tLand - fallDur;

        var coinEl = makeCoin3D(colRig, coinR, coinH, theme, capAng, isGain);
        coins.push({
          el: coinEl,
          idx: ci,
          restY: -(ci + 0.5) * coinH,
          jx: jx,
          jz: jz,
          tStart: tStart,
          tLand: tLand,
          airTiltX: (rng(seed + 4) - 0.5) * 30,
          airTiltZ: (rng(seed + 5) - 0.5) * 24,
          airSpinY: (rng(seed + 6) > 0.5 ? 1 : -1) * (24 + rng(seed + 7) * 30),
          airDriftX: (rng(seed + 8) - 0.5) * 32,
          bounceDir: rng(seed + 9) > 0.5 ? 1 : -1,
        });
      }

      // Flash no topo ao cair a ultima moeda (anel 3D + brilho na tampa + 2 estrelas vetoriais)
      var flashAnchor = el('div', {
        style: 'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;pointer-events:none',
      }, stackRoot);

      var flashDisc = el('div', {
        style:
          'position:absolute;left:' + (-coinR) + 'px;top:' + (-coinR) + 'px;' +
          'width:' + (coinR * 2) + 'px;height:' + (coinR * 2) + 'px;border-radius:50%;' +
          'background:' + theme.flashColor + ';opacity:0;pointer-events:none',
      }, flashAnchor);

      var flashRing = el('div', {
        style:
          'position:absolute;left:' + (-coinR) + 'px;top:' + (-coinR) + 'px;' +
          'width:' + (coinR * 2) + 'px;height:' + (coinR * 2) + 'px;border-radius:50%;box-sizing:border-box;' +
          'border:7px solid ' + theme.flashStroke + ';opacity:0;pointer-events:none',
      }, flashAnchor);

      var sparkA = makeSparkle(flashAnchor, 112, theme.flashColor, theme.flashStroke);
      var sparkB = makeSparkle(flashAnchor, 64, '#ffffff', theme.flashStroke);

      // Rotulo inferior da pilha (fora do 3D para leitura perfeita)
      var screenX = cx + offsetX * sc;
      var lblW = nP === 1 ? 900 : Math.max(420, Math.round(spacing * 0.92));
      var lblTop = Math.min(975, Math.round(baseY + (nP === 1 ? 66 : 62) * sc));
      var lblWrap = el('div', {
        style:
          'position:absolute;left:' + (screenX - lblW / 2).toFixed(1) + 'px;top:' + lblTop + 'px;' +
          'width:' + lblW + 'px;text-align:center;z-index:20;pointer-events:none',
      }, root);
      var lblEl = el('div', {
        style:
          FONT_CAP + 'font-size:' + (nP === 1 ? 52 : 44) + 'px;line-height:1.05;color:' + theme.labelColor + ';' +
          'opacity:0;text-shadow:0 4px 18px #000,0 0 34px #000',
        text: pl.rotulo || '',
      }, lblWrap);

      // Contador individual opcional por pilha (se pl.valor for passado)
      var subValWrap = null, subValEl = null, subValKeys = null, subValAt = plAt;
      if (pl.valor !== undefined && pl.valor !== null) {
        subValKeys = normalizeValorKeys(pl.valor);
        if (Array.isArray(pl.valor) && pl.valor.length && pl.valor[0].at !== undefined) subValAt = pl.valor[0].at;
        subValWrap = el('div', {
          style:
            'position:absolute;left:' + (screenX - 310).toFixed(1) + 'px;top:240px;width:620px;' +
            'text-align:center;z-index:22;pointer-events:none',
        }, root);
        subValEl = el('div', {
          style:
            FONT_NUM + 'font-size:108px;line-height:0.95;white-space:nowrap;color:' + theme.accent + ';' +
            'opacity:0;text-shadow:0 6px 24px #000,0 0 28px ' + theme.accent + '66',
        }, subValWrap);
      }

      stacks.push({
        pl: pl,
        theme: theme,
        count: count,
        plAt: plAt,
        fallDur: fallDur,
        bounceDur: bounceDur,
        tLandLast: tLandLast,
        floorDisc: floorDisc,
        colRig: colRig,
        coins: coins,
        flashAnchor: flashAnchor,
        flashDisc: flashDisc,
        flashRing: flashRing,
        sparkA: sparkA,
        sparkB: sparkB,
        lblEl: lblEl,
        subValWrap: subValWrap,
        subValEl: subValEl,
        subValKeys: subValKeys,
        subValAt: subValAt,
      });
    }

    // ------------------------------------------------------------ titulo opcional no topo
    var titleEl = p.titulo
      ? el('div', {
        style:
          'position:absolute;left:0;right:0;top:44px;text-align:center;z-index:25;pointer-events:none;' +
          FONT_CAP + 'font-size:50px;font-style:italic;font-weight:700;color:' + C.text + ';' +
          'opacity:0;text-shadow:0 4px 18px #000,0 0 32px #000',
        text: p.titulo,
      }, root)
      : null;

    // ------------------------------------------------------------ contador grande (p.valor) em cima da pilha
    var hasMainVal = p.valor !== undefined && p.valor !== null;
    var mainValKeys = hasMainVal ? normalizeValorKeys(p.valor) : null;
    var mainValColor = p.cor
      ? (C[p.cor] || p.cor)
      : (nP === 1 ? stacks[0].theme.accent : C.hl);
    var mainValAt = p.valorAt !== undefined
      ? p.valorAt
      : (Array.isArray(p.valor) && p.valor.length && p.valor[0].at !== undefined ? p.valor[0].at : t0);

    var mainValWrap = hasMainVal
      ? el('div', {
        style:
          'position:absolute;left:' + (cx - 560).toFixed(1) + 'px;top:' + (p.titulo ? 116 : 64) + 'px;' +
          'width:1120px;text-align:center;z-index:24;pointer-events:none',
      }, root)
      : null;

    var mainValEl = hasMainVal
      ? el('div', {
        style:
          FONT_NUM + 'font-size:172px;line-height:0.92;letter-spacing:0.02em;white-space:nowrap;' +
          'color:' + mainValColor + ';opacity:0;' +
          'text-shadow:0 8px 28px #000,0 0 34px ' + mainValColor + '66',
      }, mainValWrap)
      : null;

    // ------------------------------------------------------------ funcao pura de renderizacao
    return function (tl) {
      var T = t0 + tl;
      var uCam = c01((T - t0) / Math.max(1, totalDur));

      // 1. Entrada suave no wrapper externo (nao achata preserve-3d)
      var fadeIn = c01((T - t0 + 1 / 30) / 0.16);
      wrap.style.opacity = fadeIn.toFixed(3);

      // 2. Camera orbitando devagar em volta (rotateY: -25 -> +20 deg, rotateX: ~-12 deg)
      var camRy = lerp(-25, 20, E.io(uCam));
      var camRx = -13 + 2.0 * uCam + Math.sin(uCam * Math.PI) * 0.6;
      var camScale = 0.98 + 0.045 * uCam;
      st.cam.style.transform =
        'rotateX(' + camRx.toFixed(3) + 'deg) rotateY(' + camRy.toFixed(3) + 'deg) scale(' + camScale.toFixed(4) + ')';

      // 3. Titulo
      if (titleEl) {
        OF.popText(titleEl, T, p.tituloAt !== undefined ? p.tituloAt : t0, undefined, 'rise');
      }

      // 4. Atualiza cada pilha de moedas
      var lastFinishGlobal = t0;
      for (var si = 0; si < stacks.length; si++) {
        var sObj = stacks[si];
        var coins = sObj.coins;
        var count = sObj.count;
        var landedCount = 0;
        var newestImpactAge = 99;

        for (var ci = 0; ci < count; ci++) {
          var c = coins[ci];
          if (T < c.tStart) {
            c.el.style.display = 'none';
            c.el.style.transform = 'none';
            continue;
          }
          c.el.style.display = '';

          var x = c.jx, y = c.restY, z = c.jz;
          var rx = 0, ry = 0, rz = 0;
          var sx = 1, sy = 1, sz = 1;

          if (T < c.tLand) {
            // Queda com gravidade quadratica
            var uf = c01((T - c.tStart) / sObj.fallDur);
            var startY = Math.min(-1080, c.restY - 760);
            y = lerp(startY, c.restY, uf * uf);
            x = c.jx + (1 - uf) * c.airDriftX;
            rx = (1 - uf) * c.airTiltX;
            rz = (1 - uf) * c.airTiltZ;
            ry = (1 - uf) * c.airSpinY;
          } else {
            landedCount++;
            var dt = T - c.tLand;
            if (dt < newestImpactAge) newestImpactAge = dt;

            if (dt < sObj.bounceDur) {
              // Quiquinho duplo amortecido ao pousar na pilha
              var ub = dt / sObj.bounceDur;
              var bounceH = 0;
              if (ub < 0.64) {
                bounceH = Math.sin((ub / 0.64) * Math.PI) * (coinH * 1.45);
              } else {
                bounceH = Math.sin(((ub - 0.64) / 0.36) * Math.PI) * (coinH * 0.42);
              }
              y = c.restY - bounceH;
              rz = Math.sin(ub * Math.PI * 2.5) * (1 - ub) * 6.5 * c.bounceDir;
              rx = Math.sin(ub * Math.PI * 2.0) * (1 - ub) * 4.0;
              if (dt < 0.045) {
                var sq = Math.sin((dt / 0.045) * Math.PI);
                sx = 1 + 0.032 * sq;
                sz = 1 + 0.032 * sq;
                sy = 1 - 0.06 * sq;
              }
            }
          }

          c.el.style.transform =
            'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) ' +
            'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg) ' +
            'scale3d(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ',' + sz.toFixed(4) + ')';
        }

        // Recuo elastico sutil na coluna inteira no impacto de cada moeda
        var colSquash = newestImpactAge < 0.085
          ? Math.sin((newestImpactAge / 0.085) * Math.PI) * 0.016
          : 0;
        sObj.colRig.style.transform =
          'scale3d(' + (1 + colSquash * 0.45).toFixed(4) + ',' + (1 - colSquash).toFixed(4) + ',' + (1 + colSquash * 0.45).toFixed(4) + ')';

        // Halo no chao acompanha o crescimento da pilha
        var fillRatio = count > 0 ? landedCount / count : 0;
        var haloScale = 0.72 + 0.28 * E.out3(c01(fillRatio * 1.4 + prog(T, sObj.plAt, 0.3) * 0.35));
        sObj.floorDisc.style.opacity = (0.35 + 0.55 * fillRatio).toFixed(3);
        sObj.floorDisc.style.transform = 'translateY(3px) rotateX(90deg) scale(' + haloScale.toFixed(3) + ')';

        // Brilho (flash) no topo quando a ultima moeda pousa
        if (count > 0) {
          var lastCoin = coins[count - 1];
          var flashAge = T - lastCoin.tLand;
          if (lastCoin.tLand > lastFinishGlobal) lastFinishGlobal = lastCoin.tLand;

          if (flashAge >= 0 && flashAge < 0.58) {
            var topY = -count * coinH - 2;
            sObj.flashAnchor.style.transform =
              'translate3d(' + lastCoin.jx.toFixed(1) + 'px,' + topY.toFixed(1) + 'px,' + lastCoin.jz.toFixed(1) + 'px)';

            // Sheen rapido na face superior da ultima moeda
            var discU = c01(flashAge / 0.22);
            sObj.flashDisc.style.opacity = ((1 - discU) * 0.78).toFixed(3);
            sObj.flashDisc.style.transform = 'rotateX(90deg) translateZ(1.5px)';

            // Anel que expande na borda do topo
            var ringU = c01(flashAge / 0.44);
            var ringE = E.out3(ringU);
            sObj.flashRing.style.opacity = ((1 - ringU) * 0.95).toFixed(3);
            sObj.flashRing.style.transform = 'rotateX(90deg) translateZ(2.5px) scale(' + (0.86 + 0.58 * ringE).toFixed(3) + ')';

            // Estrela principal (billboard voltada para a camera)
            var spAU = c01(flashAge / 0.48);
            var spAS = spAU < 0.24 ? E.back(spAU / 0.24) : 1 - E.out3((spAU - 0.24) / 0.76);
            sObj.sparkA.style.opacity = c01(spAS * 1.4).toFixed(3);
            sObj.sparkA.style.transform =
              'translate3d(' + (coinR * 0.52).toFixed(1) + 'px,-14px,' + (coinR * 0.48).toFixed(1) + 'px) ' +
              'rotateY(' + (-camRy).toFixed(2) + 'deg) rotateX(' + (-camRx).toFixed(2) + 'deg) ' +
              'rotateZ(' + (spAU * 42).toFixed(1) + 'deg) scale(' + Math.max(0, spAS * 1.15).toFixed(3) + ')';

            // Estrela secundaria defasada
            var spBU = c01((flashAge - 0.07) / 0.45);
            var spBS = spBU <= 0 ? 0 : (spBU < 0.26 ? E.back(spBU / 0.26) : 1 - E.out3((spBU - 0.26) / 0.74));
            sObj.sparkB.style.opacity = c01(spBS * 1.3).toFixed(3);
            sObj.sparkB.style.transform =
              'translate3d(' + (-coinR * 0.56).toFixed(1) + 'px,-26px,' + (coinR * 0.22).toFixed(1) + 'px) ' +
              'rotateY(' + (-camRy).toFixed(2) + 'deg) rotateX(' + (-camRx).toFixed(2) + 'deg) ' +
              'rotateZ(' + (-spBU * 36).toFixed(1) + 'deg) scale(' + Math.max(0, spBS * 1.05).toFixed(3) + ')';
          } else {
            sObj.flashAnchor.style.transform = 'none';
            sObj.flashDisc.style.opacity = '0';
            sObj.flashDisc.style.transform = 'none';
            sObj.flashRing.style.opacity = '0';
            sObj.flashRing.style.transform = 'none';
            sObj.sparkA.style.opacity = '0';
            sObj.sparkA.style.transform = 'none';
            sObj.sparkB.style.opacity = '0';
            sObj.sparkB.style.transform = 'none';
          }
        }

        // Rotulo inferior da pilha
        if (sObj.pl.rotulo) {
          OF.popText(sObj.lblEl, T, sObj.pl.rotuloAt !== undefined ? sObj.pl.rotuloAt : sObj.plAt + 0.12, undefined, 'rise');
        } else {
          sObj.lblEl.style.opacity = '0';
        }

        // Contador individual opcional da pilha
        if (sObj.subValEl) {
          var subTxt = formatValor(sObj.pl.valor, sObj.subValKeys, T);
          if (sObj.subValEl.textContent !== subTxt) sObj.subValEl.textContent = subTxt;
          var stackTopScreenY = baseY - (Math.max(2, landedCount) * coinH) * sc;
          var minSubTop = hasMainVal ? (p.titulo ? 280 : 230) : (p.titulo ? 130 : 80);
          sObj.subValWrap.style.top = clamp(Math.round(stackTopScreenY - 148), minSubTop, Math.round(baseY - 180)) + 'px';
          OF.popText(sObj.subValEl, T, sObj.subValAt, undefined, 'rise');
        }
      }

      // 5. Contador grande principal (p.valor) em cima da pilha
      if (mainValEl) {
        var mainTxt = formatValor(p.valor, mainValKeys, T);
        if (mainValEl.textContent !== mainTxt) mainValEl.textContent = mainTxt;
        var fs = mainTxt.length > 13 ? 124 : mainTxt.length > 10 ? 148 : 172;
        mainValEl.style.fontSize = fs + 'px';

        // Com 1 pilha, acompanha suavemente o topo crescente; com 2+ pilhas, ancora centralizado no topo
        if (nP === 1) {
          var s0 = stacks[0];
          var curTopCoins = 0;
          for (var k0 = 0; k0 < s0.count; k0++) {
            if (T >= s0.coins[k0].tLand) curTopCoins++;
          }
          var smoothH = curTopCoins * coinH * sc;
          var minTop = p.titulo ? 116 : 62;
          var targetTop = clamp(Math.round(baseY - smoothH - 220), minTop, Math.round(baseY - 260));
          mainValWrap.style.top = targetTop + 'px';
        }

        OF.popText(mainValEl, T, mainValAt, undefined, 'rise');

        // Pulso sutil no contador quando a ultima moeda pousa
        var finAge = T - lastFinishGlobal;
        if (finAge >= 0 && finAge < 0.32 && T >= mainValAt) {
          var pulse = 1 + 0.065 * Math.sin((finAge / 0.32) * Math.PI);
          mainValWrap.style.transform = 'scale(' + pulse.toFixed(4) + ')';
        } else {
          mainValWrap.style.transform = 'none';
        }
      }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
