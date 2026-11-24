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
}
