#!/usr/bin/env python3
"""Monta folha de contato (grade) de imagens: folha.py saida.jpg img1 img2 ..."""
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = 270, 480; cols = min(6, len(ims)); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 18)), 'gray')
d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * (h + 18)
    sheet.paste(im.resize((w, h)), (x, y + 18)); d.text((x + 4, y + 3), f.split('/')[-1], fill='white')
sheet.save(out, quality=85)
