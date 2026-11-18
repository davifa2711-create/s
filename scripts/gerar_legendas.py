#!/usr/bin/env python3
"""Gera saida/legendas.srt (legenda PT-BR) e saida/legendas_original.srt (texto falado no idioma original) a partir do falas.md."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_falas import parse, ROOT


def ts(s):
    ms = int(round(s * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); sec, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


falas = parse(os.path.join(ROOT, "falas.md"))
os.makedirs(os.path.join(ROOT, "saida"), exist_ok=True)
for nome, campo in [("legendas.srt", "legenda"), ("legendas_original.srt", "texto")]:
    with open(os.path.join(ROOT, "saida", nome), "w", encoding="utf-8") as f:
        for i, x in enumerate(falas, 1):
            f.write(f"{i}\n{ts(x['inicio'])} --> {ts(x['fim'])}\n{x[campo]}\n\n")
    print("gerado: saida/" + nome)
