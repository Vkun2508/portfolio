"""Export full-resolution images from the real hybrid-isp pipeline for the portfolio.

Run with the hybrid-isp virtualenv:
    ../hybrid-isp/.venv/Scripts/python.exe scripts/export_isp.py

Writes PNGs to assets-src/isp/ plus a JSON file with the measured PSNR for each image.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent.parent
ISP_ROOT = HERE.parent / "hybrid-isp"
sys.path.insert(0, str(ISP_ROOT))

from isp import metrics, pipelines  # noqa: E402
from isp.classical import wb  # noqa: E402
from isp.classical.demosaic import bilinear  # noqa: E402
from isp.samples import load_sample  # noqa: E402

OUT = HERE / "assets-src" / "isp"


def to_u8(img: np.ndarray) -> np.ndarray:
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


def save(img: np.ndarray, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUT / name), cv2.cvtColor(to_u8(img), cv2.COLOR_RGB2BGR))
    print("wrote", name, img.shape[1], "x", img.shape[0])


def as_captured(raw) -> np.ndarray:
    x = wb.apply_gains(raw.bayer, raw.wb_gains or wb.gray_world(raw.bayer))
    return pipelines.render_linear_camera(bilinear(x), raw.cam2rgb)


def main() -> None:
    raw = load_sample("sidd-n6-iso3200-lowlight")
    out = pipelines.run(raw, names=["traditional", "hybrid"], with_metrics=False)
    trad, hyb = out.results["traditional"].image, out.results["hybrid"].image
    save(as_captured(raw), "chess-raw.png")
    save(trad, "chess-traditional.png")
    save(hyb, "chess-hybrid.png")
    save(raw.gt, "chess-truth.png")
    info = {
        "scene": "Nexus 6, ISO 3200, low light (SIDD test scene 004, unseen in training)",
        "psnr_traditional": round(float(metrics.psnr(np.clip(trad, 0, 1), raw.gt)), 2),
        "psnr_hybrid": round(float(metrics.psnr(np.clip(hyb, 0, 1), raw.gt)), 2),
        "route": out.route.label,
        "size": [int(hyb.shape[1]), int(hyb.shape[0])],
    }
    stages = export_stages(raw)
    info["stages"] = stages
    (OUT / "chess.json").write_text(json.dumps(info, indent=2))
    print(json.dumps(info, indent=2))


def heat(m: np.ndarray, vmax: float | None = None) -> np.ndarray:
    v = m / (vmax if vmax else max(float(np.percentile(m, 99.5)), 1e-9))
    return cv2.applyColorMap(to_u8(np.clip(v, 0, 1)), cv2.COLORMAP_INFERNO)[..., ::-1].astype(np.float32) / 255


def export_stages(raw) -> dict:
    """The seven intermediate states of the hybrid pipeline, same maths as make_figures.fig_intermediates."""
    from isp import analysis
    from isp.classical import denoise
    from isp.model_slot import get_model
    from isp.raw import pack, unpack

    model = get_model()
    inp = pack(raw.bayer)
    y = model.run(inp)
    a, b = denoise.estimate_nlf(inp)
    k = analysis.CONFIG.residual_k or 2.0
    sigma = np.sqrt(np.maximum(a * np.maximum(y, 0) + b, 1e-12))
    bounded = denoise.bound_residual(inp, y, k, (a, b))
    active = (np.abs(y - inp) > k * sigma).any(axis=-1)
    removed = np.abs(bounded - inp).mean(axis=-1)
    out = pipelines.run(raw, names=["hybrid"], with_metrics=False)
    h, w = inp.shape[:2]
    cy, cx, s = h // 2, w // 2, min(h, w) // 2
    crop = (slice(cy - s // 2, cy + s // 2), slice(cx - s // 2, cx + s // 2))
    fc = (slice(2 * crop[0].start, 2 * crop[0].stop), slice(2 * crop[1].start, 2 * crop[1].stop))
    size = 2 * s

    def up(img: np.ndarray) -> np.ndarray:
        return cv2.resize(img, (size, size), interpolation=cv2.INTER_NEAREST)

    bay = pipelines.viz_mosaic(raw.bayer, crop=96)
    bay = bay.astype(np.float32) / 255 if bay.dtype == np.uint8 else bay
    noisy_lin = pipelines.render_linear_camera(bilinear(wb.apply_gains(raw.bayer, raw.wb_gains)) * raw.exposure, raw.cam2rgb)
    den = unpack(bounded)
    den_lin = pipelines.render_linear_camera(bilinear(wb.apply_gains(den, raw.wb_gains)) * raw.exposure, raw.cam2rgb)
    act = np.clip(inp[..., 1][crop] * raw.exposure * 2, 0, 1)[..., None].repeat(3, -1)
    act[active[crop]] = np.array([229, 86, 111], np.float32) / 255
    save(up(bay), "stage-1.png")
    save(up(heat(sigma[..., 1][crop])), "stage-2.png")
    save(up(heat(removed[crop])), "stage-3.png")
    save(up(act), "stage-4.png")
    save(noisy_lin[fc], "stage-5.png")
    save(den_lin[fc], "stage-6.png")
    save(out.results["hybrid"].image[fc], "stage-7.png")
    return {"nlf_a": float(a), "nlf_b": float(b), "bound_k": float(k), "bound_active_pct": round(float(active.mean() * 100), 1)}


if __name__ == "__main__":
    main()
