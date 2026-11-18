# E se um meteoro caísse na terra do Evangelista

Vídeo 3D vertical (1080x1920, 30 fps, 60 s), low-poly, renderizado só com CPU:
**Three.js dentro do Chromium headless (WebGL por software/SwiftShader)**, frame a frame, montado com ffmpeg.

- `saida/video_final.mp4` — vídeo final (H.264 + AAC)
- `saida/preview.mp4` — prévia rápida (540x960, 12 fps)
- `saida/legendas.srt` (PT-BR) e `saida/legendas_original.srt` (texto no idioma de cada fala) — também já vêm desenhadas no vídeo
- `saida/quadros/` — um quadro-chave de cada cena
- `saida/final/cenas/cenaN.mp4` + `saida/final/video_sem_audio.mp4` — clipes de cada cena (os frames já codificados). Com eles, `./render.sh audio` e `./render.sh final cena N` funcionam direto num clone novo
- `audio/gerado/trilha.wav` — trilha + efeitos sintetizados

Os frames JPG brutos (`frames/`, ~315 MB) não vão para o git; são recriados idênticos pelo `./render.sh` (cada frame depende só do tempo).

## Comandos
```bash
./render.sh preview          # prévia (~2 min)
./render.sh final            # vídeo final (~10–15 min)
./render.sh final cena 3     # refaz só a cena 3 e remonta o vídeo
./render.sh audio            # só refaz o áudio (trocou MP3s ou tempos) — segundos
```
Se o render cair no meio, rode o mesmo comando de novo: os frames prontos em `frames/` são reaproveitados.

## Trocar as vozes (ElevenLabs)
1. Gere as falas listadas em **`falas.md`** (texto, idioma e tempo de cada uma).
2. Salve em `audio/` com os nomes exatos: `fala_01_br.mp3`, `fala_02_us.mp3`, `fala_03_jp.mp3`, `fala_04_fr.mp3`, `fala_05_eg.mp3`, `fala_evangelista.mp3`, `fala_07_br.mp3`.
   Arquivo que faltar vira silêncio, sem erro.
3. Rode `./render.sh audio`. A voz entra no tempo da coluna "Entrada (s)". A trilha abaixa sozinha quando alguém fala.

Para mudar quando uma fala entra ou o texto da legenda, edite a tabela do `falas.md`:
- só o áudio mudou: `./render.sh audio`
- a legenda mudou (o texto é desenhado no vídeo): `./render.sh final cena N`, onde N é a cena da fala.

## Cenas (para `./render.sh final cena N`)
| N | Tempo | Conteúdo |
|---|-------|----------|
| 1 | 0–12 s | Parede de TVs (EUA, Brasil, Japão, França, Egito + radar), faixas de URGENTE |
| 2 | 12–20 s | Evangelista no sofá, levanta: "Essa missão é minha." |
| 3 | 20–28 s | Meteoro no céu, super pulo pelas nuvens, bicicleta em câmera lenta |
| 4 | 28–38 s | Meteoro cruza o sistema solar (Terra, Lua, Marte, Júpiter, Saturno) |
| 5 | 38–44 s | Meteoro acerta o Sol, explosão, escuridão e silêncio |
| 6 | 44–55 s | O PRIME: aura, chão rachando, coluna de luz, Sol reconstruído, Terra iluminada |
| 7 | 55–60 s | Plano final com a aura, Sol de volta, corte seco |

## Estrutura
- `scripts/cena.js`: toda a cena 3D (personagens, mundos, câmeras, título e legendas). Cada frame depende só do tempo `t`.
- `scripts/render.js`: abre o Chromium e salva os frames de uma cena em `frames/<modo>/cenaN/`.
- `scripts/gerar_trilha.py`: trilha e efeitos sintetizados com numpy, gerados em `audio/gerado/trilha.wav`.
- `scripts/mixar.py`: junta trilha, vozes e vídeo.
- `scripts/parse_falas.py`: lê `falas.md` e gera `scripts/falas.json`.

Requisitos: Node + Playwright (Chromium), Python 3 + numpy, ffmpeg. Three.js e a fonte (Inter Black, licença OFL) já estão em `scripts/vendor` e `scripts/fonts`, então não precisa de internet.
