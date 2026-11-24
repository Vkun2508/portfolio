// Converts the project's own figures and screenshots into web images in public/img.
// Sources: assets-src/isp (exported by scripts/export_isp.py) and the sibling project folders.
// Run: npm run images
import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desk = resolve(root, "..", "..");
const out = resolve(root, "public", "img");
mkdirSync(out, { recursive: true });

async function emit(input, name, widths) {
  for (const w of widths) {
    const base = sharp(input).resize({ width: w, withoutEnlargement: true });
    await base.clone().avif({ quality: 58, effort: 6 }).toFile(resolve(out, `${name}-${w}.avif`));
    await base.clone().webp({ quality: 80 }).toFile(resolve(out, `${name}-${w}.webp`));
  }
  console.log("img", name, widths.join(","));
}

const isp = resolve(root, "assets-src", "isp");
for (const n of ["raw", "traditional", "hybrid", "truth"]) {
  await emit(resolve(isp, `chess-${n}.png`), `chess-${n}`, [800, 1536]);
}
// 2x close-ups for the slider, where the noise difference is visible (made by the crop step in r4)
for (const n of ["raw", "traditional", "hybrid", "truth"]) {
  const f = resolve(isp, `chess-${n}-crop.png`);
  if (existsSync(f)) await emit(f, `chess-${n}-crop`, [768]);
}
for (let i = 1; i <= 7; i++) {
  await emit(resolve(isp, `stage-${i}.png`), `stage-${i}`, [320, 512]);
}

// LegalLens: the annotated results view.
const legal = resolve(desk, "NLProject", "docs", "screenshots", "results.jpg");
if (existsSync(legal)) await emit(legal, "legallens", [800, 1536]);

// Neralu: ward console. Rows 85-121 hold a demo-environment warning banner; splice it out.
const ward = resolve(desk, "projects", "neralu-latest", "docs", "media", "ward-console.jpg");
if (existsSync(ward)) {
  const top = await sharp(ward).extract({ left: 0, top: 0, width: 1440, height: 85 }).toBuffer();
  const rest = await sharp(ward).extract({ left: 0, top: 122, width: 1440, height: 778 }).toBuffer();
  const spliced = await sharp({ create: { width: 1440, height: 863, channels: 3, background: "#0d0f0e" } })
    .composite([{ input: top, top: 0, left: 0 }, { input: rest, top: 85, left: 0 }])
    .png()
    .toBuffer();
  await emit(spliced, "neralu", [800, 1440]);
  // Phone crop: the ranked list of residents, readable at phone width.
  const list = await sharp(spliced).extract({ left: 1030, top: 222, width: 410, height: 641 }).png().toBuffer();
  await emit(list, "neralu-phone", [410, 820]);
}

// Receipts (scripts/receipts.py, the IEEE capture, the live-demo and PR captures, the real test log).
const rc = resolve(root, "assets-src", "receipts");
const receipts = [
  ["resume-page", [1000, 2000]],
  ["ieee", [900, 1664]],
  ["isp-demo", [800, 1440]],
  ["neralu-pr", [900, 1600]],
  ["kalpavikas-ideathon", [800, 1600]],
  ["kalpavikas-applab", [800, 1600]],
  ["legallens-tests", [800, 1600]],
  ["legallens-note", [360, 720]],
];
for (const [name, widths] of receipts) {
  const f = resolve(rc, `${name}.png`);
  if (existsSync(f)) await emit(f, name, widths);
}
// LegalLens on a phone: one flagged clause and its note, from a real 390px session.
const llPhone = resolve(rc, "legallens-phone.png");
if (existsSync(llPhone)) {
  const crop = await sharp(llPhone).extract({ left: 0, top: 226, width: 780, height: 960 }).png().toBuffer();
  await emit(crop, "legallens-phone", [390, 780]);
}
