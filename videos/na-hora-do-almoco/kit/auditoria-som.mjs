/**
 * Auditoria de som (11/11): mede, nao muda nada. Renderiza cada cue de cada sons.json com a MESMA cadeia do
 * preparar.mjs (regras globais incluidas), soma por familia (voz / musica / efeitos) e imprime:
 *   - por trecho: nivel da voz, da musica e dos efeitos nas janelas de fala, pico antes do limitador, tempo acima de 0.95
 *   - janelas em que musica + efeitos chegam perto da voz (fala encoberta)
 *   - por efeito: pico, quanto fica abaixo/acima da voz, atraso do pico, se e cortado no fim do trecho, rajadas
 *   - as 10 emendas: nivel da cama (musica + ambiente) antes e depois do corte
 * Uso: bun videos/na-hora-do-almoco/kit/auditoria-som.mjs [--json saida.json] [XX ...] [--serie XX ...]
 *   --serie: imprime tambem o nivel de cada familia a cada 0,5 s nesses trechos
 * Tempos "g" = tempo no video final; "l" = tempo local do trecho. Niveis em dBFS (RMS) antes do loudnorm do montar.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KIT = dirname(fileURLToPath(import.meta.url));
const OUT = join(KIT, '..', 'output');
const PROJ = 'D:/YT/Matheus (Alves)/hora do armoco';
const ALIAS = {
  '@sfx/': 'D:/YT/!Assets/PACK - EFEITOS SONOROS/',
  '@sw/': 'D:/YT/!Assets/Swoosh effects/',
  '@mus/': 'D:/YT/!Assets/Musicas/',
  '@clipe/': join(PROJ, '03-clipe-belchior') + '/',
  '@camadas/': join(PROJ, '05-camadas-prontas') + '/',
};
const ORDEM = ['01', '02', '03', '04', '05', '06', '61', '07', '08', '09', '10'];
const SR = 48000;
const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const iSerie = args.indexOf('--serie');
const serie = iSerie >= 0 ? args.slice(iSerie + 1).filter((a) => /^\d\d$/.test(a)) : [];
const pedidos = args.slice(0, iSerie >= 0 ? iSerie : args.length).filter((a) => /^\d\d$/.test(a));
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -120);
const f1 = (x) => (x <= -119 ? '  -inf' : x.toFixed(1).padStart(6));
const mmss = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

const durCache = new Map();
const durDe = (file) => {
  if (!durCache.has(file)) {
    const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    durCache.set(file, parseFloat(p.stdout) || 0);
  }
  return durCache.get(file);
};
const envExpr = (env) => {
  let e = String(env[env.length - 1][1]);
  for (let i = env.length - 2; i >= 0; i--) {
    const [t0, g0] = env[i], [t1, g1] = env[i + 1];
    e = `if(lt(t,${t1}),${g0}+(${g1 - g0})*(t-${t0})/${Math.max(0.001, t1 - t0)},${e})`;
  }
  return `if(lt(t,${env[0][0]}),${env[0][1]},${e})`;
};
const ehSfx = (f) => f.startsWith('@sfx/') || f.startsWith('@sw/');
const ehMus = (f) => f.startsWith('@clipe/') || f.startsWith('@mus/');
const familia = (c) => (c.file === '@narr' ? 'voz' : /Windy Desert|Room Tone|Ambien/i.test(c.file) ? 'amb' : ehSfx(c.file) ? 'sfx' : 'mus');

// mesmas regras globais do preparar.mjs
function cuesDoTrecho(t) {
  const trecho = join(OUT, `trecho-${t}`);
  const sons = JSON.parse(readFileSync(join(trecho, 'sons.json'), 'utf8'));
  const resolve = (f) => {
    if (f === '@narr') return join(trecho, 'midia', 'narracao.wav');
    for (const [k, v] of Object.entries(ALIAS)) if (f.startsWith(k)) return v + f.slice(k.length);
    return f;
  };
  let ultimoRumble = -9;
  const cues = sons.cues.map((c, idx) => ({ ...c, idx })).filter((c) => {
    if (!/Low End Rumble 01/.test(c.file)) return true;
    if ((c.at || 0) - ultimoRumble < 1.5) return false;
    ultimoRumble = c.at || 0;
    return true;
  }).map((c0) => {
    const c = { ...c0, ganhoJson: c0.gain || 0 };
    const file = resolve(c.file);
    c.path = file;
    c.durArquivo = durDe(file);
    const sobra = () => Math.max(0.1, Math.min(durDe(file) - (c.from || 0), sons.dur - (c.at || 0)));
    c.lenJson = c0.len;
    if (ehSfx(c.file)) {
      c.gain = (c.gain || 0) - 4;
      if (!c.fadeIn) c.fadeIn = 0.04;
      if (!c.len) c.len = sobra();
      if (!c.fadeOut) c.fadeOut = Math.min(0.25, c.len * 0.5);
    } else if (ehMus(c.file)) {
      if (!c.len) c.len = sobra();
      const continua = (c.at || 0) === 0 && (c.from || 0) > 0;
      if (!continua) c.fadeIn = Math.max(c.fadeIn || 0, 1.2);
      const segue = (c.at || 0) + c.len >= sons.dur - 0.05;
      if (!segue) c.fadeOut = Math.max(c.fadeOut || 0, 1.5);
    }
    return c;
  });
  return { sons, cues, trecho };
}

function renderCue(c, dur) {
  const f = ['aformat=sample_rates=48000:channel_layouts=stereo'];
  if (c.from || c.len) f.push(`atrim=start=${c.from || 0}${c.len ? `:duration=${c.len}` : ''}`, 'asetpts=PTS-STARTPTS');
  if (c.fadeIn) f.push(`afade=t=in:d=${c.fadeIn}`);
  if (c.fadeOut && c.len) f.push(`afade=t=out:st=${Math.max(0, c.len - c.fadeOut)}:d=${c.fadeOut}`);
  if (c.gain) f.push(`volume=${c.gain}dB`);
  const ms = Math.round((c.at || 0) * 1000);
  if (ms > 0) f.push(`adelay=${ms}|${ms}`);
  if (c.env) f.push(`volume='pow(10,(${envExpr(c.env)})/20)':eval=frame`);
  f.push('apad'); // sem atrim=duration aqui: neste ffmpeg, atrim depois de adelay devolve o som sem o atraso; o -t corta
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', c.path, '-af', f.join(','), '-t', String(dur), '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg falhou em ${c.file}: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4));
}

// rms (dB) de um buffer estereo intercalado entre t0 e t1 (s)
function rms(buf, t0, t1) {
  const a = Math.max(0, Math.floor(t0 * SR)) * 2, b = Math.min(buf.length, Math.floor(t1 * SR) * 2);
  if (b <= a) return -120;
  let s = 0;
  for (let i = a; i < b; i++) s += buf[i] * buf[i];
  return db(Math.sqrt(s / (b - a)));
}
function rmsJanelas(buf, janelas) {
  let s = 0, n = 0;
  for (const [t0, t1] of janelas) {
    const a = Math.max(0, Math.floor(t0 * SR)) * 2, b = Math.min(buf.length, Math.floor(t1 * SR) * 2);
    for (let i = a; i < b; i++) s += buf[i] * buf[i];
    n += Math.max(0, b - a);
  }
  return n ? db(Math.sqrt(s / n)) : -120;
}
function pico(buf, t0 = 0, t1 = Infinity) {
  const a = Math.max(0, Math.floor(t0 * SR)) * 2, b = Math.min(buf.length, Math.floor(Math.min(t1, buf.length / 2 / SR) * SR) * 2);
  let m = 0, im = a;
  for (let i = a; i < b; i++) { const v = Math.abs(buf[i]); if (v > m) { m = v; im = i; } }
  return { v: m, t: im / 2 / SR };
}
// loudness BS.1770 (K-weighting, 48 kHz): energia por bloco de 100 ms, somando os 2 canais
function blocosK(buf) {
  const nb = Math.floor(buf.length / 2 / 4800), out = new Float64Array(nb);
  const z = [[0, 0, 0, 0], [0, 0, 0, 0]]; // por canal: estados dos 2 biquads (forma direta II transposta)
  for (let b = 0; b < nb; b++) {
    let e = 0;
    for (let k = 0; k < 4800; k++) for (let ch = 0; ch < 2; ch++) {
      const x = buf[(b * 4800 + k) * 2 + ch], q = z[ch];
      const y1 = 1.53512485958697 * x + q[0]; q[0] = -2.69169618940638 * x + 1.69065929318241 * y1 + q[1]; q[1] = 1.19839281085285 * x - 0.73248077421585 * y1;
      const y2 = y1 + q[2]; q[2] = -2 * y1 + 1.99004745483398 * y2 + q[3]; q[3] = y1 - 0.99007225036621 * y2;
      e += y2 * y2;
    }
    out[b] = e / 4800;
  }
  return out;
}
const lk = (e) => (e > 1e-12 ? -0.691 + 10 * Math.log10(e) : -120);
const momK = (bl, i) => { let e = 0, n = 0; for (let k = Math.max(0, i - 3); k <= i && k < bl.length; k++) { e += bl[k]; n++; } return n ? e / n : 0; }; // 400 ms terminando no bloco i
function integradoK(bl) { // com os dois portoes da norma (-70 absoluto, -10 relativo)
  const ms = []; for (let i = 3; i < bl.length; i++) ms.push(momK(bl, i));
  const a = ms.filter((e) => lk(e) > -70); if (!a.length) return -120;
  const rel = lk(a.reduce((x, y) => x + y, 0) / a.length) - 10;
  const b = a.filter((e) => lk(e) > rel);
  return b.length ? lk(b.reduce((x, y) => x + y, 0) / b.length) : -120;
}
const mediaK = (bl, janelas) => { let e = 0, n = 0; for (const [t0, t1] of janelas) for (let i = Math.max(0, Math.floor(t0 * 10)); i < Math.min(bl.length, Math.ceil(t1 * 10)); i++) { e += bl[i]; n++; } return n ? lk(e / n) : -120; };
const maxMomK = (bl) => { let m = 0; for (let i = 0; i < bl.length; i++) m = Math.max(m, momK(bl, i)); return lk(m); };
const soma = (dst, src) => { for (let i = 0; i < src.length && i < dst.length; i++) dst[i] += src[i]; };

// tempos de eventos visuais: numeros de tempo das timelines + data-start dos clips
function eventosVisuais(t) {
  const hf = join(OUT, `trecho-${t}`, 'hf');
  const ev = new Set();
  const files = [join(hf, 'index.html'), ...readdirSync(join(hf, 'compositions')).filter((f) => f.endsWith('.html')).map((f) => join(hf, 'compositions', f))];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/data-start="([\d.]+)"/g)) ev.add(Number(m[1]));
    const js = src.slice(src.indexOf('<script'));
    // ultimo argumento numerico de tl.to/fromTo/set e segundo/terceiro argumento dos helpers A.xxx(tl, el, AT, ...)
    for (const m of js.matchAll(/\},\s*([\d.]+)\s*\)/g)) ev.add(Number(m[1]));
    for (const m of js.matchAll(/A\.\w+\(tl,[^,\n]+,\s*(?:\[[^\]]*\],\s*)?([\d.]+)\s*[,)]/g)) ev.add(Number(m[1]));
    for (const m of js.matchAll(/A\.\w+\(tl,\s*null,\s*\[[^\]]*\],\s*([\d.]+)/g)) ev.add(Number(m[1]));
    for (const m of js.matchAll(/(?:entra|sai|corte|flash|cut)\w*\([^\n;]*?,\s*([\d.]+)\s*[,)]/g)) ev.add(Number(m[1]));
    for (const m of js.matchAll(/\[\s*((?:[\d.]+\s*,\s*)+[\d.]+)\s*\]/g)) for (const x of m[1].split(',')) { const v = Number(x); if (v > 0.2) ev.add(v); }
  }
  return [...ev].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
}

const rel = { trechos: {}, emendas: [] };
let g0 = 0;
const borda = {}; // cama (mus+amb) no comeco e no fim de cada trecho
for (const t of ORDEM) {
  const { sons, cues } = cuesDoTrecho(t);
  const dur = sons.dur;
  const ini = g0; g0 += dur;
  if (pedidos.length && !pedidos.includes(t)) { continue; }
  const N = Math.round(dur * SR) * 2;
  const st = { voz: new Float32Array(N), mus: new Float32Array(N), sfx: new Float32Array(N), amb: new Float32Array(N) };
  const porCue = [];
  for (const c of cues) {
    const buf = renderCue(c, dur);
    const fam = familia(c);
    soma(st[fam], buf);
    if (fam === 'sfx' || fam === 'amb') {
      const p = pico(buf);
      // inicio audivel: primeiro instante acima de pico-20 dB
      let ini20 = c.at || 0;
      const lim = p.v * 0.1;
      for (let i = Math.floor((c.at || 0) * SR) * 2; i < buf.length; i++) if (Math.abs(buf[i]) >= lim) { ini20 = i / 2 / SR; break; }
      const fim = (c.at || 0) + c.len;
      const cortado = c.durArquivo - (c.from || 0) > sons.dur - (c.at || 0) + 0.05 && !c.lenJson; // o trecho acaba antes do som
      const nivelNoFim = rms(buf, dur - 0.08, dur);
      porCue.push({ idx: c.idx, fam, file: c.file.split('/').pop(), at: c.at || 0, len: c.len, gain: c.gain, lufsMax: maxMomK(blocosK(buf)), pico: db(p.v), tPico: p.t, ini20, fim, cortado, nivelNoFim, rmsCue: rms(buf, c.at || 0, Math.min(dur, fim)) });
    }
    if (fam === 'mus') porCue.push({ idx: c.idx, fam, file: c.file.split('/').pop(), at: c.at || 0, len: c.len, gain: c.gain || 0, rmsCue: rms(buf, c.at || 0, Math.min(dur, (c.at || 0) + c.len)), pico: db(pico(buf).v) });
  }
  const mix = new Float32Array(N); for (const k of Object.keys(st)) soma(mix, st[k]);
  const cama = new Float32Array(N); soma(cama, st.mus); soma(cama, st.amb);
  const resto = new Float32Array(N); soma(resto, st.mus); soma(resto, st.amb); soma(resto, st.sfx);

  // janelas de fala
  let palavras = [];
  try { palavras = JSON.parse(readFileSync(join(OUT, `trecho-${t}`, 'midia', 'narracao.json'), 'utf8')); } catch { /* sem narracao */ }
  // narracao.json esta no tempo do ARQUIVO da narracao: passa para o tempo do trecho pelas cues @narr (at, from, len)
  { const nc = cues.filter((c) => c.file === '@narr'); palavras = palavras.map((w) => { const c = nc.find((c) => w.start >= (c.from || 0) - 0.01 && (!c.len || w.start < (c.from || 0) + c.len)) || nc[0]; const d = c ? (c.at || 0) - (c.from || 0) : 0; return { ...w, start: w.start + d, end: w.end + d }; }); }
  const fala = [];
  for (const w of palavras) {
    if (fala.length && w.start - fala[fala.length - 1][1] < 0.35) fala[fala.length - 1][1] = Math.max(fala[fala.length - 1][1], w.end);
    else fala.push([w.start, w.end]);
  }
  const pausas = [];
  { let u = 0; for (const [a, b] of fala) { if (a - u >= 0.6) pausas.push([u + 0.1, a - 0.1]); u = b; } if (dur - u >= 0.6) pausas.push([u + 0.1, dur]); }

  { const real = join(OUT, `trecho-${t}`, 'hf', 'assets', 'audio', 'mix.wav'); if (args.includes('--nulo') && existsSync(real)) { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', real, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 }); const rb = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4)); let d = 0, m = 0; const n = Math.min(rb.length, mix.length); for (let i = 480; i < n; i++) { const e = rb[i] - mix[i - 480]; d += e * e; m += rb[i] * rb[i]; } /* o alimiter do preparar atrasa o mix 5 ms (240 amostras x 2 canais) */ console.log(`  nulo contra mix.wav: residuo ${db(Math.sqrt(d / n)).toFixed(1)} dBFS (mix real ${db(Math.sqrt(m / n)).toFixed(1)})`); } }
  const pm = pico(mix);
  let acima = 0; for (let i = 0; i < mix.length; i += 2) if (Math.abs(mix[i]) > 0.95 || Math.abs(mix[i + 1]) > 0.95) acima++;
  const R = {
    ini, dur,
    voz: rmsJanelas(st.voz, fala), vozPico: db(pico(st.voz).v),
    musFala: rmsJanelas(st.mus, fala), musPausa: rmsJanelas(st.mus, pausas),
    sfxFala: rmsJanelas(st.sfx, fala), sfxPico: db(pico(st.sfx).v), ambTudo: rms(st.amb, 0, dur),
    mixRms: rms(mix, 0, dur), mixPico: db(pm.v), mixPicoT: pm.t, acima095ms: (acima / SR) * 1000,
    semMusica: [], encoberta: [], cues: porCue, fala,
  };

  // loudness (LUFS): voz inteira, musica e efeitos nas janelas de fala
  const K = { voz: blocosK(st.voz), mus: blocosK(st.mus), sfx: blocosK(st.sfx), cama: blocosK(cama), resto: blocosK(resto), mix: blocosK(mix) };
  R.vozLufs = integradoK(K.voz); R.mixLufs = integradoK(K.mix);
  R.musFalaLufs = mediaK(K.mus, fala); R.camaFalaLufs = mediaK(K.cama, fala); R.sfxFalaLufs = mediaK(K.sfx, fala); R.camaPausaLufs = mediaK(K.cama, pausas);
  for (const c of porCue) if (c.lufsMax != null) c.margem = R.vozLufs - c.lufsMax;
  // fala encoberta (loudness): blocos de fala em que o resto (musica + ambiente + efeitos) chega a menos de 4 LU da voz
  R.encobertaK = [];
  for (let i = 3; i < K.voz.length; i++) {
    const tt = i / 10, v = lk(momK(K.voz, i)), r = lk(momK(K.resto, i));
    if (!fala.some(([a, b]) => tt >= a + 0.3 && tt <= b) || v < R.vozLufs - 8 || v - r >= 4) continue;
    const quem = momK(K.sfx, i) > momK(K.cama, i) ? 'sfx' : 'cama';
    const u = R.encobertaK[R.encobertaK.length - 1];
    if (u && tt - u.b <= 0.25 && u.quem === quem) { u.b = tt; if (v - r < u.pior) { u.pior = v - r; u.v = v; u.r = r; } }
    else R.encobertaK.push({ a: tt - 0.4, b: tt, pior: v - r, v, r, quem });
  }
  R.encobertaK = R.encobertaK.filter((e) => e.b - e.a >= 0.6);

  // trechos sem cama (musica+ambiente abaixo de -60 dBFS por 2 s ou mais)
  { let a = null; for (let x = 0; x < dur; x += 0.25) { const q = rms(cama, x, x + 0.25) < -60; if (q && a === null) a = x; if ((!q || x + 0.25 >= dur) && a !== null) { const b = q ? dur : x; if (b - a >= 2) R.semMusica.push([a, b]); a = null; } } }

  // fala encoberta: janelas de 0.4 s dentro da fala em que (musica+amb+sfx) fica a menos de 9 dB da voz
  for (const [a, b] of fala) for (let x = a; x + 0.2 <= b; x += 0.4) {
    const x1 = Math.min(b, x + 0.4);
    const v = rms(st.voz, x, x1), r = rms(resto, x, x1);
    if (v > -34 && v - r < 8) {
      const quem = rms(st.sfx, x, x1) > rms(cama, x, x1) ? 'sfx' : 'cama';
      const ult = R.encoberta[R.encoberta.length - 1];
      if (ult && x - ult.b < 0.45 && ult.quem === quem) { ult.b = x1; if (v - r < ult.pior) { ult.pior = v - r; ult.v = v; ult.r = r; } }
      else R.encoberta.push({ a: x, b: x1, pior: v - r, quem, v, r });
    }
  }
  // sincronia: pico de cada sfx contra o evento visual mais proximo
  const ev = eventosVisuais(t);
  for (const c of porCue.filter((c) => c.fam === 'sfx')) {
    let melhor = null;
    for (const e of ev) if (melhor === null || Math.abs(e - c.tPico) < Math.abs(melhor - c.tPico)) melhor = e;
    c.evento = melhor; c.desvio = melhor === null ? null : c.tPico - melhor;
    let m2 = null;
    for (const e of ev) if (m2 === null || Math.abs(e - c.ini20) < Math.abs(m2 - c.ini20)) m2 = e;
    c.desvioIni = m2 === null ? null : c.ini20 - m2;
    // nivel do resto (voz + cama) em volta do pico: efeito inaudivel se o pico fica muito abaixo
    const outros = new Float32Array(0);
    c.vozNoPico = rms(st.voz, c.tPico - 0.15, c.tPico + 0.15);
    c.camaNoPico = rms(cama, c.tPico - 0.15, c.tPico + 0.15);
  }
  borda[t] = {
    camaIni: rms(cama, 0, 0.3), camaFim: rms(cama, dur - 0.3, dur), camaIni0: rms(cama, 0, 0.06), camaFim0: rms(cama, dur - 0.06, dur), camaIni1: rms(cama, 0.3, 1.3), camaFim1: rms(cama, dur - 1.3, dur - 0.3),
    mixIni: rms(mix, 0, 1), mixFim: rms(mix, dur - 1, dur), sfxFim: rms(st.sfx, dur - 0.1, dur), sfxIni: rms(st.sfx, 0, 0.1),
    vozFim: rms(st.voz, dur - 0.3, dur), vozIni: rms(st.voz, 0, 0.3),
  };
  rel.trechos[t] = R;

  console.log(`\n=== trecho-${t}  g ${mmss(ini)}-${mmss(ini + dur)}  (${dur} s)`);
  console.log(`  voz ${f1(R.voz)} dB (pico ${f1(R.vozPico)}) | musica na fala ${f1(R.musFala)}, nas pausas ${f1(R.musPausa)} | sfx na fala ${f1(R.sfxFala)}, pico ${f1(R.sfxPico)} | amb ${f1(R.ambTudo)}`);
  console.log(`  mix sem limitador: rms ${f1(R.mixRms)}, pico ${f1(R.mixPico)} dBFS em l ${R.mixPicoT.toFixed(2)} | acima de 0.95: ${R.acima095ms.toFixed(1)} ms`);
  if (R.semMusica.length) console.log(`  sem cama (>= 2 s): ${R.semMusica.map(([a, b]) => `l ${a.toFixed(1)}-${b.toFixed(1)} (g ${mmss(ini + a)}-${mmss(ini + b)})`).join(', ')}`);
  console.log(`  LUFS: voz ${f1(R.vozLufs)} | mix ${f1(R.mixLufs)} | na fala: musica ${f1(R.musFalaLufs)} (voz - cama = ${(R.vozLufs - R.camaFalaLufs).toFixed(1)} LU), efeitos ${f1(R.sfxFalaLufs)} | cama nas pausas ${f1(R.camaPausaLufs)}`);
  for (const e of R.encobertaK) console.log(`  fala encoberta: l ${e.a.toFixed(1)}-${e.b.toFixed(1)} (g ${mmss(ini + e.a)}, ${(e.b - e.a).toFixed(1)} s)  voz ${e.v.toFixed(0)} resto ${e.r.toFixed(0)} LUFS (dif ${e.pior.toFixed(1)})  por ${e.quem}`);
  for (const c of porCue.filter((c) => c.fam === 'sfx' && c.margem < 5).sort((a, b) => a.margem - b.margem)) console.log(`  efeito alto: l ${c.at.toFixed(2)} (g ${mmss(ini + c.at)})  ${c.lufsMax.toFixed(1)} LUFS de pico momentaneo = voz ${c.margem >= 0 ? '-' : '+'}${Math.abs(c.margem).toFixed(1)} LU  ${c.file}`);
  if (serie.includes(t)) for (let x = 0; x < dur; x += 0.5) console.log(`    l ${x.toFixed(1).padStart(5)} g ${mmss(ini + x)}  voz ${f1(rms(st.voz, x, x + 0.5))}  mus ${f1(rms(st.mus, x, x + 0.5))}  sfx ${f1(rms(st.sfx, x, x + 0.5))}  amb ${f1(rms(st.amb, x, x + 0.5))}  mix ${f1(rms(mix, x, x + 0.5))}  | LUFS voz ${f1(lk(momK(K.voz, Math.round(x * 10) + 4)))} cama ${f1(lk(momK(K.cama, Math.round(x * 10) + 4)))} sfx ${f1(lk(momK(K.sfx, Math.round(x * 10) + 4)))}`);
}

// emendas
const ts = ORDEM.filter((t) => borda[t]);
console.log('\n=== emendas (cama = musica + ambiente, RMS)');
for (let i = 0; i + 1 < ts.length; i++) {
  const a = borda[ts[i]], b = borda[ts[i + 1]];
  if (ORDEM.indexOf(ts[i + 1]) !== ORDEM.indexOf(ts[i]) + 1) continue;
  const e = { de: ts[i], para: ts[i + 1], g: rel.trechos[ts[i + 1]].ini, camaFim: a.camaFim, camaIni: b.camaIni, camaFim1: a.camaFim1, camaIni1: b.camaIni1, sfxFim: a.sfxFim, sfxIni: b.sfxIni, mixFim: a.mixFim, mixIni: b.mixIni };
  rel.emendas.push(e);
  const degrau = Math.max(a.camaFim0, b.camaIni0) > -55 ? Math.abs(Math.max(-70, a.camaFim0) - Math.max(-70, b.camaIni0)) : 0; // ultimos 60 ms contra os primeiros 60 ms
  console.log(`  ${e.de}->${e.para} g ${mmss(e.g)}: cama ${f1(a.camaFim1)} > ${f1(a.camaFim)} | ${f1(b.camaIni)} > ${f1(b.camaIni1)}   sfx no corte ${f1(a.sfxFim)} | ${f1(b.sfxIni)}   mix 1 s ${f1(a.mixFim)} | ${f1(b.mixIni)}${degrau > 6 ? `   <-- degrau de ${degrau.toFixed(0)} dB` : ''}`);
}
if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(rel, (k, v) => (v instanceof Float32Array ? undefined : v), 1)); console.log('json:', jsonOut); }
