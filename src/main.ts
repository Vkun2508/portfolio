import "./styles/tokens.css";
import "./styles/motion.css";
import "./styles/base.css";
import "./styles/sections.css";
import "./styles/print.css";

import Lenis from "lenis";
import { initAudit } from "./audit";
import { initCompare } from "./compare";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- smooth scroll (Experience page with a scroll scene; never under reduced motion) ----------
const lenis = reduced ? null : new Lenis({ autoRaf: true, lerp: 0.11, anchors: { offset: -72 } });

// ---------- the audit ----------
const audit = document.querySelector<HTMLElement>("[data-audit]");
if (audit) initAudit(audit, reduced);
lenis?.resize();

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
    if (target instanceof HTMLElement) {
      if (lenis) lenis.scrollTo(target, { offset: -96 });
      else target.scrollIntoView();
    }
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
