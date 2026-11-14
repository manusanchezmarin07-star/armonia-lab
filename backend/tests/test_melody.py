"""Melodía: de la curva de afinación a notas, y la detección real sobre audio sintético."""
import numpy as np
import pytest

from app.domain.melody import segment_notes, summarize, trim_outliers


def _curve(parts, step=0.02):
    """[(midi o None, segundos)] → (tiempos, alturas) muestreados cada `step`."""
    times, midi, t = [], [], 0.0
    for m, dur in parts:
        for _ in range(int(round(dur / step))):
            times.append(round(t, 4))
            midi.append(m)
            t += step
    return times, midi


def test_notes_are_grouped_and_rounded():
    times, midi = _curve([(None, 0.2), (69.1, 0.4), (None, 0.2), (71.9, 0.3), (72.0, 0.3)])
    notes = segment_notes(times, midi)
    assert [(n["midi"], n["name"]) for n in notes] == [(69, "A4"), (72, "C5")]
    assert abs(notes[0]["start"] - 0.2) < 0.03 and abs(notes[0]["end"] - 0.6) < 0.05


def test_vibrato_is_one_note_and_blips_are_dropped():
    times = [i * 0.02 for i in range(50)]
    vibrato = [69 + 0.4 * np.sin(i * 0.9) for i in range(50)]  # ±0,4 semitonos alrededor de La4
    assert [n["midi"] for n in segment_notes(times, vibrato)] == [69]
    times, midi = _curve([(60.0, 0.3), (66.0, 0.04), (60.0, 0.3)])  # un chispazo de 40 ms en medio
    assert [n["midi"] for n in segment_notes(times, midi)] == [60]


def test_short_gap_keeps_the_note_and_degrees_follow_the_key():
    times, midi = _curve([(64.0, 0.2), (None, 0.04), (64.0, 0.2), (None, 0.3), (67.0, 0.2)])
    notes = segment_notes(times, midi)
    assert [n["midi"] for n in notes] == [64, 67]
    info = summarize(notes, key_tonic_pc=0)
    assert info == {"low": 64, "high": 67, "count": 2} and [n["degree"] for n in notes] == [4, 7]
    assert segment_notes([], []) == [] and summarize([]) == {"low": None, "high": None, "count": 0}


def test_detects_a_sung_melody(tmp_path):
    """Una melodía sintética con armónicos (tipo voz), con silencios entre frases."""
    pytest.importorskip("librosa")
    sf = pytest.importorskip("soundfile")
    from app.infrastructure import melody
    sr = 22050
    tune = [60, 62, 64, 65, 67, None, 67, 65, 64, 62, 60]
    parts = []
    for m in tune:
        t = np.arange(int(sr * 0.4)) / sr
        if m is None:
            parts.append(np.zeros_like(t))
            continue
        f = 440 * 2 ** ((m - 69) / 12)
        env = np.minimum(1, t / 0.02) * np.minimum(1, (0.4 - t) / 0.03)
        parts.append(0.3 * env * sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 5)))
    sf.write(tmp_path / "voz.wav", np.concatenate(parts), sr)
    notes = melody.detect(str(tmp_path / "voz.wav"))
    assert [n["midi"] for n in notes] == [m for m in tune if m is not None]
    sf.write(tmp_path / "silencio.wav", np.zeros(sr), sr)
    assert melody.detect(str(tmp_path / "silencio.wav")) == []


def test_bleed_far_from_the_melody_register_is_removed():
    """Restos del bajo dos octavas por debajo de la voz no son melodía."""
    def note(m, start):
        return {"start": start, "end": start + 0.5, "midi": m, "name": ""}
    notes = [note(72, 0), note(74, 0.5), note(45, 1.0), note(76, 1.5), note(72, 2.0), note(100, 2.5), note(60, 3.0)]
    assert [n["midi"] for n in trim_outliers(notes)] == [72, 74, 76, 72, 60]   # Do4 está a una octava: se queda
    assert trim_outliers(notes[:3]) == notes[:3]                               # con muy pocas notas no se juzga
