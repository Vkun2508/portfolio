// The hero: the resume, audited. CSS lays out the still composition and plays the intro (the page
// settles, the flags appear, the stamps land). With motion allowed this adds:
//  - a small tilt of the page toward the mouse (a slow sway on touch screens);
//  - on wide screens, the hand-off: as the hero scrolls away the page lies flat and glides into the
//    audit's lens, its stamps clearing only at the last moment, where the real sheet takes over.

type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; w: number };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

export function initHero(root: HTMLElement, reduced: boolean) {
  if (reduced) return;

  const layer = root.querySelector<HTMLElement>(".hero-carry");
  const carry = root.querySelector<HTMLElement>("[data-carry]");
  const audit = document.querySelector<HTMLElement>("[data-audit]");
  const sheet = document.querySelector<HTMLElement>("[data-sheet]");
  if (!layer || !carry) return;

  const inks = Array.from(carry.querySelectorAll<HTMLElement>(".hmark, .hstamp, .hshade"));

  let pose: Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, w: 0 };
  let elW = 0; // the page element's width: the larger of its hero size and its size in the lens
  let s0 = 1; // its scale in the hero (never above 1, so it is never drawn small and blown up)
  let handoff = false;
  let landed: boolean | null = null;

  const num = (cs: CSSStyleDeclaration, name: string) => parseFloat(cs.getPropertyValue(name)) || 0;

  const layout = () => {
    carry.style.transform = "";
    carry.style.width = "";
    carry.style.removeProperty("--pw");
    carry.style.visibility = "";
    inks.forEach((el) => (el.style.opacity = ""));
    const cs = getComputedStyle(carry);
    pose = { x: carry.offsetLeft, y: carry.offsetTop, z: num(cs, "--z"), rx: num(cs, "--rx"), ry: num(cs, "--ry"), rz: num(cs, "--rz"), w: carry.offsetWidth };
    handoff = !!(audit && sheet && audit.classList.contains("is-scene") && window.innerWidth >= 1024 && sheet.offsetWidth > 0);
    elW = handoff && sheet ? Math.max(pose.w, sheet.offsetWidth) : pose.w;
    s0 = pose.w / elW;
    if (elW !== pose.w) {
      carry.style.width = `${elW}px`;
      carry.style.setProperty("--pw", `${elW}px`);
    }
    if (!handoff) sheet?.classList.remove("is-awaiting");
    landed = null;
  };

  // ---- pointer and sway ----
  const fine = matchMedia("(pointer: fine)").matches;
  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;
  let pointerSeen = false;
  let heroVisible = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      pointerSeen = true;
      kick();
    },
    { passive: true },
  );

  let lastT = performance.now();
  const render = (now: number) => {
    const dt = Math.min(64, now - lastT);
    lastT = now;
    const swaying = !pointerSeen || !fine;
    if (swaying) {
      const t = now / 1000;
      tx = Math.sin(t * 0.25) * 0.5;
      ty = Math.sin(t * 0.33) * 0.35;
    }
    const k = 1 - Math.pow(1 - 0.07, dt / 16.7);
    cx += (tx - cx) * k;
    cy += (ty - cy) * k;

    // reads first, then writes
    const hr = root.getBoundingClientRect();
    let h = 0;
    let sr: DOMRect | null = null;
    let lr: DOMRect | null = null;
    if (handoff && audit && sheet) {
      // 0 with the page at the top, 1 when the audit reaches the top of the screen: the page moves
      // one to one with the scroll, rising a little as it shrinks into the lens
      const span = audit.getBoundingClientRect().top - hr.top;
      h = span > 0 ? clamp(-hr.top / span) : 1;
      if (h > 0) {
        sr = sheet.getBoundingClientRect();
        lr = layer.getBoundingClientRect();
      }
    }

    // the page: tilts toward the pointer, then lies flat and glides into the lens
    const still = 1 - easeOut(clamp(h / 0.7));
    let dx = 0;
    let dy = 0;
    let s = s0;
    if (sr && lr) {
      dx = (sr.left + sr.width / 2 - lr.left - pose.x) * h;
      dy = (sr.top + sr.height / 2 - lr.top - pose.y) * h;
      s = s0 + (sr.width / elW - s0) * h;
    }
    const rx = (pose.rx - cy * 4) * still;
    const ry = (pose.ry + cx * 5) * still;
    carry.style.transform = `translate(-50%, -50%) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, ${(pose.z * still).toFixed(1)}px) rotateZ(${(pose.rz * still).toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(4)})`;

    // the flags and stamps clear at the last moment, for the audit to run them again
    if (handoff) {
      const clear = clamp((h - 0.8) / 0.18); // the audited page holds until it is nearly down
      for (const el of inks) el.style.opacity = clear > 0 ? (1 - clear).toFixed(3) : "";
    }

    // the swap: once the page is down, the real sheet (with its marks and stamps to come) takes over
    const isDown = handoff && h >= 0.995;
    if (isDown !== landed) {
      landed = isDown;
      carry.style.visibility = isDown ? "hidden" : "";
      sheet?.classList.toggle("is-awaiting", handoff && !isDown);
    }

    return Math.abs(tx - cx) > 0.0015 || Math.abs(ty - cy) > 0.0015;
  };

  let raf = 0;
  const loop = (now: number) => {
    raf = 0;
    const moving = render(now);
    const swaying = (!pointerSeen || !fine) && heroVisible && document.visibilityState === "visible";
    if (moving || swaying) raf = requestAnimationFrame(loop);
  };
  function kick() {
    if (!raf) {
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  new IntersectionObserver(([e]) => {
    heroVisible = e.isIntersecting;
    kick();
  }).observe(root);
  window.addEventListener("scroll", kick, { passive: true });
  document.addEventListener("visibilitychange", kick);

  let rt = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      layout();
      kick();
    }, 120);
  });

  layout();
  kick();
}
