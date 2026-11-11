"""Proceso hijo que separa una canción con Demucs.

Se ejecuta como `python -m app.infrastructure.demucs_worker <entrada> <carpeta> <modelo>`.
Va aparte del servidor para que la memoria de la GPU se libere al terminar y para
poder matarlo si se cuelga. A diferencia de `python -m demucs`, lee y escribe el
audio con libsndfile: no necesita ffmpeg, torchaudio ni torchcodec, que es donde
fallaba según la versión de PyTorch instalada.

El progreso sale por stderr (barra de tqdm) y el resultado, como JSON, por stdout.
"""
from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path


def _apply(model, wav, device: str, segment: float | None):
    from demucs.apply import apply_model
    kw = {"shifts": 1, "split": True, "overlap": 0.25, "progress": True, "device": device}
    # Trozos más cortos = menos memoria de vídeo. Demucs 4.1 lo acepta como argumento;
    # en 4.0 se ajusta en el propio modelo.
    if segment is not None:
        if "segment" in inspect.signature(apply_model).parameters:
            kw["segment"] = segment
        else:
            for sub in getattr(model, "models", [model]):
                sub.segment = segment
    return apply_model(model, wav[None], **kw)[0]


def main(src: str, out_dir: str, name: str) -> None:
    import soundfile as sf
    import torch
    from demucs.pretrained import get_model

    from app.infrastructure.audio_io import read_stereo

    model = get_model(name)
    model.eval()
    wav = torch.from_numpy(read_stereo(src, model.samplerate).T.copy())  # (2, muestras)
    # Normalización que usa Demucs: media y desviación de la mezcla en mono.
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    wav = (wav - mean) / std
    device = "cuda" if torch.cuda.is_available() else "cpu"
    with torch.no_grad():
        try:
            sources = _apply(model, wav, device, 7.0)
        except RuntimeError as e:
            # Sin memoria en la GPU (u otro fallo de CUDA): se repite en CPU, más lento pero seguro.
            if device == "cpu":
                raise
            print(f"\nGPU no disponible para esta canción ({str(e)[:120]}); sigo en CPU.", file=sys.stderr, flush=True)
            torch.cuda.empty_cache()
            device = "cpu"
            sources = _apply(model, wav, device, None)
    sources = sources * std + mean
    folder = Path(out_dir)
    folder.mkdir(parents=True, exist_ok=True)
    stems = {}
    for stem, audio in zip(model.sources, sources):
        path = folder / f"{stem}.mp3"
        sf.write(str(path), audio.clamp(-1, 1).T.cpu().numpy(), model.samplerate, format="MP3")
        stems[stem] = str(path)
    print(json.dumps({"stems": stems, "device": device}), flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:4])
