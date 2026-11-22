/**
 * Gera a camada "brolls" de cada trecho a partir de kit/brolls.json: fotos 3D (parallax pelo mapa de
 * profundidade) por cima do video do clipe e por baixo dos textos.
 *
 * Uso: bun videos/na-hora-do-almoco/kit/brolls.mjs        (todos os trechos da lista)
 *      bun videos/na-hora-do-almoco/kit/brolls.mjs 08 09  (so esses)
 * "escurecer": 0.6-0.9 deixa a foto mais escura para o texto por cima ter contraste.
 * Imagem que ainda nao existe em 06-montagem/assets/agy e pulada (aviso). Depois rode o preparar.mjs do trecho,
 * que copia as imagens e os mapas de profundidade.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = dirname(fileURLToPath(import.meta.url));
const VIDEO = join(KIT, '..');
const AGY = 'D:/YT/Matheus (Alves)/hora do armoco/06-montagem/assets/agy';
const lista = JSON.parse(readFileSync(join(KIT, 'brolls.json'), 'utf8'));
const pedidos = process.argv.slice(2).map((t) => t.padStart(2, '0'));

// movimentos de camera (t em segundos desde o inicio do plano; o ultimo key usa a duracao do plano)
const CAMERAS = {
  push: (d) => [{ t: 0, zoom: 1.16, x: 0.02, px: -0.45, blurX: 0.05 }, { t: 0.2, zoom: 1.08, blurX: 0, ease: 'expo.out' }, { t: d, zoom: 1.2, px: 0.45, ease: 'sine.inOut' }],
  pull: (d) => [{ t: 0, zoom: 1.3, x: -0.02, py: -0.35, blurX: 0.05 }, { t: 0.2, zoom: 1.22, blurX: 0, ease: 'expo.out' }, { t: d, zoom: 1.04, py: 0.35, ease: 'sine.inOut' }],
  '3d': (d) => [{ t: 0, zoom: 1.38, px: -0.9, py: 0.35, blurX: 0.04 }, { t: 0.25, zoom: 1.28, blurX: 0, ease: 'expo.out' }, { t: d, zoom: 1.02, px: 0.9, py: -0.35, ease: 'power1.inOut' }],
};

for (const [n, planos] of Object.entries(lista)) {
  if (n.startsWith('_') || (pedidos.length && !pedidos.includes(n))) continue;
  const hf = join(VIDEO, 'output', `trecho-${n}`, 'hf');
  const indexPath = join(hf, 'index.html');
  let index = readFileSync(indexPath, 'utf8');
  const dur = Number(index.match(/id="root"[^>]*data-duration="([\d.]+)"/)[1]);
  const ok = planos.filter((p) => { const tem = existsSync(join(AGY, p.img + '.png')); if (!tem) console.warn(`trecho-${n}: ${p.img} ainda nao existe, pulado`); return tem; });

  const canvases = ok.map((p, i) => `    <!-- ${p.momento} -->\n    <canvas id="b${n}-${i}" class="clip foto" data-start="${p.start}" data-duration="${p.dur}" data-track-index="${i}"></canvas>`).join('\n');
  const shots = ok.map((p, i) => `        { id: 'b${n}-${i}', img: '${p.img}', start: ${p.start}, dur: ${p.dur}, keys: ${JSON.stringify(CAMERAS[p.camera](p.dur))}${p.escurecer ? `, grade: { bright: ${p.escurecer} }` : ''} }`).join(',\n');
  const html = `<template>
  <!-- Gerado por kit/brolls.mjs a partir de kit/brolls.json. Nao edite a mao: mude a lista e rode o gerador. -->
  <style>
    #root { position: absolute; inset: 0; }
    #root .foto { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
  </style>
  <div id="root" data-composition-id="brolls" data-width="1920" data-height="1080">
${canvases}
  </div>
  <script>
    (function () {
      var tl = gsap.timeline({ paused: true });
      var A = window.Almoco;
      var shots = [
${shots}
      ];
      Promise.all(shots.map(function (s) {
        return A.photo(document.getElementById(s.id), { src: 'assets/img/' + s.img + '.png', depth: 'assets/depth/' + s.img + '-depth.png', grade: s.grade })
          .then(function (c) { A.camera(tl, c, s.start, s.dur, s.keys); });
      })).catch(function (e) { console.error(e); }).then(function () {
        tl.set({}, {}, ${dur});
        window.__timelines['brolls'] = tl;
      });
    })();
  </script>
</template>
`;
  writeFileSync(join(hf, 'compositions', 'brolls.html'), html);

  // camada no index: acima do video do clipe (cortes), abaixo dos textos
  if (!index.includes('id="brolls"')) {
    const zCortes = Number((index.match(/id="cortes"[^>]*z-index:(\d+)/) || [])[1] || 3);
    const host = `      <div id="brolls" data-composition-id="brolls" data-composition-src="compositions/brolls.html" data-start="0" data-duration="${dur}" data-track-index="20" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index:${zCortes + 1}" data-house-backdrop></div>\n`;
    index = index.replace(/(      <div id="textos")/, host + '$1');
    if (!index.includes('id="brolls"')) throw new Error(`trecho-${n}: nao achei onde encaixar a camada`);
    writeFileSync(indexPath, index);
  }
  console.log(`trecho-${n}: ${ok.length} B-rolls na camada brolls (${planos.length - ok.length} pulados)`);
}
