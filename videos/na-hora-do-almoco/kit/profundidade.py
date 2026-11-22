"""Gera mapas de profundidade (Depth Anything V2) para as fotos 3D.

Uso: python -I profundidade.py <pasta_entrada> <pasta_saida> [arquivo1.png arquivo2.png ...]
Saida: <nome>-depth.png em tons de cinza (branco = perto), mesmo tamanho da imagem, levemente suavizado
para o parallax nao rasgar as bordas.
"""
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter
from transformers import pipeline

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
names = sys.argv[3:] or sorted(p.name for p in src.glob('*.png'))

device = 0 if torch.cuda.is_available() else -1
pipe = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Base-hf', device=device)

for name in names:
    out = dst / (Path(name).stem + '-depth.png')
    if out.exists():
        print('ja existe', out.name)
        continue
    img = Image.open(src / name).convert('RGB')
    d = pipe(img)['predicted_depth']
    d = torch.nn.functional.interpolate(d[None] if d.dim() == 3 else d[None, None], size=img.size[::-1], mode='bicubic', align_corners=False)
    d = d.squeeze().cpu().numpy()
    lo, hi = np.percentile(d, 1), np.percentile(d, 99)
    d = np.clip((d - lo) / (hi - lo + 1e-6), 0, 1)
    im = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=max(2, img.size[0] // 400)))
    im.save(out)
    print('ok', out.name)
