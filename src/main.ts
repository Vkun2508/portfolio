import "./styles/tokens.css";
import "./styles/motion.css";
import "./styles/base.css";
import "./styles/sections.css";
import "./styles/print.css";

import Lenis from "lenis";
import { initAudit } from "./audit";
import { initCompare } from "./compare";
import { initHero } from "./hero";
import { initTrack } from "./track";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- smooth scroll (Experience page with a scroll scene; never under reduced motion) ----------
// (in-page links are routed below, so links into the sideways track land on their panel)
const lenis = reduced ? null : new Lenis({ autoRaf: true, lerp: 0.11 });

// ---------- the audit ----------
const audit = document.querySelector<HTMLElement>("[data-audit]");
if (audit) initAudit(audit, reduced);
lenis?.resize();

// ---------- the hero (after the audit: the resume page hands off into the audit's lens) ----------
const hero = document.querySelector<HTMLElement>("[data-hero]");
if (hero) initHero(hero, reduced);

// ---------- projects, sideways on wide screens ----------
const work = document.querySelector<HTMLElement>("[data-track]");
const track = work ? initTrack(work, reduced) : null;
lenis?.resize();

// ---------- in-page links: one route for every #link ----------
const focusTarget = (target: HTMLElement) => {
  // keyboard and screen-reader users carry on from where the link went
  if (!target.matches("a[href], button, input, select, textarea, summary, [tabindex]")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
};
const scrollToTarget = (target: HTMLElement, instant = false) => {
  // pinned scenes start at their own top; everything else clears the nav
  const inTrack = track?.scrollYFor(target);
  const y = inTrack ?? target.getBoundingClientRect().top + window.scrollY - (target.matches("[data-audit]") ? 0 : 80);
  if (lenis && !instant) lenis.scrollTo(y, { onComplete: () => focusTarget(target) });
  else {
    window.scrollTo({ top: y, behavior: instant ? "instant" : "smooth" });
    focusTarget(target);
  }
};
document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
  const id = a ? decodeURIComponent(a.hash.slice(1)) : "";
  const target = id ? document.getElementById(id) : null;
  if (!target) return;
  e.preventDefault();
  history.pushState(null, "", `#${id}`);
  scrollToTarget(target);
});
if (location.hash) {
  const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (t && track?.scrollYFor(t) != null) scrollToTarget(t, true);
}

// ---------- nav turns solid once the page moves ----------
const nav = document.querySelector<HTMLElement>("[data-nav]")!;
const updateNav = () => nav.classList.toggle("is-solid", window.scrollY > 8);
updateNav();
window.addEventListener("scroll", updateNav, { passive: true });

// ---------- compare slider ----------
const compare = document.querySelector<HTMLElement>("[data-compare]");
if (compare) initCompare(compare, reduced);

// ---------- receipts open in a dialog from the audit log (plain anchors without JS) ----------
const dialog = document.querySelector<HTMLDialogElement>("[data-receipt-dialog]");
const rdBody = document.querySelector<HTMLElement>("[data-rd-body]");
const rdTitle = document.querySelector<HTMLElement>("[data-rd-title]");
const rdGoto = document.querySelector<HTMLAnchorElement>("[data-rd-goto]");
if (dialog && rdBody && rdTitle && rdGoto && typeof dialog.showModal === "function") {
  document.querySelectorAll<HTMLAnchorElement>("a[data-receipt]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const src = document.getElementById(`receipt-${a.dataset.receipt}`);
      if (!src) return;
      e.preventDefault();
      const copy = src.cloneNode(true) as HTMLElement;
      copy.removeAttribute("id");
      copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      copy.querySelectorAll("img").forEach((img) => img.removeAttribute("loading"));
      const label = src.querySelector(".receipt-label")?.cloneNode(true) as HTMLElement | undefined;
      label?.querySelectorAll(".chip").forEach((c) => c.remove());
      const what = label ? (label.textContent || "").replace(/\s+/g, " ").trim() : "";
      rdTitle.textContent = what ? `Receipt: ${what}` : "Receipt";
      rdBody.replaceChildren(copy);
      rdGoto.href = `#receipt-${a.dataset.receipt}`;
      dialog.showModal();
    });
  });
  document.querySelector("[data-rd-close]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  rdGoto.addEventListener("click", (e) => {
    e.preventDefault();
    dialog.close();
    const target = document.querySelector(rdGoto.getAttribute("href") || "");
    if (target instanceof HTMLElement) scrollToTarget(target);
  });
}

// ---------- Kaavalu: a call drawn as a waveform, amber from the moment the script is recognised ----------
const wave = document.querySelector<SVGSVGElement>("[data-call-wave]");
if (wave) {
  const NS = "http://www.w3.org/2000/svg";
  const bars = 96;
  const hit = 0.375; // the second of four events, where Kaavalu recognises the script
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < bars; i++) {
    const x = (i / bars) * 1200 + 2;
    const speech = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.37)) * rnd();
    const h = Math.max(6, speech * 104);
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", String(x));
    r.setAttribute("y", String(60 - h / 2));
    r.setAttribute("width", String(1200 / bars - 5));
    r.setAttribute("height", String(h));
    if (i / bars >= hit) r.setAttribute("class", "after");
    wave.appendChild(r);
  }
  const line = document.createElementNS(NS, "line");
  line.setAttribute("x1", String(hit * 1200));
  line.setAttribute("x2", String(hit * 1200));
  line.setAttribute("y1", "0");
  line.setAttribute("y2", "120");
  wave.appendChild(line);
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
