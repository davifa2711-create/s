# Falas — "E se um meteoro caísse na terra do Evangelista"

Gere cada fala no ElevenLabs e salve em `audio/` com o **nome exato** da coluna *Arquivo*.
Se um arquivo não existir, o vídeo é montado com silêncio no lugar (sem erro).

- **Entrada (s)**: momento em que o áudio começa no vídeo.
- **Fim legenda (s)**: até quando a legenda fica na tela.
- Tente manter as falas dos telejornais com **até ~2 s** (tom de jornal urgente, ritmo rápido) — elas podem se sobrepor um pouco, como num "caos de noticiários".
- Para mudar um tempo, edite a tabela e rode `./render.sh final` de novo (ou só `./render.sh audio` se mexeu apenas no áudio — veja o README).

| Nº | Arquivo | Idioma | Cena | Entrada (s) | Fim legenda (s) | Quem fala | Texto falado (gerar no ElevenLabs) | Legenda na tela (PT-BR) |
|----|---------|--------|------|-------------|-----------------|-----------|------------------------------------|-------------------------|
| 01 | fala_01_br.mp3 | Português (Brasil) | 1 | 1.8 | 3.6 | Jornal Brasil | Atenção: um meteoro gigante está em rota de colisão com a Terra! | BRASIL: Atenção: um meteoro gigante está em rota de colisão com a Terra! |
| 02 | fala_02_us.mp3 | Inglês (EUA) | 1 | 3.8 | 5.6 | Jornal EUA | Breaking news: a giant meteor is heading straight for Earth! | EUA: Urgente: um meteoro gigante vem direto para a Terra! |
| 03 | fala_03_jp.mp3 | Japonês | 1 | 5.8 | 7.6 | Jornal Japão | 速報です。巨大な隕石が地球に向かっています！ | JAPÃO: Urgente! Um meteoro gigante está indo em direção à Terra! |
| 04 | fala_04_fr.mp3 | Francês | 1 | 7.8 | 9.6 | Jornal França | Alerte : une météorite géante fonce droit sur la Terre ! | FRANÇA: Alerta: um meteoro gigante vem direto para a Terra! |
| 05 | fala_05_eg.mp3 | Árabe (Egito) | 1 | 9.8 | 11.6 | Jornal Egito | عاجل: نيزك ضخم يقترب من الأرض! | EGITO: Urgente: um meteoro enorme se aproxima da Terra! |
| 06 | fala_evangelista.mp3 | Português (Brasil) | 2 | 16.8 | 19.2 | Evangelista | Essa missão é minha. | Essa missão é minha. |
| 07 | fala_07_br.mp3 | Português (Brasil) | 7 | 56.0 | 59.0 | Jornal Brasil (voz em off) | Inacreditável! O Sol voltou a brilhar! | Inacreditável! O Sol voltou a brilhar! |

## Dicas para o ElevenLabs
- Jornais (01–05, 07): voz de âncora, "urgent / breaking news", estabilidade média, velocidade um pouco acima do normal.
- Evangelista (06): voz masculina jovem, firme e calma, determinação. Pode deixar 0,3 s de silêncio no começo.
- Exporte em MP3 (qualquer taxa). Volume é ajustado na mixagem (vozes ficam acima da trilha automaticamente).

## Vozes geradas (já em `audio/`)
Modelo `eleven_multilingual_v2`, vozes pré-prontas do ElevenLabs (conta gratuita não usa vozes da biblioteca via API):
01 e 07 Brian · 02 Sarah · 03 Matilda · 04 Daniel · 05 Adam · 06 Liam.
Silêncio das pontas cortado; falas 01–05 aceleradas para ~2,4 s; fala 06 com 0,3 s de silêncio no início.
