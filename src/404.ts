import "./styles/tokens.css";
import "./styles/motion.css";
import "./styles/base.css";
import "./styles/sections.css";
import { createDevelop } from "./develop/develop";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const hero = document.querySelector<HTMLElement>("[data-hero]")!;

async function start() {
  if (reduced) return;
  await Promise.race([document.fonts.load(`700 120px "Hubot Sans"`), new Promise((r) => setTimeout(r, 2500))]);
  const dev = createDevelop({
    stage: document.querySelector<HTMLElement>("[data-hero-stage]")!,
    heading: document.querySelector<HTMLElement>("[data-name]")!,
    progress: () => 0,
    loupe: fine,
    cellDivisor: 48,
  });
  if (!dev) return;
  hero.classList.add("gl-on");
  dev.mount();
  if (fine) {
    const note = document.querySelector<HTMLElement>("[data-lost-note]");
    if (note) note.textContent = "Still RAW: a Bayer mosaic with sensor noise. Move your cursor over it to develop it.";
  }
}
start();
