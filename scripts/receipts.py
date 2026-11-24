"""Audit the resume the way LegalLens audits a contract.

Renders page 1 of the resume PDF, finds each claim in the PDF text layer, and writes
src/data/claims.json with the claim's character offsets (into the page text) and its
boxes on the page (as fractions of the page size, origin top-left).

Also renders the Kalpavikas certificates to PNG for their receipts.

    python scripts/receipts.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parent.parent
RESUME = ROOT / "public" / "Vinochan_Rajesh_Resume.pdf"
SRC_RESUME_DIR = ROOT.parent.parent / "resume"
OUT_IMG = ROOT / "assets-src" / "receipts"
OUT_JSON = ROOT / "src" / "data" / "claims.json"

# id, the phrase exactly as it reads on the resume, section, status, receipt id
CLAIMS = [
    ("isp-win", "Won 1st place (team of 4) at RV University’s Computer Vision Hackathon 2026", "Projects", "request", "isp-win"),
    ("isp-demo", "live demo on Hugging Face Spaces", "Projects", "verified", "isp-demo"),
    ("isp-psnr", "29.84 dB PSNR vs 25.40 dB for the traditional pipeline", "Projects", "verified", "isp-psnr"),
    ("legal-cats", "flags each against 11 risk categories", "Projects", "verified", "legal-cats"),
    ("legal-tests", "covered by 72 automated tests", "Projects", "verified", "legal-tests"),
    ("neralu-final", "Hack4SDG 2026 finalist", "Projects", "request", "neralu-final"),
    ("neralu-fixes", "fixed escalation rules in the backend (including a new database field), kept private details out of shared API views, and wrote tests for each fix", "Projects", "verified", "neralu-fixes"),
    ("paper", "Stock Price Prediction using LSTM Networks: A Multi-feature Time Series Approach", "Publications", "verified", "paper"),
    ("sih", "Kaavalu submitted, awaiting next-round results", "Achievements", "pending", "sih"),
    ("kalpavikas", "Participant, Kalpavikas 2.0", "Achievements", "verified", "kalpavikas"),
]


def norm(s: str) -> str:
    s = s.replace("’", "'").replace("“", '"').replace("”", '"').replace("ﬁ", "fi").replace("ﬂ", "fl")
    return re.sub(r"\s+", " ", s).strip()


def main() -> None:
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    pdf = pdfium.PdfDocument(str(RESUME))
    page = pdf[0]
    pw, ph = page.get_size()
    tp = page.get_textpage()
    n = tp.count_chars()
    raw = tp.get_text_range(0, n)

    # Normalised text with a map back to char indices (whitespace runs collapse to one space).
    flat, idx = [], []
    prev_space = False
    for i, ch in enumerate(raw):
        c = norm(ch) if ch.strip() else " "
        if c == " ":
            if prev_space:
                continue
            prev_space = True
        else:
            prev_space = False
        for cc in c:
            flat.append(cc)
            idx.append(i)
    flat_s = "".join(flat)

    claims = []
    for cid, phrase, section, status, receipt in CLAIMS:
        target = norm(phrase)
        pos = flat_s.find(target)
        if pos < 0:
            # tolerate hyphenation and missing spaces from the PDF text layer
            loose = re.escape(target).replace(r"\ ", r"\s?")
            m = re.search(loose, flat_s)
            if not m:
                raise SystemExit(f"claim not found on the resume: {cid}: {phrase!r}")
            pos, end = m.start(), m.end()
        else:
            end = pos + len(target)
        start_i, end_i = idx[pos], idx[end - 1]
        # boxes: group char boxes by line
        lines: dict[int, list[float]] = {}
        for i in range(start_i, end_i + 1):
            if not raw[i].strip():
                continue
            l, b, r, t = tp.get_charbox(i, loose=True)
            key = round((pw and (ph - t)) / 3)
            box = lines.setdefault(key, [l, b, r, t])
            box[0], box[1], box[2], box[3] = min(box[0], l), min(box[1], b), max(box[2], r), max(box[3], t)
        rects = []
        for l, b, r, t in lines.values():
            rects.append({
                "x": round(l / pw, 5),
                "y": round((ph - t) / ph, 5),
                "w": round((r - l) / pw, 5),
                "h": round((t - b) / ph, 5),
            })
        rects.sort(key=lambda r: (r["y"], r["x"]))
        # merge boxes that sit on the same line (brackets and italics report slightly different tops)
        merged: list[dict] = []
        for r in rects:
            m = merged[-1] if merged else None
            if m and abs((r["y"] + r["h"] / 2) - (m["y"] + m["h"] / 2)) < max(r["h"], m["h"]) * 0.5:
                x0, y0 = min(m["x"], r["x"]), min(m["y"], r["y"])
                x1, y1 = max(m["x"] + m["w"], r["x"] + r["w"]), max(m["y"] + m["h"], r["y"] + r["h"])
                m.update(x=round(x0, 5), y=round(y0, 5), w=round(x1 - x0, 5), h=round(y1 - y0, 5))
            else:
                merged.append(dict(r))
        rects = merged
        claims.append({
            "id": cid,
            "text": phrase,
            "section": section,
            "start": start_i,
            "end": end_i + 1,
            "status": status,
            "receipt": receipt,
            "rects": rects,
        })
        print(f"{cid:14s} chars {start_i}-{end_i + 1}  lines {len(rects)}  {status}")

    OUT_JSON.write_text(json.dumps({"page": {"w": pw, "h": ph, "chars": n}, "claims": claims}, indent=1, ensure_ascii=False), encoding="utf-8")

    # Page render for the audit sheet. The phone number is redacted on the web copy
    # (it stays in the downloadable PDF, as the owner chose).
    scale = 2000 / pw
    img = page.render(scale=scale).to_pil().convert("RGB")
    from PIL import ImageDraw

    phone = norm("+91 91481 71205")
    ppos = flat_s.find(phone)
    if ppos >= 0:
        ls, bs, rs, ts = [], [], [], []
        for i in range(idx[ppos], idx[ppos + len(phone) - 1] + 1):
            if raw[i].strip():
                l, b, r, t = tp.get_charbox(i, loose=True)
                ls.append(l); bs.append(b); rs.append(r); ts.append(t)
        pad = 1.5
        ImageDraw.Draw(img).rectangle(
            [(min(ls) - pad) * scale, (ph - max(ts) - pad) * scale, (max(rs) + pad) * scale, (ph - min(bs) + pad) * scale],
            fill=(17, 18, 20),
        )
        print("redacted phone number")
    img.save(OUT_IMG / "resume-page.png")
    print("rendered resume page", round(pw * scale), "x", round(ph * scale))

    # Certificates.
    certs = {
        "kalpavikas-ideathon": SRC_RESUME_DIR / "ca5ca086-e0e7-42ad-aa73-19e629adf735.pdf",
        "kalpavikas-applab": SRC_RESUME_DIR / "f99da3f4-90d4-4c99-a9a6-2bd47b6ae0f5.pdf",
    }
    for name, path in certs.items():
        doc = pdfium.PdfDocument(str(path))
        p = doc[0]
        w, _ = p.get_size()
        p.render(scale=1600 / w).to_pil().convert("RGB").save(OUT_IMG / f"{name}.png")
        print("rendered", name)


if __name__ == "__main__":
    main()
