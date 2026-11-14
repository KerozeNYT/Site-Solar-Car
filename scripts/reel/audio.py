"""Soundtrack of the reel, synthesised from scratch (no sample, no licence): dark tech-house at
120 BPM in A minor, laid on the timeline of the picture (out/timeline.json).

  python3 audio.py <timeline.json> <music.wav> <sfx.wav>

- before the phone comes in: pad, plucked arpeggio and a riser; the beat drops with the phone
- under the three screen recordings: kick, clap, hats, sub bass, pad, arpeggio
- the end card: an impact, then the last chord rings out
- sound design on its own track (whooshes between the clips, a soft click on every tap)
"""
import json
import sys

import numpy as np

SR = 48000
rng = np.random.default_rng(37)
tl = json.load(open(sys.argv[1]))
TOTAL = tl['total'] + 0.05
N = int(TOTAL * SR)
DROP = tl['clips'][0][1]  # first screen recording: the beat starts
END = tl['endStart']
BEAT = 0.5  # 120 BPM
# the grid runs from the drop (bars of 4 beats)
grid0 = DROP - 8 * BEAT


def t_arr(n):
    return np.arange(n) / SR


def place(buf, sig, at, gain=1.0, pan=0.0):
    """add a mono or stereo signal at time `at` (s), panned -1 (left) … 1 (right)"""
    i = int(round(at * SR))
    if i >= buf.shape[0]:
        return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
    j0 = max(0, -i)
    i0 = max(0, i)
    n = min(sig.shape[0] - j0, buf.shape[0] - i0)
    if n > 0:
        buf[i0:i0 + n] += sig[j0:j0 + n] * gain


def fft_filter(x, lo=None, hi=None, slope=0.15):
    """band limit by FFT with soft edges (lo/hi in Hz)"""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** (2 / slope * 0.1 + 2))
    if hi:
        g *= 1 / (1 + (f / hi) ** (2 / slope * 0.1 + 2))
    return np.fft.irfft(X * g, n)


def saw(freq, t, phase=0.0):
    # band-limited enough at these pitches (additive, 24 harmonics)
    out = np.zeros_like(t)
    for k in range(1, 25):
        if freq * k > 16000:
            break
        out += np.sin(2 * np.pi * freq * k * t + phase * k) / k
    return out * 0.6


def note(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def reverb(x, sec=2.2, mix=0.25, pre=0.02):
    """stereo convolution reverb with a synthetic decaying noise impulse"""
    n = int(sec * SR)
    tt = t_arr(n)
    env = np.exp(-tt / (sec / 6.5))
    out = np.zeros((x.shape[0] + n, 2))
    for c in range(2):
        ir = rng.standard_normal(n) * env
        ir = fft_filter(ir, lo=180, hi=7000)
        ir[: int(pre * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        L = x.shape[0] + n
        size = 1 << int(np.ceil(np.log2(L)))
        y = np.fft.irfft(np.fft.rfft(x[:, c], size) * np.fft.rfft(ir, size), size)[:L]
        out[:, c] = y
    res = x * (1 - mix * 0.5)
    res = np.vstack([res, np.zeros((n, 2))])
    return (res + out * mix)[: x.shape[0]]


# ------------------------------------------------------------------ instruments
def kick():
    tt = t_arr(int(0.42 * SR))
    f = 46 + 120 * np.exp(-tt / 0.028)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-tt / 0.22)
    click = rng.standard_normal(len(tt)) * np.exp(-tt / 0.0025) * 0.35
    return np.tanh((body + click) * 1.6) * 0.9


def clap():
    n = int(0.35 * SR)
    tt = t_arr(n)
    noise = rng.standard_normal(n)
    env = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.022]):
        env += (tt >= d) * np.exp(-np.maximum(tt - d, 0) / (0.006 if k < 2 else 0.11))
    return fft_filter(noise * env, lo=900, hi=5200) * 0.7


def hat(open_=False):
    n = int((0.22 if open_ else 0.07) * SR)
    tt = t_arr(n)
    x = rng.standard_normal(n) * np.exp(-tt / (0.07 if open_ else 0.016))
    return fft_filter(x, lo=7500, hi=16000) * 0.5


def pluck(freq, dur=0.32, bright=3200):
    tt = t_arr(int(dur * SR))
    x = (saw(freq, tt) * 0.7 + np.sin(2 * np.pi * freq * 2 * tt) * 0.2) * np.exp(-tt / 0.09)
    x *= np.minimum(1, tt / 0.003)
    return fft_filter(x, hi=bright) * 0.5


def bass_note(freq, dur):
    tt = t_arr(int(dur * SR))
    x = np.sin(2 * np.pi * freq * tt) + 0.25 * np.sin(2 * np.pi * freq * 2 * tt) + 0.08 * np.sin(2 * np.pi * freq * 3 * tt)
    env = np.minimum(1, tt / 0.006) * (0.55 + 0.45 * np.exp(-tt / 0.08)) * np.minimum(1, (dur - tt) / 0.03)
    return np.tanh(x * env * 1.3) * 0.75


def pad_chord(notes, dur, cutoff=1500):
    tt = t_arr(int(dur * SR))
    left = np.zeros_like(tt)
    right = np.zeros_like(tt)
    for i, n in enumerate(notes):
        f = note(n)
        for d, p in ((-0.11, -0.8), (0.0, 0.0), (0.12, 0.8)):
            v = saw(f * 2 ** (d / 12), tt, phase=rng.uniform(0, 6.28))
            l, r = np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)
            left += v * l
            right += v * r
    env = np.minimum(1, tt / 0.35) * np.minimum(1, (dur - tt) / 0.35)
    left = fft_filter(left * env, hi=cutoff, lo=90)
    right = fft_filter(right * env, hi=cutoff, lo=90)
    return np.stack([left, right], 1) / (len(notes) * 3) * 0.9


def riser(dur):
    tt = t_arr(int(dur * SR))
    x = rng.standard_normal(len(tt))
    # rising band: three overlapping bands faded in one after the other
    out = np.zeros_like(tt)
    for k, (lo, hi) in enumerate(((300, 1500), (1200, 5000), (4000, 12000))):
        out += fft_filter(x, lo=lo, hi=hi) * np.clip((tt / dur) * 3 - k, 0, 1) ** 1.5
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 1400 * (tt / dur) ** 2) / SR) * 0.15
    return (out * 0.5 + sweep) * (tt / dur) ** 2


def impact():
    tt = t_arr(int(2.4 * SR))
    f = 38 + 70 * np.exp(-tt / 0.05)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.6)
    noise = fft_filter(rng.standard_normal(len(tt)) * np.exp(-tt / 0.25), hi=2500, lo=60) * 0.6
    return np.tanh((boom + noise) * 1.4) * 0.9


def whoosh(dur=0.55, pan_from=-0.8, pan_to=0.8):
    tt = t_arr(int(dur * SR))
    x = rng.standard_normal(len(tt))
    env = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
    lo = fft_filter(x, lo=500, hi=2500)
    hi = fft_filter(x, lo=2500, hi=9000)
    k = tt / dur
    mono = (lo * (1 - k) + hi * k) * env * 0.6
    pan = pan_from + (pan_to - pan_from) * k
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([mono * l, mono * r], 1) * 1.414


def tap_click():
    tt = t_arr(int(0.06 * SR))
    tone = np.sin(2 * np.pi * 1850 * tt) * np.exp(-tt / 0.008)
    tick = fft_filter(rng.standard_normal(len(tt)) * np.exp(-tt / 0.002), lo=3000) * 0.5
    low = np.sin(2 * np.pi * 420 * tt) * np.exp(-tt / 0.012) * 0.5
    return (tone * 0.5 + tick + low) * 0.6


# ------------------------------------------------------------------ arrangement
# A minor: Am9 – Fmaj7 – Cmaj7 – G6, one bar (2 s) each, MIDI notes
CHORDS = [
    (45, [57, 60, 64, 67, 71]),  # Am9 (A C E G B)
    (41, [57, 60, 64, 65]),      # Fmaj7 (F A C E)
    (48, [55, 59, 60, 64]),      # Cmaj7 (C E G B)
    (43, [55, 59, 62, 64]),      # G6 (G B D E)
]
BAR = 4 * BEAT

music = np.zeros((N, 2))
drums = np.zeros((N, 2))
bass = np.zeros((N, 2))
arp = np.zeros((N, 2))
sfx = np.zeros((N, 2))
muffled = np.zeros((N, 2))  # the beat behind a door: before the drop and under the end card

K, C, H, HO = kick(), clap(), hat(), hat(True)
first_bar = int(np.floor((0 - grid0) / BAR))
last_bar = int(np.ceil((TOTAL - grid0) / BAR))
for b in range(first_bar, last_bar):
    t0 = grid0 + b * BAR
    root, notes = CHORDS[b % 4]
    # pad: everywhere, brighter once the beat runs
    cut = 1100 if t0 < DROP - 0.01 else (1700 if t0 < END - 0.01 else 1300)
    if t0 + BAR > 0:
        place(music, pad_chord(notes, BAR + 0.4, cut), t0, gain=0.95 if t0 < DROP - 0.01 else 0.55)
    for s in range(16):  # sixteenths
        ts = t0 + s * BEAT / 4
        if ts < 0 or ts >= TOTAL:
            continue
        groove = DROP - 0.01 <= ts < END - 0.02
        intro = ts < DROP - 0.01
        # arpeggio: up and down the chord, one note every sixteenth (eighths in the intro)
        seq = notes + notes[-2:0:-1]
        n = seq[s % len(seq)] + (12 if s % 8 == 6 else 0)
        if (groove or (intro and s % 2 == 0)) and ts < END:
            place(arp, pluck(note(n), bright=2600 if intro else 3800), ts, gain=0.32 if groove else 0.42, pan=0.35 if s % 2 else -0.35)
        if not groove:
            # muffled beat: the whole intro bar before the drop, two bars under the end card
            if (intro and ts >= DROP - 2 * BAR) or (END + 0.6 <= ts < END + 0.6 + 2 * BAR):
                if s % 4 == 0:
                    place(muffled, K, ts, gain=1.0)
                if s in (4, 12):
                    place(muffled, C, ts, gain=0.5)
                if s % 4 == 2:
                    place(muffled, bass_note(note(root), BEAT / 2 * 0.95), ts, gain=0.7)
            continue
        beat = s % 4 == 0
        if beat:
            place(drums, K, ts, gain=1.0)
        if s in (4, 12):
            place(drums, C, ts, gain=0.55, pan=0.05)
        if s % 4 == 2:
            place(drums, HO if s == 14 else H, ts, gain=0.38, pan=0.25)
        elif s % 2 == 1:
            place(drums, H, ts, gain=0.16, pan=0.3)
        # bass: off-beat eighths on the root, octave jump at the end of the bar
        if s % 4 == 2 or s in (7, 15):
            f = note(root + (12 if s == 15 else 0))
            place(bass, bass_note(f, BEAT / 2 * 0.95 if s % 4 == 2 else BEAT / 4 * 0.9), ts, gain=0.62)

# the muffled beat: low-passed, rising into the drop, falling away at the end
muffled = np.stack([fft_filter(muffled[:, c], hi=420) for c in range(2)], 1)
tm = t_arr(N)
rise = np.clip((tm - (DROP - 2 * BAR)) / (2 * BAR), 0, 1) ** 0.7 * (tm < DROP)
fall = np.clip(1 - (tm - (END + 0.6)) / (2 * BAR + 0.4), 0, 1) * (tm >= END + 0.6)
muffled *= (rise * 0.9 + fall * 0.75)[:, None]

# sidechain pump on pad and arp during the groove
tt = t_arr(N)
phase = np.mod(tt - grid0, BEAT)
pump = 1 - 0.45 * np.exp(-phase / 0.11)
pump[(tt < DROP) | (tt >= END)] = 1
music *= pump[:, None]
arp *= (0.6 + 0.4 * pump)[:, None]

# the riser into the drop, the impact on the end card, the last chord ringing out
place(sfx, riser(DROP - 0.25), 0.2, gain=0.7)
place(drums, impact(), DROP - 0.02, gain=0.55)
place(drums, impact(), END + 0.12, gain=0.9)
ring = pad_chord(CHORDS[0][1] + [76], TOTAL - END + 0.5, cutoff=2400)
fade = np.minimum(1, (np.arange(ring.shape[0]) / SR) / 0.08)[:, None]
place(music, ring * fade, END + 0.12, gain=1.15)
place(bass, bass_note(note(33), 2.6) * np.exp(-t_arr(int(2.6 * SR)) / 1.2), END + 0.12, gain=0.8)

# whooshes: the phone comes in, each change of screen, the phone goes away
for at, (a, b) in [(tl['phoneIn'] - 0.15, (0.9, -0.2))] + [(c[1] - 0.2, (-0.8, 0.8)) for c in tl['clips'][1:]] + [(END - 0.15, (0.2, -0.9))]:
    place(sfx, whoosh(0.6, a, b), at, gain=0.55)
for at in tl['taps']:
    place(sfx, tap_click(), at - 0.01, gain=0.75, pan=0.1)

# ------------------------------------------------------------------ mix
arp = reverb(arp, 1.8, 0.35)
music = reverb(music, 2.6, 0.3)
mix = music * 0.9 + arp * 0.8 + drums * 0.85 + bass * 0.8 + muffled * 0.62
sfx = reverb(sfx, 1.6, 0.25)

# fade out at the very end, gentle fade in
env = np.minimum(1, tt / 0.05) * np.clip((TOTAL - tt) / 1.4, 0, 1) ** 1.3
mix *= env[:, None]
sfx *= env[:, None]


def master(x):
    x = np.tanh(x * 1.1) / np.tanh(1.1)
    return x / (np.max(np.abs(x)) + 1e-9) * 0.89


def write(path, x):
    import wave
    x = np.clip(x, -1, 1)
    data = (x * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)


both = master(mix + sfx * 0.9)
write(sys.argv[2], both)
write(sys.argv[3], master(sfx) * 0.7)
print('written', TOTAL, 's, drop', DROP, 'end', END, 'taps', len(tl['taps']))
