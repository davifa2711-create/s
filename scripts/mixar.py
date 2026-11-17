#!/usr/bin/env python3
"""Mixa trilha gerada + vozes do ElevenLabs (audio/fala_*.mp3) nos tempos do falas.md e junta ao vídeo.
Uso: mixar.py <video_sem_audio.mp4> <saida.mp4> [--crf N]
Arquivos de voz ausentes viram silêncio (são simplesmente ignorados)."""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
video, saida = sys.argv[1], sys.argv[2]
falas = json.load(open(os.path.join(ROOT, "scripts", "falas.json"), encoding="utf-8"))
trilha = os.path.join(ROOT, "audio", "gerado", "trilha.wav")

inputs = ["-i", video, "-i", trilha]
filtros, vozes = [], []
idx = 2
for f in falas:
    arq = os.path.join(ROOT, "audio", f["arquivo"])
    if not os.path.isfile(arq) or os.path.getsize(arq) == 0:
        print(f"  [aviso] {f['arquivo']} não encontrado -> silêncio")
        continue
    ms = int(round(f["inicio"] * 1000))
    inputs += ["-i", arq]
    filtros.append(f"[{idx}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms},volume=1.6[v{idx}]")
    vozes.append(f"[v{idx}]"); idx += 1
    print(f"  voz: {f['arquivo']} em {f['inicio']}s")

if vozes:
    filtros.append(f"{''.join(vozes)}amix=inputs={len(vozes)}:normalize=0:duration=longest,apad[vz]")
    filtros.append("[vz]asplit=2[vz1][vz2]")
    filtros.append("[1:a]volume=0.8[mus]")
    # trilha abaixa quando alguém fala (ducking)
    filtros.append("[mus][vz1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck]")
    filtros.append("[duck][vz2]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[aout]")
else:
    filtros.append("[1:a]volume=0.9,alimiter=limit=0.95[aout]")

cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filtros),
       "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
       "-t", "60", "-movflags", "+faststart", saida]
subprocess.run(cmd, check=True)
print("ok:", saida)
