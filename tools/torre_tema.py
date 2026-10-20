"""
"Ascensão ao Trono" — tema original da Torre Sem Fim.
Mistura de climas: neoclássico melancólico (piano, cello, soprano, coro) com
energia de batalha 8-bit (baixo pulsante, melodia em onda quadrada, bateria).
Ré menor, 128 BPM, 4/4. Melodias e harmonias originais.
"""
import numpy as np
from scipy import signal
import sys

SR = 44100
BPM = 128
BEAT = 60 / BPM
BAR = 4 * BEAT
E8 = BEAT / 2               # colcheia
NBARS = 72
TOTAL = NBARS * BAR + 3.0   # + cauda de reverb (cortada no loop)
N = int(TOTAL * SR)
rng = np.random.default_rng(33)

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def hz(n):
    name, octv = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octv + 1) - 69) / 12)

def buf(): return np.zeros(N)
def at(t): return int(t * SR)
def place(dst, x, t, g=1.0):
    i = at(t)
    if i >= N: return
    x = x[:N - i]
    dst[i:i + len(x)] += x * g

def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    e = np.ones(n) * s
    a = min(a, n); e[:a] = np.linspace(0, 1, a, endpoint=False)
    d2 = min(d, max(0, n - a)); e[a:a + d2] = np.linspace(1, s, d2, endpoint=False)
    if r > 0:
        r = min(r, n); e[-r:] *= np.linspace(1, 0, r)
    return e

def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low'); return signal.lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def bp(x, fc, q):
    b, a = signal.iirpeak(fc / (SR / 2), q); return signal.lfilter(b, a, x)

# ---------------------------------------------------------------- instrumentos
def piano(f, dur, vel=1.0):
    n = int((dur + 1.2) * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for k, amp in enumerate([1, .55, .32, .2, .12, .08, .05], 1):
        fk = f * k * (1 + 0.0004 * k * k)
        x += amp * np.sin(2 * np.pi * fk * t) * np.exp(-t * (1.6 + 0.9 * k))
    x *= np.minimum(1, t / 0.004)
    x *= np.where(t < dur, 1, np.exp(-(t - dur) * 9))
    return x * 0.32 * vel

def cello(f, dur, vel=1.0):
    n = int((dur + .5) * SR); t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.6)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    x = signal.sawtooth(ph) + 0.4 * signal.sawtooth(2 * ph)
    x = lp(x, 1800); x = bp(x, 400, 1.2) * 0.6 + x * 0.4
    return x * env_adsr(n, .18, .2, .85, .45) * 0.18 * vel

def voice(f, dur, vel=1.0, vowel='a', vib_depth=0.012):
    """soprano/coro: pulso glotal + filtros de formante"""
    n = int((dur + .6) * SR); t = np.arange(n) / SR
    vib = 1 + vib_depth * np.sin(2 * np.pi * 5.6 * t + rng.random() * 6) * np.minimum(1, t / 0.5)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    src = signal.sawtooth(ph, 0.85) + 0.05 * rng.standard_normal(n)
    F = {'a': [(800, 1), (1150, .5), (2900, .25), (3900, .12)],
         'o': [(450, 1), (800, .45), (2830, .18), (3800, .1)]}[vowel]
    x = sum(g * bp(src, fc, 6) for fc, g in F)
    return x * env_adsr(n, .25, .3, .8, .55) * 0.16 * vel

def square(f, dur, vel=1.0, duty=0.5):
    n = int((dur + .05) * SR); t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 6 * t) * np.minimum(1, np.maximum(0, t - .15) / .3)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    x = signal.square(ph, duty)
    x = lp(x, 5200, 1)
    return x * env_adsr(n, .004, .08, .7, .04) * 0.075 * vel

def pulse_bass(f, dur, vel=1.0):
    n = int((dur + .02) * SR); t = np.arange(n) / SR
    x = signal.square(2 * np.pi * f * t, 0.25) * 0.6 + np.sin(2 * np.pi * f * t) * 0.7
    x = lp(x, 1400, 2)
    return x * env_adsr(n, .003, .05, .75, .03) * 0.16 * vel

def kick():
    n = int(.35 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.55

def snare():
    n = int(.25 * SR); t = np.arange(n) / SR
    noise = hp(rng.standard_normal(n), 1500) * np.exp(-t * 18)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    return (noise * 0.28 + tone * 0.22)

def hat(open_=False):
    n = int((.25 if open_ else .06) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000, 3) * np.exp(-t * (10 if open_ else 60)) * 0.09

def crash():
    n = int(2.0 * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 4000, 2) * np.exp(-t * 2.2) * 0.12

def boom():   # impacto grave cinematográfico
    n = int(2.5 * SR); t = np.arange(n) / SR
    f = 32 + 60 * np.exp(-t * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) * 0.5

# ---------------------------------------------------------------- harmonia
CH = {'Dm': ['D', 'F', 'A'], 'Bb': ['Bb', 'D', 'F'], 'Gm': ['G', 'Bb', 'D'], 'A': ['A', 'C#', 'E'],
      'F': ['F', 'A', 'C'], 'C': ['C', 'E', 'G'], 'Am': ['A', 'C', 'E'], 'Eb': ['Eb', 'G', 'Bb'],
      'A7': ['A', 'C#', 'G']}
def chord(name, octv): return [hz(n + str(octv)) for n in CH[name]]

PROG_A = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'C', 'A']
PROG_B = ['Bb', 'C', 'Am', 'Dm', 'Gm', 'Eb', 'A', 'A7']
PROG_BRK = ['Dm', 'Bb', 'Gm', 'A']

# melodias originais: (nota, colcheias)  — 8 colcheias por compasso
LEAD_A = [
    [('A4', 2), ('F4', 1), ('A4', 1), ('D5', 3), ('C5', 1)],
    [('Bb4', 2), ('A4', 1), ('G4', 1), ('F4', 2), ('D4', 2)],
    [('G4', 1), ('A4', 1), ('Bb4', 2), ('D5', 2), ('Bb4', 1), ('A4', 1)],
    [('C#5', 3), ('E5', 1), ('A4', 4)],
    [('A4', 2), ('F4', 1), ('A4', 1), ('D5', 2), ('E5', 1), ('F5', 1)],
    [('E5', 2), ('D5', 1), ('C5', 1), ('A4', 4)],
    [('G4', 1), ('C5', 1), ('E5', 2), ('D5', 1), ('C5', 1), ('Bb4', 1), ('G4', 1)],
    [('A4', 2), ('C#5', 2), ('E5', 2), ('A5', 2)],
]
LEAD_A2 = LEAD_A[:6] + [
    [('G5', 1), ('F5', 1), ('E5', 2), ('D5', 1), ('E5', 1), ('F5', 1), ('G5', 1)],
    [('A5', 4), ('C#5', 2), ('E5', 2)],
]
SOPRANO_B = [
    [('F5', 4), ('D5', 4)], [('E5', 4), ('G5', 4)], [('A5', 6), ('G5', 2)], [('F5', 8)],
    [('Bb5', 4), ('A5', 2), ('G5', 2)], [('G5', 4), ('Eb5', 4)], [('E5', 4), ('C#5', 4)], [('E5', 8)],
]
CELLO_BRK = [[('D3', 8)], [('F3', 4), ('D3', 4)], [('Bb2', 4), ('D3', 2), ('G3', 2)], [('A2', 8)],
             [('A3', 6), ('G3', 2)], [('F3', 4), ('Bb3', 4)], [('G3', 4), ('Bb3', 2), ('D4', 2)], [('C#4', 4), ('E3', 4)]]
INTRO_SOP = [[('A4', 8)], [('Bb4', 8)], [('G4', 6), ('A4', 2)], [('A4', 8)],
             [('D5', 8)], [('C5', 4), ('Bb4', 4)], [('Bb4', 6), ('D5', 2)], [('C#5', 8)]]

tracks = {k: buf() for k in ['piano', 'cello', 'voice', 'choir', 'lead', 'bass', 'drums', 'fx']}

def play_line(track, inst, line, bar0, vel=1.0, **kw):
    for b, notes in enumerate(line):
        t = (bar0 + b) * BAR
        for n, d in notes:
            if n != 'R':
                place(tracks[track], inst(hz(n), d * E8 * 0.98, vel, **kw), t)
            t += d * E8

def piano_arp(prog, bar0, octv=3, vel=1.0, pattern=(0, 1, 2, 1, 0, 2, 1, 2)):
    for b, c in enumerate(prog):
        fs = chord(c, octv); fs = fs + [f * 2 for f in fs]
        for i, p in enumerate(pattern):
            idx = p if i < 4 else p + 3 if p + 3 < len(fs) else p
            place(tracks['piano'], piano(fs[idx], E8 * 1.6, vel * (0.9 if i % 2 else 1.0)), (bar0 + b) * BAR + i * E8)

def piano_chords(prog, bar0, octv=4, vel=1.0):
    for b, c in enumerate(prog):
        for k, beat in enumerate([0, 1.5, 2.5]):
            for f in chord(c, octv):
                place(tracks['piano'], piano(f, BEAT * 0.9, vel * (0.8 if k else 1)), (bar0 + b) * BAR + beat * BEAT)

def choir_pad(prog, bar0, vel=1.0, vowel='o'):
    for b, c in enumerate(prog):
        for i, f in enumerate(chord(c, 4)):
            for det in (-0.004, 0.004):
                place(tracks['choir'], voice(f * (1 + det), BAR * 0.98, vel * 0.55, vowel=vowel, vib_depth=0.008), (bar0 + b) * BAR)

def bass_line(prog, bar0, vel=1.0, gallop=True):
    for b, c in enumerate(prog):
        root = hz(CH[c][0] + '2')
        for i in range(8):
            f = root * (2 if (gallop and i % 2 == 1) else 1)
            place(tracks['bass'], pulse_bass(f, E8 * 0.85, vel), (bar0 + b) * BAR + i * E8)

def drums(bar0, nbars, style='full', fill_last=True):
    for b in range(nbars):
        t0 = (bar0 + b) * BAR
        last = fill_last and b == nbars - 1
        if style in ('full', 'half'):
            for beat in ([0, 2] if style == 'half' else [0, 1.5, 2, 2.75]):
                place(tracks['drums'], kick(), t0 + beat * BEAT)
            for beat in ([1, 3] if not last else [1, 2.5, 3, 3.25, 3.5, 3.75]):
                place(tracks['drums'], snare(), t0 + beat * BEAT, 0.9 if beat in (1, 3) else 0.6)
            for i in range(8):
                place(tracks['drums'], hat(open_=(i == 7)), t0 + i * E8, 0.8 if i % 2 else 1.0)
        elif style == 'pulse':      # só bumbo marcando
            for beat in range(4):
                place(tracks['drums'], kick(), t0 + beat * BEAT, 0.7)

# ---------------------------------------------------------------- arranjo (72 compassos ≈ 2:15)
# 0-7   Intro: piano em arpejo + soprano solitária (melancolia)
piano_arp(PROG_A, 0, 3, 0.9)
play_line('voice', voice, INTRO_SOP, 0, 0.95, vowel='a')
place(tracks['fx'], boom(), 0)
drums(6, 2, 'pulse', False)
# 8-23  A: a batalha começa — baixo galopante, bateria, melodia 8-bit (2x)
place(tracks['fx'], crash(), 8 * BAR); place(tracks['fx'], boom(), 8 * BAR, 0.8)
bass_line(PROG_A, 8); bass_line(PROG_A, 16)
drums(8, 8, 'full'); drums(16, 8, 'full')
piano_chords(PROG_A, 8, 4, 0.6); piano_chords(PROG_A, 16, 4, 0.6)
play_line('lead', square, LEAD_A, 8, 1.0, duty=0.5)
play_line('lead', square, LEAD_A2, 16, 1.0, duty=0.25)
play_line('lead', square, [[(n[:-1] + str(int(n[-1]) - 1) if n != 'R' else n, d) for n, d in bar] for bar in LEAD_A2], 16, 0.55, duty=0.5)
# 24-39 B: a soprano sobe por cima do ritmo, coro ao fundo (2x)
place(tracks['fx'], crash(), 24 * BAR)
for k in (24, 32):
    bass_line(PROG_B, k); drums(k, 8, 'full'); choir_pad(PROG_B, k, 0.9, 'o')
    piano_arp(PROG_B, k, 4, 0.55)
play_line('voice', voice, SOPRANO_B, 24, 1.1, vowel='a')
play_line('voice', voice, SOPRANO_B, 32, 1.1, vowel='a')
play_line('lead', square, [[(n[:-1] + str(int(n[-1]) - 1), d) for n, d in bar] for bar in SOPRANO_B], 32, 0.6, duty=0.125)
# 40-47 Interlúdio: só piano e cello (o lamento antes do fim)
place(tracks['fx'], boom(), 40 * BAR, 0.7)
piano_arp(PROG_BRK + PROG_BRK, 40, 3, 0.85)
play_line('cello', cello, CELLO_BRK, 40, 1.0)
choir_pad(['Dm', 'Bb', 'Gm', 'A'], 44, 0.5, 'o')
drums(46, 2, 'pulse', False)
# 48-63 Final: tudo junto — melodia 8-bit + soprano + coro
place(tracks['fx'], crash(), 48 * BAR); place(tracks['fx'], boom(), 48 * BAR)
for k in (48, 56):
    bass_line(PROG_A, k); drums(k, 8, 'full'); choir_pad(PROG_A, k, 0.75, 'a'); piano_chords(PROG_A, k, 4, 0.55)
play_line('lead', square, LEAD_A, 48, 1.0, duty=0.5)
play_line('lead', square, LEAD_A2, 56, 1.0, duty=0.25)
play_line('voice', voice, [[(n[:-1] + str(int(n[-1]) + 1), d) for n, d in bar] for bar in INTRO_SOP], 48, 0.7, vowel='a')
play_line('cello', cello, [[(n, d) for n, d in bar] for bar in CELLO_BRK], 56, 0.8)
# 64-71 Coda curta que volta ao clima da intro (emenda no loop)
piano_arp(PROG_A, 64, 3, 0.8)
play_line('voice', voice, INTRO_SOP[:4] + [[('D5', 8)], [('C5', 8)], [('Bb4', 8)], [('A4', 8)]], 64, 0.85, vowel='a')
drums(64, 6, 'half', False); bass_line(PROG_A[:6], 64, 0.6, gallop=False)
drums(70, 2, 'pulse', False)

# ---------------------------------------------------------------- mixagem
def reverb(x, secs=2.4, mix=0.25, pre=0.02):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * (6.9 / secs))
    ir = lp(ir, 6000); ir[:int(pre * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
    wet = signal.fftconvolve(x, ir)[:len(x)]
    return x * (1 - mix) + wet * mix * 1.6

def stereo(x, pan):   # pan -1..1
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l, x * r], 1)

mix = (stereo(reverb(tracks['piano'], 2.2, .30), -0.15) +
       stereo(reverb(tracks['cello'], 2.6, .35), -0.35) +
       stereo(reverb(tracks['voice'], 3.0, .45), 0.10) * 1.25 +
       stereo(reverb(tracks['choir'], 3.2, .50), 0.0) +
       stereo(reverb(tracks['lead'], 1.2, .18), 0.25) * 1.3 +
       stereo(tracks['bass'], 0.0) +
       stereo(reverb(tracks['drums'], 0.8, .10), 0.0) +
       stereo(reverb(tracks['fx'], 3.0, .40), 0.0))
# automação de volume por seção: calmo (intro/interlúdio/coda) x batalha
tt = np.arange(len(mix)) / SR
def seg(b0, b1, g): return (b0 * BAR, b1 * BAR, g)
AUTO = [seg(0, 8, 0.42), seg(8, 40, 1.0), seg(40, 48, 0.5), seg(48, 64, 1.0), seg(64, 72, 0.6)]
gain = np.ones(len(mix))
for t0, t1, g in AUTO:
    gain[(tt >= t0) & (tt < t1)] = g
ramp = int(BAR * SR * 0.5)
k = np.ones(ramp) / ramp
gain = np.convolve(gain, k, mode='same')
mix *= gain[:, None]
# cola: compressão suave + limitador
peak = np.max(np.abs(mix)); mix = mix / peak
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
# loop: termina exatamente no fim do compasso 72, com a cauda somada ao início
L = int(NBARS * BAR * SR)
tail = mix[L:]
mix = mix[:L].copy()
mix[:len(tail)] += tail
mix *= 0.89 / np.max(np.abs(mix))
fade = int(0.01 * SR); mix[:fade] *= np.linspace(0, 1, fade)[:, None]; mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
from scipy.io import wavfile
wavfile.write(sys.argv[1], SR, (mix * 32767).astype(np.int16))
print('ok', len(mix) / SR, 's')
