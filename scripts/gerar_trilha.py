#!/usr/bin/env python3
"""Gera trilha + efeitos sonoros sintetizados (numpy) -> audio/gerado/trilha.wav (60 s, estéreo, 44.1 kHz).
Sem vozes: as vozes do ElevenLabs entram na mixagem (mixar.py)."""
import os, wave
import numpy as np

SR = 44100
DUR = 60.0
N = int(SR * DUR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(7)
L = np.zeros(N); Rr = np.zeros(N)


def tt(n): return np.arange(n) / SR


def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    sig = sig[: N - i0] * gain
    l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
    L[i0:i0 + len(sig)] += sig * l * 1.414
    Rr[i0:i0 + len(sig)] += sig * r * 1.414


def bandpass(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float)
    # bordas suaves
    m = np.convolve(m, np.ones(31) / 31, mode="same")
    return np.fft.irfft(X * m, n=len(x))


def noise(d): return rng.standard_normal(int(d * SR))


def env(n, a, r, curve=2.0):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr) ** curve
    return e


def decay(n, tau): return np.exp(-tt(n) / tau)


def norm(x, p=1.0): m = np.max(np.abs(x)) + 1e-9; return x / m * p


def saw(f, d):
    t = tt(int(d * SR)); ph = np.cumsum(np.full(len(t), f) / SR) if np.isscalar(f) else np.cumsum(f / SR)
    return 2 * (ph % 1) - 1


def boom(d=2.5, f0=90, f1=28, nz=0.6):
    n = int(d * SR); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, d / 3)
    s += nz * bandpass(rng.standard_normal(n), 20, 400) * decay(n, d / 4)
    return norm(s)


def whoosh(d=1.2, lo=300, hi=3000, rise=True):
    n = int(d * SR); x = rng.standard_normal(n); out = np.zeros(n); seg = 2048
    for i in range(0, n, seg):
        k = i / n; c = lo + (hi - lo) * (k if rise else 1 - k)
        out[i:i + seg] = bandpass(x[i:i + seg], c * .6, c * 1.6)[: len(out[i:i + seg])]
    return norm(out * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5)


def static(d):
    x = bandpass(noise(d), 1500, 9000); n = len(x)
    return norm(x * (0.6 + 0.4 * (rng.random(n) > .3)) * env(n, .005, .08))


def pad(freqs, d, cutoff=900, detune=.004):
    n = int(d * SR); s = np.zeros(n)
    for f in freqs:
        for dt in (-detune, 0, detune):
            s += saw(f * (1 + dt), d)
    return norm(bandpass(s, 30, cutoff))


def heartbeat(d=0.5):
    n = int(d * SR); t = tt(n); s = np.sin(2 * np.pi * 52 * t) * decay(n, .07)
    s2 = np.zeros(n); k = int(.22 * SR); s2[k:] = s[: n - k] * .7
    return norm(s + s2)


def tom(f=80, d=.6):
    n = int(d * SR); t = tt(n); ff = f * (1 + .8 * np.exp(-t * 25))
    return norm(np.sin(2 * np.pi * np.cumsum(ff) / SR) * decay(n, d / 4) + .2 * rng.standard_normal(n) * decay(n, .03))


def shimmer(d, base=880):
    n = int(d * SR); t = tt(n); s = np.zeros(n)
    for i, m in enumerate([1, 1.25, 1.5, 2, 2.5, 3]):
        s += np.sin(2 * np.pi * base * m * t + i) * (0.5 + 0.5 * np.sin(2 * np.pi * (3 + i) * t))
    return norm(s * env(n, .3, .5))


A1, C2, D2, E2, F2, G2 = 55.0, 65.41, 73.42, 82.41, 87.31, 98.0

# ---------------- CENA 1 (0–12): suspense + estática + batimento
drone = pad([A1, A1 * 1.06, A1 * 1.5], 12.4, cutoff=260)
add(drone * env(len(drone), 1.5, .4), 0, .32)
rum = bandpass(noise(12.4), 20, 110); add(norm(rum) * env(len(rum), 2, .4), 0, .22)
for k in np.arange(0.4, 12, 0.85): add(heartbeat(), k, .45)
add(norm(bandpass(noise(12), 2000, 8000)) * env(int(12 * SR), .5, .3), 0, .025)  # estática de fundo
for c in [0.0, 1.6, 3.6, 5.6, 7.6, 9.6, 11.2]: add(static(.22), c, .32)
add(whoosh(.8, 200, 2500), 10.6, .3)
add(boom(1.6, 120, 40, .4), 11.2, .55)
# vinheta "urgente" de telejornal
for i, f in enumerate([440, 554, 659]):
    n = int(.14 * SR); add(norm(np.sign(np.sin(2 * np.pi * f * tt(n)))) * env(n, .005, .06) * .5, 1.55 + i * .12, .12)

# ---------------- CENA 2 (12–20)
add(boom(2.5, 70, 30, .3), 12.0, .5)
p2 = pad([A1, C2, E2], 8.0, cutoff=500); add(p2 * env(len(p2), 1.0, 1.0), 12, .22)
add(whoosh(.9, 150, 900), 15.2, .25)
rs = pad([A1 * 2, A1 * 2.12], 1.6, 1800); add(rs * np.linspace(0, 1, len(rs)) ** 2, 18.4, .3)
for k in np.arange(12.3, 16.8, 0.85): add(heartbeat(), k, .3)

# ---------------- CENA 3 (20–28): meteoro, pulo, bicicleta
rum3 = bandpass(noise(6.6), 20, 160); add(norm(rum3) * np.linspace(.2, 1, len(rum3)) ** 1.5, 20, .55)
fire = bandpass(noise(6.6), 200, 1600); add(norm(fire) * np.linspace(.1, 1, len(fire)) ** 2, 20, .18)
p3 = pad([D2, F2, A1 * 2], 6.0, 800); add(p3 * env(len(p3), .3, .4), 20, .25)
for k in np.arange(20.0, 25.6, 0.6): add(tom(70 if int(k * 10) % 12 else 55), k, .45)
add(boom(1.2, 150, 45, .8), 22.8, .7)  # impulso do pulo
add(whoosh(2.2, 250, 4000), 22.8, .5)
add(whoosh(.9, 600, 2000, rise=False), 23.4, .3)  # atravessando nuvens
sk = pad([A1 * 4, A1 * 4.24], .8, 3000); add(sk * np.linspace(0, 1, len(sk)) ** 3, 25.6, .35)  # sucção câmera lenta
add(boom(3.2, 160, 30, 1.0), 26.4, 1.0)  # IMPACTO DO CHUTE
add(norm(bandpass(noise(.5), 1500, 9000)) * decay(int(.5 * SR), .08), 26.4, .5)
add(whoosh(1.4, 3000, 300, rise=True), 26.6, .45)

# ---------------- CENA 4 (28–38): viagem espacial
add(whoosh(1.0, 500, 2500), 28.0, .45)
seq = [[D2, F2, A1 * 2], [F2, A1 * 2, C2 * 2], [C2, E2, G2], [D2, F2, A1 * 2], [E2, G2, 123.47]]
for i, ch in enumerate(seq):
    p = pad(ch, 2.2, 1400); add(p * env(len(p), .2, .4), 28 + i * 2, .26)
for k in np.arange(28.0, 38.0, 0.25):  # pulso/arpejo
    f = [293.66, 349.23, 440, 523.25][int(k * 4) % 4]; n = int(.18 * SR)
    add(np.sin(2 * np.pi * f * tt(n)) * decay(n, .05), k, .08, pan=.4 if int(k * 4) % 2 else -.4)
for k in np.arange(28.0, 38.0, 0.5): add(tom(60, .4), k, .3)
roar = bandpass(noise(10), 60, 600); add(norm(roar) * .5, 28, .18)
for tp in [30.6, 32.6, 35.2, 37.3]: add(whoosh(1.1, 300, 3500), tp - .6, .5)

# ---------------- CENA 5 (38–44): Sol destruído + silêncio
rz = pad([A1 * 2, A1 * 2.03, A1 * 3], 2.0, 3000); add(rz * np.linspace(0, 1, len(rz)) ** 2, 38.0, .45)
add(whoosh(2.0, 300, 5000), 38.0, .35)
ex = boom(2.3, 120, 22, 1.4); add(ex, 40.0, 1.0)
cr = bandpass(noise(2.3), 800, 6000) * decay(int(2.3 * SR), .5); add(norm(cr), 40.0, .35)

# ---------------- CENA 6 (44–55): PRIME
wind = bandpass(noise(2.2), 150, 700); add(norm(wind) * env(len(wind), .6, .3), 44.0, .12)
for k in [44.3, 45.1, 45.9]: add(heartbeat(), k, .5)
rise = saw(np.linspace(80, 900, int(3.4 * SR)), 3.4); rise = bandpass(rise, 40, 3000); add(norm(rise) * np.linspace(.1, 1, len(rise)) ** 1.5, 46.2, .3)
add(boom(1.8, 130, 35, .9), 46.8, .9)  # explosão da aura
for k in np.arange(46.8, 50.4, 0.11):  # crepitar elétrico
    if rng.random() < .55:
        d = .03 + rng.random() * .07; add(norm(bandpass(noise(d), 2000, 10000)) * decay(int(d * SR), .015), k, .25 * rng.random() + .1, pan=rng.uniform(-.7, .7))
hum = np.sin(2 * np.pi * 110 * tt(int(3.6 * SR))) + .5 * np.sin(2 * np.pi * 220.5 * tt(int(3.6 * SR))); add(hum * env(len(hum), .3, .3) * .5, 46.8, .2)
add(whoosh(1.6, 200, 6000), 49.5, .6)  # coluna de luz
add(boom(1.5, 100, 40, .6), 49.6, .6)
p6 = pad([C2, G2, C2 * 2, E2 * 2], 5.0, 2500); add(p6 * env(len(p6), 1.2, .5), 49.6, .3)
add(shimmer(2.0, 660), 51.4, .25)
add(boom(2.0, 90, 40, .3), 53.15, .5)
maj = pad([C2, G2, C2 * 2, E2 * 2, G2 * 2], 7.0, 3000); add(maj * env(len(maj), .05, .05), 53.15, .42)
add(shimmer(3.0, 1046), 53.15, .18)

# ---------------- CENA 7 (55–60): final (corte seco no fim)
fin = pad([F2, C2 * 2, A1 * 4, F2 * 2], 5.0, 2600); add(fin * env(len(fin), .3, .02), 55.0, .35)
for k in np.arange(55.0, 60.0, .5): add(tom(65, .5), k, .28)
for k in np.arange(55.0, 60.0, .13):
    if rng.random() < .3:
        d = .04; add(norm(bandpass(noise(d), 3000, 10000)) * decay(int(d * SR), .012), k, .12, pan=rng.uniform(-.6, .6))

# silêncio absoluto após a explosão do Sol (42.3–44.0)
a, b = int(42.3 * SR), int(44.0 * SR)
fade = np.linspace(1, 0, int(.25 * SR)); L[a - len(fade):a] *= fade; Rr[a - len(fade):a] *= fade
L[a:b] = 0; Rr[a:b] = 0
fi = np.linspace(0, 1, int(.02 * SR)); L[b:b + len(fi)] *= fi; Rr[b:b + len(fi)] *= fi

st = np.stack([L, Rr], axis=1)
st = np.tanh(st / (np.max(np.abs(st)) + 1e-9) * 1.4) / np.tanh(1.4) * .89  # leve saturação + teto
os.makedirs(os.path.join(ROOT, "audio", "gerado"), exist_ok=True)
out = os.path.join(ROOT, "audio", "gerado", "trilha.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
print("trilha gerada:", out)
