"""Alinha o Furry direto nos arquivos de origem (Joao, 24/11/2026: "mexe isso tambem nos videos originais para nao ter
problema no futuro, deixa ele ja alinhado desde sempre").

Para cada pose: mede o centro das calcas (a parte escura opaca logo acima da borda de baixo) e desloca o quadro inteiro
na horizontal para esse centro cair no meio da imagem. Mexe em:
  - D:/YT/!Assets/Furry/fox*_loop_fhd.webm (as animacoes originais; copia de seguranca em _originais-antes-do-alinhamento/)
  - public/mascote/*.webm do repo (copias usadas no build; o git guarda as versoes antigas)
Os PNG (desenho parado, 3000x3000) ficam como estao: o enquadramento deles e outro e eles nao vao para os videos.
Depois rode `python -I scripts/mascote-ancoras.py`: o deslocamento de cada pose deve ficar perto de zero.

Uso: python -I scripts/mascote-alinhar-originais.py [--so-medir]
"""
import glob, os, shutil, subprocess, sys
import numpy as np

ASSETS = 'D:/YT/!Assets/Furry'
REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'mascote')
BACKUP = os.path.join(ASSETS, '_originais-antes-do-alinhamento')
SO_MEDIR = '--so-medir' in sys.argv


def centro_calca(rgba, y_frac=1040 / 1080):
    h, w = rgba.shape[:2]
    y = int(h * y_frac)
    banda = rgba[max(0, y - int(h * 0.006)):y + int(h * 0.006)]
    calca = (banda[..., 3] > 40) & (banda[..., :3].max(2) < 70)
    xs = np.nonzero(calca.any(0))[0]
    blocos = np.split(xs, np.nonzero(np.diff(xs) > max(8, w // 240))[0] + 1)
    bl = max(blocos, key=len)
    return (bl[0] + bl[-1]) / 2, w


def quadro_webm(f):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(b, dtype=np.uint8).reshape(1080, 1920, 4)


def alinha_webm(f):
    c, w = centro_calca(quadro_webm(f))
    dx = round(w / 2 - c)
    print(f'{os.path.basename(f):24s} centro {c:7.1f} -> desloca {dx:+d} px')
    if SO_MEDIR or abs(dx) < 2:
        return
    pad = abs(dx)
    filtro = (f'pad={w + pad}:1080:{pad}:0:color=0x00000000,crop={w}:1080:0:0' if dx > 0
              else f'pad={w + pad}:1080:0:0:color=0x00000000,crop={w}:1080:{pad}:0')
    tmp = f + '.tmp.webm'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', f, '-vf', f'format=rgba,{filtro},format=yuva420p',
                    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '24', '-row-mt', '1', '-auto-alt-ref', '0', '-an', tmp], check=True)
    os.replace(tmp, f)




if not SO_MEDIR:
    os.makedirs(BACKUP, exist_ok=True)
    for f in glob.glob(os.path.join(ASSETS, 'fox*_loop_fhd.webm')):
        destino = os.path.join(BACKUP, os.path.basename(f))
        if not os.path.exists(destino):
            shutil.copy2(f, destino)
for f in sorted(glob.glob(os.path.join(ASSETS, 'fox*_loop_fhd.webm'))):
    alinha_webm(f)
# copias do repo: os loops novos sao os originais alinhados; os "antigo" so existem aqui
for n in range(1, 5):
    o = os.path.join(ASSETS, f'fox{n}_loop_fhd.webm')
    if os.path.exists(o) and not SO_MEDIR:
        shutil.copyfile(o, os.path.join(REPO, f'fox{n}.webm'))
for f in sorted(glob.glob(os.path.join(REPO, '*-antigo.webm'))):
    alinha_webm(f)
