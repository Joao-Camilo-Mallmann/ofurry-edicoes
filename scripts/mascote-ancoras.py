"""Ancora fixa do Furry: mede onde fica o corpo em cada loop e grava o deslocamento para alinhar todas as poses.

Joao, 24/11/2026: "garante que ele se enquadra sempre no meio perfeitamente... parece que ele fica um pouco pro lado".
Os loops sao 1920x1080 com o Furry cortado na base do quadro, todos na mesma escala, mas cada pose tem o corpo num
lugar diferente (ate 163 px de diferenca). A referencia e o centro das CALCAS logo acima da borda de baixo (y=1040),
que nao muda com braco, rabo ou cabeca. O build soma `dx` (em px do loop, escalado para a altura usada) a cada pose.

Uso: python -I scripts/mascote-ancoras.py   (rode de novo quando entrar uma pose nova em public/mascote/)
"""
import glob, json, os, subprocess
import numpy as np

PASTA = os.path.join(os.path.dirname(__file__), '..', 'public', 'mascote')
W, H, Y = 1920, 1080, 1040
saida = {}
for f in sorted(glob.glob(os.path.join(PASTA, '*.webm'))):
    nome = os.path.splitext(os.path.basename(f))[0]
    b = subprocess.run(['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], capture_output=True).stdout
    rgba = np.frombuffer(b, dtype=np.uint8).reshape(H, W, 4)
    calca = (rgba[:, :, 3] > 40) & (rgba[:, :, :3].max(2) < 70)  # opaco e escuro: calca/jaqueta, sem pelo nem rabo
    xs = np.nonzero(calca[Y - 6:Y + 6].any(0))[0]
    blocos = np.split(xs, np.nonzero(np.diff(xs) > 8)[0] + 1)
    bl = max(blocos, key=len)
    centro = (bl[0] + bl[-1]) / 2
    saida[nome] = {'centro': round(float(centro), 1), 'dx': round(float(W / 2 - centro), 1)}
    print(f'{nome:12s} centro das pernas {centro:7.1f}  dx {W / 2 - centro:+7.1f}')
json.dump(saida, open(os.path.join(PASTA, 'ancoras.json'), 'w'), indent=1)
