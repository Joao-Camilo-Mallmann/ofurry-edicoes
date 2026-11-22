/* Kit visual do video "Na Hora do Almoco" (Belchior).
 * Tudo e funcao do tempo da timeline GSAP: nada de Math.random, timers ou rAF.
 *
 *   Almoco.photo(canvas, opts)            -> Promise<ctrl>   foto 3D (parallax por mapa de profundidade)
 *   Almoco.camera(tl, ctrl, start, dur, keys)                 movimento de camera da foto, keyframes em segundos locais
 *   Almoco.words(tl, spans, times, opts)                      revela palavra por palavra nos tempos da fala
 *   Almoco.letters(tl, el, start, dur, opts)                  revela letra por letra
 *   Almoco.dissolve(tl, el, start, dur, opts)                 letras viram poeira e somem
 *   Almoco.counter(tl, el, from, to, start, dur)              contador de anos
 *   Almoco.write(tl, el, start, dur)                          escrita a mao (revela da esquerda pra direita, com ponta de lapis)
 *   Almoco.film(canvas, tl, dur, opts)                        grao de filme gerado por frame
 */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('nao carregou ' + src)); };
      im.src = src;
    });
  }

  // ---------- foto 3D ----------
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

  var DEFAULTS = { zoom: 1, x: 0, y: 0, px: 0, py: 0, focus: 0.5, rot: 0, blurX: 0, blurY: 0, fade: 0, sat: 0.92, warm: 0.6, bright: 1, contrast: 1.04 };

  function photo(canvas, opts) {
    opts = opts || {};
    var W = canvas.width = opts.width || 1920;
    var H = canvas.height = opts.height || 1080;
    var gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
    if (!gl) return Promise.reject(new Error('sem WebGL'));
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function flat() { var c = document.createElement('canvas'); c.width = c.height = 2; var x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 2, 2); return c; }
    var arquivo = /\/F\d/.test(opts.src || '');
    // imagens geradas pelo AGY: look do clipe de 1974 (menos contraste, pretos lavados, foco macio, mais grao)
    var LOOK_GERADA = { sat: 0.78, contrast: 0.86, warm: 0.8 };
    var base = Object.assign({}, DEFAULTS, arquivo ? {} : LOOK_GERADA, opts.grade || {});
    return Promise.all([loadImg(opts.src), opts.depth ? loadImg(opts.depth).catch(function () { return flat(); }) : Promise.resolve(flat())])
      .then(function (r) {
        var img = r[0];
        tex(0, img); tex(1, r[1]);
        gl.uniform1i(U.uImg, 0); gl.uniform1i(U.uDepth, 1);
        gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uImgRes, img.naturalWidth, img.naturalHeight);
        gl.uniform2f(U.uAnchor, opts.anchorX == null ? 0.5 : opts.anchorX, opts.anchorY == null ? 0.5 : opts.anchorY);
        // frames do clipe de 1974 tem linha clara na borda: recorte de seguranca
        gl.uniform1f(U.uInset, opts.inset == null ? (/\/F\d/.test(opts.src) ? 0.016 : 0.003) : opts.inset);
        gl.viewport(0, 0, W, H);
        var strength = opts.strength == null ? 1 : opts.strength;
        var ctrl = {
          render: function (s, t) {
            s = Object.assign({}, base, s);
            gl.uniform1f(U.uZoom, s.zoom); gl.uniform2f(U.uPan, s.x, s.y);
            gl.uniform2f(U.uPar, s.px * 0.04 * strength, s.py * 0.04 * strength);
            gl.uniform1f(U.uFocus, s.focus); gl.uniform1f(U.uRot, s.rot * Math.PI / 180);
            gl.uniform2f(U.uBlur, s.blurX, s.blurY); gl.uniform1f(U.uFade, s.fade);
            gl.uniform1f(U.uGrain, opts.grain == null ? (arquivo ? 0.075 : 0.1) : opts.grain);
            gl.uniform1f(U.uSoft, opts.soft == null ? (arquivo ? 0 : 1.6) : opts.soft);
            gl.uniform1f(U.uLift, opts.lift == null ? (arquivo ? 0.02 : 0.07) : opts.lift);
            gl.uniform1f(U.uVig, opts.vignette == null ? 0.3 : opts.vignette);
            gl.uniform1f(U.uSeed, Math.floor((t || 0) * 24) * 7.13);
            gl.uniform1f(U.uSat, s.sat); gl.uniform1f(U.uWarm, s.warm); gl.uniform1f(U.uBright, s.bright); gl.uniform1f(U.uContrast, s.contrast);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          }
        };
        ctrl.render({}, 0);
        return ctrl;
      });
  }

  // keys: [{t:0, zoom:1, ...}, {t:2.5, zoom:1.1, ease:'power2.inOut'}]  t em segundos desde `start`
  function camera(tl, ctrl, start, dur, keys) {
    var state = { p: 0 };
    var eases = keys.map(function (k) { return gsap.parseEase(k.ease || 'sine.inOut'); });
    function at(time) {
      var out = {};
      var props = {};
      keys.forEach(function (k) { Object.keys(k).forEach(function (n) { if (n !== 't' && n !== 'ease') props[n] = 1; }); });
      Object.keys(props).forEach(function (n) {
        var prev = null, next = null;
        for (var i = 0; i < keys.length; i++) {
          if (keys[i][n] == null) continue;
          if (keys[i].t <= time) prev = i;
          if (keys[i].t > time && next == null) next = i;
        }
        if (prev == null) out[n] = keys[next][n];
        else if (next == null) out[n] = keys[prev][n];
        else {
          var a = keys[prev], b = keys[next];
          var f = eases[next]((time - a.t) / (b.t - a.t));
          out[n] = a[n] + (b[n] - a[n]) * f;
        }
      });
      return out;
    }
    tl.fromTo(state, { p: 0 }, {
      p: 1, duration: dur, ease: 'none',
      onUpdate: function () { var t = state.p * dur; ctrl.render(at(t), start + t); }
    }, start);
  }

  // ---------- texto ----------
  function words(tl, spans, times, opts) {
    opts = opts || {};
    var y = opts.y == null ? 26 : opts.y, d = opts.dur == null ? 0.45 : opts.dur;
    spans.forEach(function (s, i) {
      tl.fromTo(s, { opacity: 0, y: y, filter: 'blur(10px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: d, ease: opts.ease || 'power3.out' }, times[i]);
    });
  }

  function splitLetters(el) {
    var txt = el.textContent; el.textContent = '';
    var out = [];
    for (var i = 0; i < txt.length; i++) {
      var sp = document.createElement('span');
      sp.textContent = txt[i] === ' ' ? ' ' : txt[i];
      sp.style.display = 'inline-block';
      el.appendChild(sp); out.push(sp);
    }
    return out;
  }

  function letters(tl, el, start, dur, opts) {
    opts = opts || {};
    var ls = el.__letters || (el.__letters = splitLetters(el));
    var step = dur / Math.max(1, ls.length);
    ls.forEach(function (s, i) {
      tl.fromTo(s, { opacity: 0, y: opts.y == null ? 18 : opts.y, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: opts.each || 0.5, ease: 'power2.out' }, start + i * step);
    });
  }

  function dissolve(tl, el, start, dur, opts) {
    opts = opts || {};
    var ls = el.__letters || (el.__letters = splitLetters(el));
    var rnd = mulberry32(opts.seed || 7);
    ls.forEach(function (s) {
      var dx = (rnd() - 0.3) * 160, dy = -40 - rnd() * 140, delay = rnd() * dur * 0.5;
      tl.to(s, { opacity: 0, x: dx, y: dy, rotation: (rnd() - 0.5) * 40, filter: 'blur(14px)', duration: dur * 0.6, ease: 'power2.in' }, start + delay);
    });
  }

  function counter(tl, el, from, to, start, dur, ease) {
    var o = { v: from };
    tl.fromTo(o, { v: from }, {
      v: to, duration: dur, ease: ease || 'expo.inOut',
      onUpdate: function () { el.textContent = String(Math.round(o.v)); }
    }, start);
  }

  function write(tl, el, start, dur, pen) {
    tl.fromTo(el, { clipPath: 'inset(-20% 100% -20% 0%)' }, { clipPath: 'inset(-20% 0% -20% 0%)', duration: dur, ease: 'none' }, start);
    if (pen) {
      var w = el.offsetWidth;
      tl.fromTo(pen, { x: 0, opacity: 1 }, { x: w, duration: dur, ease: 'none' }, start);
      tl.to(pen, { opacity: 0, duration: 0.3 }, start + dur);
    }
  }

  // ---------- filme ----------
  function film(canvas, tl, dur, opts) {
    opts = opts || {};
    var w = canvas.width = 960, h = canvas.height = 540;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(w, h);
    var o = { p: 0 };
    function draw(t) {
      var rnd = mulberry32(Math.floor(t * 24) + 11);
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var v = rnd() * 255;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    tl.fromTo(o, { p: 0 }, { p: 1, duration: dur, ease: 'none', onUpdate: function () { draw(o.p * dur); } }, 0);
    draw(0);
  }

  // ---------- fumaca escura saindo de um ponto (o prato) ----------
  // opts: { x, y (px do centro de origem), raio, cor:[r,g,b], densidade, sobe (px/s) }
  function fumaca(canvas, tl, start, dur, opts) {
    opts = opts || {};
    var W = canvas.width = 1920, H = canvas.height = 1080, ctx = canvas.getContext('2d');
    var rnd = mulberry32(opts.seed || 9), N = opts.densidade || 70, P = [];
    for (var i = 0; i < N; i++) P.push({ b: rnd() * dur * 0.85, a: rnd() * 6.28, r: rnd(), s: 0.6 + rnd() * 0.8, w: rnd() * 6.28, life: 2.2 + rnd() * 2.2 });
    var cor = opts.cor || [18, 12, 9], o = { p: 0 };
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = opts.modo || 'source-over';
      P.forEach(function (q) {
        var k = (t - q.b) / q.life; if (k <= 0 || k >= 1) return;
        var R = (opts.raio || 160) * (0.35 + q.r * 0.4);
        var x = opts.x + Math.cos(q.a) * R + Math.sin(q.w + t * 1.3) * 40 * k;
        var y = opts.y + Math.sin(q.a) * R * 0.5 - (opts.sobe || 120) * q.s * (t - q.b);
        var rad = 60 + 260 * k * q.s;
        var al = Math.sin(Math.PI * k) * (opts.alfa || 0.32);
        var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, 'rgba(' + cor + ',' + al + ')'); g.addColorStop(1, 'rgba(' + cor + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.3); ctx.fill();
      });
    }
    tl.fromTo(o, { p: 0 }, { p: 1, duration: dur, ease: 'none', onUpdate: function () { draw(o.p * dur); } }, start);
  }

  // ---------- energia: flash, inversao, tremida, soco de zoom, glitch de texto ----------
  // (arquetipo "Energetico" da skill motion-design: 100-250 ms, expo.out, overshoot 15-30%)
  // flash(tl, el, at, {pico, dur}): el = div cheia (cor no CSS). Sobe em 1 frame e cai rapido.
  function flash(tl, el, at, o) {
    o = o || {};
    tl.fromTo(el, { opacity: 0 }, { opacity: o.pico == null ? 1 : o.pico, duration: 0.034, ease: 'none' }, at);
    tl.to(el, { opacity: 0, duration: o.dur || 0.22, ease: 'power2.out' }, at + 0.034);
  }
  // inverte(tl, el, at, quadros): el = div branca com mix-blend-mode:difference -> inverte o que esta embaixo
  function inverte(tl, el, at, quadros) {
    var d = (quadros || 2) / 30;
    tl.set(el, { opacity: 1 }, at);
    tl.set(el, { opacity: 0 }, at + d);
  }
  // treme(tl, el, at, dur, forca): tremida sementeada (x, y, rotacao) e volta ao zero
  function treme(tl, el, at, dur, forca, seed) {
    var r = mulberry32(seed || 13), n = Math.max(2, Math.round(dur / 0.04)), f = forca || 14;
    for (var i = 0; i < n; i++) {
      var k = 1 - i / n;
      tl.to(el, { x: (r() - 0.5) * 2 * f * k, y: (r() - 0.5) * 2 * f * k * 0.7, rotation: (r() - 0.5) * f * 0.12 * k, duration: 0.04, ease: 'none' }, at + i * 0.04);
    }
    tl.to(el, { x: 0, y: 0, rotation: 0, duration: 0.06, ease: 'power2.out' }, at + n * 0.04);
  }
  // soco(tl, el, at, de, ate): golpe de zoom no corte (escala de -> ate com expo.out)
  function soco(tl, el, at, de, ate, dur) {
    tl.fromTo(el, { scale: de == null ? 1.18 : de }, { scale: ate == null ? 1 : ate, duration: dur || 0.35, ease: 'expo.out' }, at);
  }
  // pancada(tl, el, at): palavra que "pisa" na tela (cel-flash-stomp): entra grande, desfocada, e trava
  function pancada(tl, el, at, o) {
    o = o || {};
    tl.fromTo(el, { opacity: 0, scale: o.de || 1.6, filter: 'blur(14px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: o.dur || 0.16, ease: 'expo.out' }, at);
  }
  // glitch de texto: duas copias (vermelha/ciano) que deslocam por alguns quadros
  function glitchTexto(tl, a, b, at, dur, seed) {
    var r = mulberry32(seed || 21), n = Math.round((dur || 0.3) / 0.034);
    for (var i = 0; i < n; i++) {
      var dx = (r() - 0.5) * 28, dy = (r() - 0.5) * 8;
      tl.set(a, { x: dx, y: dy, opacity: 0.85 }, at + i * 0.034);
      tl.set(b, { x: -dx, y: -dy, opacity: 0.85 }, at + i * 0.034);
    }
    tl.set([a, b], { x: 0, y: 0, opacity: 0 }, at + n * 0.034);
  }

  // espera as fontes do video carregarem de verdade (document.fonts.ready nao espera fonte ainda nao usada)
  function fontes() {
    var f = ['400 96px "Bebas Neue"', '500 31px MontserratLocal', '600 31px MontserratLocal', '700 31px MontserratLocal', '800 31px MontserratLocal', '600 50px Caveat', '400 30px Maquina', 'italic 400 60px Garamond', 'italic 500 60px Garamond'];
    return Promise.all(f.map(function (x) { return document.fonts.load(x).catch(function () {}); }))
      .then(function () { return document.fonts.ready; });
  }

  // ---------- folha da letra ----------
  // folha(papel, versos): monta a letra dentro de `papel` (um verso por linha, palavras em <span>).
  // Retorna { linha(i), palavras(i, de, ate) } para mirar camera e marcas.
  function folha(papel, versos) {
    var corpo = document.createElement('div');
    corpo.className = 'fo-corpo';
    var linhas = [];
    versos.forEach(function (v, i) {
      var l = document.createElement('div');
      l.className = v ? 'fo-linha' : 'fo-linha fo-vazia';
      l.id = papel.id + '-l' + i;
      if (/^~\d+$/.test(v)) {
        // linha borrada (letra oficial ainda nao colada): largura em % da coluna
        var b = document.createElement('span'); b.className = 'fo-w fo-borrao'; b.style.width = v.slice(1) + '%';
        l.appendChild(b); corpo.appendChild(l); linhas.push(l); return;
      }
      (v || ' ').split(' ').forEach(function (w, k) {
        if (k) l.appendChild(document.createTextNode(' '));
        var s = document.createElement('span'); s.className = 'fo-w'; s.textContent = w; l.appendChild(s);
      });
      corpo.appendChild(l); linhas.push(l);
    });
    papel.appendChild(corpo);
    function rel(el) {
      var x = 0, y = 0, e = el;
      while (e && e !== papel) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
    }
    function palavras(i, de, ate) {
      var ws = linhas[i].querySelectorAll('.fo-w');
      return Array.prototype.slice.call(ws, de || 0, ate == null ? ws.length : ate + 1);
    }
    function caixa(ws) {
      var a = rel(ws[0]), b = rel(ws[ws.length - 1]);
      return { x: a.x, y: a.y, w: b.x + b.w - a.x, h: a.h };
    }
    // acha('comida e tristeza') -> as <span> dessas palavras, no primeiro verso que as contem
    function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim(); }
    function acha(frase, depois) {
      var alvo = norm(frase).split(/\s+/);
      for (var i = depois || 0; i < linhas.length; i++) {
        var ws = Array.prototype.slice.call(linhas[i].querySelectorAll('.fo-w'));
        var ns = ws.map(function (w) { return norm(w.textContent); });
        for (var k = 0; k + alvo.length <= ns.length; k++) {
          var ok = true;
          for (var j = 0; j < alvo.length; j++) if (ns[k + j] !== alvo[j]) { ok = false; break; }
          if (ok) { var r = ws.slice(k, k + alvo.length); r.linha = i; return r; }
        }
      }
      console.warn('verso nao encontrado: ' + frase);
      return null;
    }
    // estrofe(n) -> indices das linhas da n-esima estrofe (1 = primeira), separadas por linha vazia
    function estrofe(n) {
      var e = 1, out = [];
      versos.forEach(function (v, i) {
        if (!v) { if (i > 0 && versos[i - 1]) e++; return; }
        if (e === n) out.push(i);
      });
      return out;
    }
    return { papel: papel, linhas: linhas, rel: rel, palavras: palavras, caixa: caixa, acha: acha, estrofe: estrofe };
  }

  // centro de um verso, para a camera: devolve o deslocamento que poe o verso no meio da tela
  function mira(F, alvo, ox, oy) {
    var r = typeof alvo === 'number' ? F.rel(F.linhas[alvo]) : F.caixa(alvo);
    var cx = F.papel.offsetWidth / 2, cy = F.papel.offsetHeight / 2;
    return { x: cx - (r.x + r.w / 2) + (ox || 0), y: cy - (r.y + r.h / 2) + (oy || 0) };
  }

  var CORES = { amarelo: 'rgba(242,194,48,0.62)', laranja: 'rgba(242,194,48,0.62)', vermelho: 'rgba(170,28,18,0.5)', azul: 'rgba(80,120,190,0.45)', preto: 'rgba(14,12,10,0.85)' };
  var TINTAS = { preto: '#16120e', amarelo: '#c99a12', laranja: '#16120e', vermelho: '#9e1a10', azul: '#2f5a9e', grafite: '#3a3430' };

  // As marcas ficam presas as proprias palavras (num <span class="fo-grupo">), sem medir posicoes:
  // acompanham o texto em qualquer fonte. pronto=true desenha ja completo (marca de trecho anterior).
  function grupo(ws) {
    if (ws.length === 1) return ws[0];
    var pai = ws[0].parentNode, ultimo = ws[ws.length - 1];
    if (ultimo.parentNode !== pai) { console.warn("marca cruzando grupos"); return ws[0]; }
    if (pai.classList && pai.classList.contains("fo-grupo") && pai.firstChild === ws[0] && pai.lastChild === ultimo) return pai;
    var g = document.createElement("span"); g.className = "fo-grupo";
    pai.insertBefore(g, ws[0]);
    var n = ws[0];
    while (n) { var prox = n.nextSibling; g.appendChild(n); if (n === ultimo) break; n = prox; }
    return g;
  }
  function svgEm(alvo, css, vb) {
    var sv = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sv.setAttribute("class", "fo-svg"); sv.setAttribute("viewBox", vb || "0 0 100 100"); sv.setAttribute("preserveAspectRatio", "none");
    sv.style.cssText = css; alvo.appendChild(sv); return sv;
  }
  function traco(sv, d, cor, larg) {
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", TINTAS[cor] || cor);
    p.setAttribute("stroke-width", larg || 5); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
    p.setAttribute("vector-effect", "non-scaling-stroke");
    sv.appendChild(p);
    return { p: p, sv: sv };
  }
  // "desenha" o traco revelando o SVG da esquerda pra direita (mascara), como a escrita a mao
  function desenha(tl, t, at, dur, pronto) {
    var cheio = "inset(-40% -10% -40% -10%)";
    if (pronto) tl.set(t.sv, { clipPath: cheio }, 0);
    else tl.fromTo(t.sv, { clipPath: "inset(-40% 110% -40% -10%)" }, { clipPath: cheio, duration: dur, ease: "power1.inOut" }, at);
  }

  function marca(tl, F, ws, at, dur, cor, pronto) {
    var g = grupo(ws);
    var m = document.createElement("span");
    m.className = "fo-marca";
    m.style.background = CORES[cor] || cor;
    g.insertBefore(m, g.firstChild);
    if (pronto) tl.set(m, { scaleX: 1 }, 0);
    else tl.fromTo(m, { scaleX: 0 }, { scaleX: 1, duration: dur || 0.6, ease: "power2.inOut" }, at);
    return m;
  }

  function sublinha(tl, F, ws, at, dur, cor, pronto, seed) {
    var g = grupo(ws), r = mulberry32(seed || 3);
    var sv = svgEm(g, "left:-6px;width:calc(100% + 12px);top:88%;height:16px", "0 0 100 10");
    var d = "M0 " + (5 + r() * 2).toFixed(1);
    for (var i = 1; i <= 6; i++) d += " L" + (i * 100 / 6).toFixed(1) + " " + (5 + (r() - 0.5) * 5).toFixed(1);
    desenha(tl, traco(sv, d, cor, 4.5), at, dur || 0.5, pronto);
  }

  function circula(tl, F, ws, at, dur, cor, pronto, seed) {
    var g = grupo(ws), r = mulberry32(seed || 5);
    var sv = svgEm(g, "left:-26px;width:calc(100% + 52px);top:-12px;height:calc(100% + 24px)");
    var d = "", n = 40;
    for (var i = 0; i <= n; i++) {
      var a = -2.2 + (i / n) * Math.PI * 2 * 1.15, k = 1 + (r() - 0.5) * 0.06;
      d += (i ? " L" : "M") + (50 + Math.cos(a) * 49 * k).toFixed(1) + " " + (50 + Math.sin(a) * 47 * k).toFixed(1);
    }
    desenha(tl, traco(sv, d, cor, 4), at, dur || 0.6, pronto);
  }

  // nota a mao a direita das palavras, com seta curva ate elas. dy = deslocamento vertical da nota (px)
  function nota(tl, F, alvo, texto, dy, at, cor, pronto) {
    var g = typeof alvo === "number" ? grupo(F.palavras(alvo)) : grupo(alvo);
    dy = dy || 0;
    var n = document.createElement("span");
    n.className = "fo-nota";
    n.textContent = texto;
    n.style.color = TINTAS[cor] || cor;
    n.style.left = "calc(100% + 90px)"; n.style.top = (dy - 34) + "px";
    g.appendChild(n);
    var y0 = dy - 4, ymin = Math.min(y0, 0) - 44, ymax = Math.max(y0, 0) + 14;
    var sv = svgEm(g, "left:100%;top:calc(50% + " + ymin + "px);width:100px;height:" + (ymax - ymin) + "px", "0 " + ymin + " 100 " + (ymax - ymin));
    var seta = traco(sv, "M84 " + y0 + " Q46 " + (Math.min(y0, 0) - 34) + " 12 0 M28 -10 L12 0 L29 8", cor, 3.2);
    var d = Math.min(1.4, 0.2 + texto.length * 0.05);
    if (pronto) tl.set(n, { clipPath: "inset(-20% 0% -20% 0%)" }, 0);
    else write(tl, n, at, d);
    desenha(tl, seta, at + d * 0.6, 0.45, pronto);
    return n;
  }

  // ---------- texto 3D (extrusao por camadas de text-shadow) ----------
  // texto3d(el, {prof, dx, dy, cor, escuro}): `prof` camadas deslocadas (dx, dy) px; as primeiras na cor clara, o resto escuro
  function texto3d(el, o) {
    o = o || {};
    var prof = o.prof || 14, dx = o.dx == null ? 1 : o.dx, dy = o.dy == null ? 1.2 : o.dy;
    var cor = o.cor || '#7a5a1e', escuro = o.escuro || '#2a1d0c', sh = [];
    for (var i = 1; i <= prof; i++) sh.push((dx * i).toFixed(1) + 'px ' + (dy * i).toFixed(1) + 'px 0 ' + (i / prof < 0.3 ? cor : escuro));
    sh.push((dx * prof + 6).toFixed(1) + 'px ' + (dy * prof + 16).toFixed(1) + 'px 26px rgba(0,0,0,0.5)');
    el.style.textShadow = sh.join(', ');
    el.classList.add('t3d');
    return el;
  }

  // ---------- folha da letra em cena ----------
  // folhaPalco(root, versos, o): monta palco (perspectiva) > mao (tremidinha de camera) > papel (titulo + letra).
  // Devolve o F de folha() mais F.palco, F.mao, F.camera(tl, at, dur, alvo, c) e F.tremor(tl, dur, forca).
  //   alvo: indice de linha, array de <span> (de F.acha) ou null (folha inteira); c: {zoom, ox, oy, tilt, giro, ease}
  function folhaPalco(root, versos, o) {
    o = o || {};
    var palco = document.createElement('div'); palco.className = 'fo-palco';
    var mao = document.createElement('div'); mao.className = 'fo-mao';
    var papel = document.createElement('div'); papel.className = 'fo-papel'; papel.id = (root.id || 'fo') + '-papel';
    var tit = document.createElement('div'); tit.className = 'fo-titulo';
    tit.innerHTML = '<b>' + (o.titulo || 'NA HORA DO ALMOÇO') + '</b><i>' + (o.sub || 'Belchior 1974') + '</i>';
    papel.appendChild(tit); mao.appendChild(papel); palco.appendChild(mao); root.appendChild(palco);
    var F = folha(papel, versos);
    F.palco = palco; F.mao = mao;
    var tiltBase = o.tilt == null ? 22 : o.tilt, giroBase = o.giro == null ? -2 : o.giro, zoom0 = o.zoomInicial || 0.46;
    gsap.set(papel, { x: 0, y: 0, scale: zoom0, rotateX: tiltBase, rotateZ: giroBase, transformOrigin: '50% 50%' });
    F.camera = function (tl, at, dur, alvo, c) {
      c = c || {};
      var zoom = c.zoom || (alvo == null ? zoom0 : 1.15), m = alvo == null ? { x: 0, y: 0 } : mira(F, alvo, c.ox || 0, c.oy || 0);
      tl.to(papel, { x: m.x * zoom, y: m.y * zoom, scale: zoom,
        rotateX: c.tilt == null ? (alvo == null ? tiltBase : 6) : c.tilt,
        rotateZ: c.giro == null ? (alvo == null ? giroBase : -1) : c.giro,
        duration: dur, ease: c.ease || 'power2.inOut' }, at);
    };
    // camera na mao: deriva lenta + tremor pequeno, funcao do tempo (determinista)
    F.tremor = function (tl, dur, forca) {
      var f = forca == null ? 1 : forca, st = { p: 0 };
      tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: 'none', onUpdate: function () {
        var t = st.p * dur;
        gsap.set(mao, { x: (Math.sin(t * 0.9) * 7 + Math.sin(t * 2.3 + 1) * 3) * f, y: (Math.cos(t * 0.7) * 6 + Math.sin(t * 1.9) * 2.5) * f, rotation: Math.sin(t * 0.5 + 2) * 0.6 * f });
      } }, 0);
    };
    return F;
  }

  window.Almoco = { photo: photo,
    flash: flash, inverte: inverte, treme: treme, soco: soco, pancada: pancada, glitchTexto: glitchTexto,
    fontes: fontes, fumaca: fumaca, folha: folha, folhaPalco: folhaPalco, texto3d: texto3d, mira: mira, marca: marca, sublinha: sublinha, circula: circula, nota: nota, camera: camera, words: words, letters: letters, dissolve: dissolve, counter: counter, write: write, film: film, mulberry32: mulberry32, splitLetters: splitLetters };
})();
