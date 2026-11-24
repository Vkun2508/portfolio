import "./styles/tokens.css";
import "./styles/motion.css";
import "./styles/base.css";
import "./styles/sections.css";
import "./styles/print.css";

import Lenis from "lenis";
import { createDevelop } from "./develop/develop";
import { STAGES } from "./develop/stages";
import { initCompare } from "./compare";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ---------- smooth scroll (Experience page with scroll scenes; never under reduced motion) ----------
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ autoRaf: true, lerp: 0.11, anchors: { offset: -72 } });
}

// ---------- hero: the develop shader ----------
const hero = document.querySelector<HTMLElement>("[data-hero]")!;
const heroStage = document.querySelector<HTMLElement>("[data-hero-stage]")!;
const heading = document.querySelector<HTMLElement>("[data-name]")!;
const readoutN = document.querySelector<HTMLElement>("[data-readout-n]")!;
const readoutName = document.querySelector<HTMLElement>("[data-readout-name]")!;
const readoutNote = document.querySelector<HTMLElement>("[data-readout-note]")!;
const readoutIntro = document.querySelector<HTMLElement>(".readout-intro")!;
const readoutHint = document.querySelector<HTMLElement>("[data-readout-hint]")!;
const bars = Array.from(document.querySelectorAll<HTMLElement>("[data-readout-bar] li"));

const heroProgress = () => {
  const r = hero.getBoundingClientRect();
  const dist = hero.offsetHeight - window.innerHeight;
  return dist > 0 ? clamp(-r.top / dist) : 1;
};

let stageShown = -1;
const showStage = (p: number) => {
  const i = p >= 1 ? 6 : Math.min(6, Math.floor(p * 7));
  bars.forEach((b, k) => b.style.setProperty("--fill", String(clamp(p * 7 - k))));
  readoutHint.classList.toggle("is-gone", p > 0.015);
  if (i === stageShown) return;
  stageShown = i;
  readoutN.textContent = `${i + 1}/7`;
  readoutName.textContent = STAGES[i].name;
  readoutNote.textContent = STAGES[i].note;
};

async function startHero() {
  if (reduced) return;
  try {
    await Promise.race([
      document.fonts.load(`700 120px "Hubot Sans"`),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall through with whatever font is there */
  }
  const dev = createDevelop({
    stage: heroStage,
    heading,
    progress: heroProgress,
    onProgress: showStage,
    loupe: finePointer,
  });
  if (!dev) return;
  hero.classList.add("is-scrub", "gl-on");
  readoutIntro.textContent =
    "Scrolling develops this name through the seven stages of the camera pipeline I built for RV University's Computer Vision Hackathon (1st place).";
  readoutHint.hidden = false;
  dev.mount();
  showStage(heroProgress());
  lenis?.resize();
  document.fonts.addEventListener?.("loadingdone", () => dev.repaintText());
}
// Start the shader once the page has painted and gone idle: the HTML name is already on screen.
const whenIdle = (fn: () => void) =>
  "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 900 }) : setTimeout(fn, 200);
whenIdle(() => void startHero());

// ---------- nav turns solid once the hero has gone ----------
const nav = document.querySelector<HTMLElement>("[data-nav]")!;
// Solid as soon as the hero starts to leave, so the nav never sits on top of the readout.
const updateNav = () => nav.classList.toggle("is-solid", hero.getBoundingClientRect().bottom < window.innerHeight - 2);
updateNav();
window.addEventListener("scroll", updateNav, { passive: true });

// ---------- pictures develop in, titles rise ----------
// The clip sits on an inner span: IntersectionObserver treats a clipped target as invisible.
document.querySelectorAll<HTMLElement>("#work .title, .section-title").forEach((t) => {
  const inner = document.createElement("span");
  inner.className = "rise-inner";
  while (t.firstChild) inner.appendChild(t.firstChild);
  t.appendChild(inner);
  t.classList.add("rise");
});
const develops = document.querySelectorAll<HTMLElement>(".develop, .rise");
if ("IntersectionObserver" in window && !reduced) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add("is-in");
        io.unobserve(el);
        if (el.classList.contains("develop")) window.setTimeout(() => el.classList.add("is-done"), 1800);
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
  );
  develops.forEach((el) => io.observe(el));
} else {
  develops.forEach((el) => el.classList.add("is-in", "is-done"));
}

// ---------- compare slider ----------
const compare = document.querySelector<HTMLElement>("[data-compare]");
if (compare) initCompare(compare, reduced);

// ---------- seven stages: pinned horizontal travel on wide screens ----------
const stagesBlock = document.querySelector<HTMLElement>("[data-stages]");
// Under reduced motion the strip stays a plain grid (no pinning).
const stagesTrack = document.querySelector<HTMLElement>("[data-stages-track]");
if (stagesBlock && stagesTrack && !reduced) {
  const wide = matchMedia("(min-width: 1024px)");
  let dist = 0;
  const layout = () => {
    if (!wide.matches) {
      stagesBlock.classList.remove("is-pinned");
      stagesBlock.style.height = "";
      return;
    }
    stagesBlock.classList.add("is-pinned");
    dist = Math.max(0, stagesTrack.scrollWidth - window.innerWidth);
    stagesBlock.style.height = `${window.innerHeight + dist}px`;
    move();
  };
  const move = () => {
    if (!stagesBlock.classList.contains("is-pinned")) return;
    const r = stagesBlock.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, dist));
    stagesTrack.style.setProperty("--x", `${-p * dist}px`);
  };
  layout();
  window.addEventListener("resize", layout);
  wide.addEventListener("change", layout);
  window.addEventListener("scroll", move, { passive: true });
  lenis?.on("scroll", move);
}

// ---------- copy email ----------
const copyBtn = document.querySelector<HTMLButtonElement>("[data-copy]");
const copyStatus = document.querySelector<HTMLElement>("[data-copy-status]");
if (copyBtn && copyStatus && navigator.clipboard) {
  copyBtn.hidden = false;
  let t = 0;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.copy || "");
      copyStatus.textContent = "Email copied. Paste it into your mail app.";
      copyBtn.textContent = "Copied";
    } catch {
      copyStatus.textContent = "Couldn't copy. The address is vinochanrajesh25@gmail.com.";
    }
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      copyBtn.textContent = "Copy email";
      copyStatus.textContent = "";
    }, 2600);
  });
}
