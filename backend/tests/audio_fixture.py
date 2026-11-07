"""Genera audio sintético con acordes conocidos para probar el detector."""
import numpy as np
import soundfile as sf

SR = 22050


def tone(freq, dur, sr=SR):
    t = np.arange(int(dur * sr)) / sr
    # Varios armónicos con caída, parecido a un piano eléctrico.
    sig = sum(np.sin(2 * np.pi * freq * k * t) / k ** 1.5 for k in range(1, 6))
    env = np.exp(-t * 1.2)
    return sig * env


def midi_hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def write_progression(path, chords, dur=2.0, with_bass=True):
    out = []
    for notes in chords:
        seg = sum(tone(midi_hz(n), dur) for n in notes)
        if with_bass:
            seg = seg + 1.2 * tone(midi_hz(notes[0] - 12), dur)
        out.append(seg)
    y = np.concatenate(out)
    y = y / np.abs(y).max() * 0.8
    sf.write(path, y, SR)
    return path
