#!/usr/bin/env bash
# Comando único de render.
#   ./render.sh preview            -> saida/preview.mp4      (540x960, 12 fps)
#   ./render.sh final              -> saida/video_final.mp4  (1080x1920, 30 fps)
#   ./render.sh final cena 3       -> refaz SÓ a cena 3 e remonta o vídeo final
#   ./render.sh audio [final|preview] -> só remixa o áudio (após trocar MP3s do ElevenLabs ou tempos no falas.md)
# O progresso fica salvo em frames/<modo>/cenaN/ : se cair, é só rodar de novo que continua de onde parou.
set -euo pipefail
cd "$(dirname "$0")"

MODO="${1:-preview}"
WORKERS="${WORKERS:-2}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"

if [[ "$MODO" == "audio" ]]; then
  ALVO="${2:-final}"
  python3 scripts/parse_falas.py; python3 scripts/gerar_legendas.py
  python3 scripts/gerar_trilha.py
  [[ "$ALVO" == "final" ]] && OUT=saida/video_final.mp4 || OUT=saida/preview.mp4
  python3 scripts/mixar.py "saida/$ALVO/video_sem_audio.mp4" "$OUT"
  exit 0
fi
[[ "$MODO" == "final" || "$MODO" == "preview" ]] || { echo "uso: ./render.sh preview|final [cena N] | audio [final|preview]"; exit 1; }

if [[ "$MODO" == "final" ]]; then FPS=30; CRF=22; MAXR=5M; OUT=saida/video_final.mp4
else FPS=12; CRF=27; MAXR=1500k; OUT=saida/preview.mp4; fi

CENAS="1 2 3 4 5 6 7"
if [[ "${2:-}" == "cena" ]]; then
  N="${3:?informe o número da cena (1-7)}"
  echo ">> refazendo só a cena $N ($MODO)"
  rm -rf "frames/$MODO/cena$N" "saida/$MODO/cenas/cena$N.mp4"
  CENAS="$N"
fi

mkdir -p "saida/$MODO/cenas" audio
python3 scripts/parse_falas.py; python3 scripts/gerar_legendas.py

for c in $CENAS; do
  node scripts/render.js --modo "$MODO" --cena "$c" --workers "$WORKERS"
  clip="saida/$MODO/cenas/cena$c.mp4"
  if [[ ! -f "$clip" || -n "$(find "frames/$MODO/cena$c" -newer "$clip" -name '*.jpg' -print -quit)" ]]; then
    echo ">> codificando cena $c"
    ffmpeg -y -loglevel error -framerate "$FPS" -start_number 0 -i "frames/$MODO/cena$c/%05d.jpg" \
      -c:v libx264 -preset medium -crf "$CRF" -maxrate "$MAXR" -bufsize 10M -pix_fmt yuv420p -g $((FPS*2)) \
      -r "$FPS" "$clip"
  fi
done

# junta todas as cenas (as que já existirem) na ordem
LISTA="saida/$MODO/lista.txt"; : > "$LISTA"
for c in 1 2 3 4 5 6 7; do
  [[ -f "saida/$MODO/cenas/cena$c.mp4" ]] || { echo "falta a cena $c — rode ./render.sh $MODO"; exit 1; }
  echo "file 'cenas/cena$c.mp4'" >> "$LISTA"
done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LISTA" -c copy "saida/$MODO/video_sem_audio.mp4"

python3 scripts/gerar_trilha.py
python3 scripts/mixar.py "saida/$MODO/video_sem_audio.mp4" "$OUT"
ls -lh "$OUT"
