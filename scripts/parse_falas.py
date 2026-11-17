#!/usr/bin/env python3
"""Lê falas.md (tabela) e gera scripts/falas.json usado pelo render (legendas) e pela mixagem."""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def parse(path):
    falas = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line.startswith("|") or line.startswith("|--") or "Arquivo" in line:
                continue
            cols = [c.strip() for c in line.strip("|").split("|")]
            if len(cols) < 9:
                continue
            try:
                falas.append({
                    "id": cols[0], "arquivo": cols[1], "idioma": cols[2], "cena": int(cols[3]),
                    "inicio": float(cols[4]), "fim": float(cols[5]), "quem": cols[6],
                    "texto": cols[7], "legenda": cols[8],
                })
            except ValueError:
                print("linha ignorada:", line, file=sys.stderr)
    return falas


if __name__ == "__main__":
    falas = parse(os.path.join(ROOT, "falas.md"))
    with open(os.path.join(ROOT, "scripts", "falas.json"), "w", encoding="utf-8") as f:
        json.dump(falas, f, ensure_ascii=False, indent=1)
    print(f"{len(falas)} falas lidas de falas.md")
