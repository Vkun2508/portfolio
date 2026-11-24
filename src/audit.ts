// The audit: the resume page is the stage. Scrolling moves a camera from claim to claim; each
// claim is highlighted where it sits in the PDF and a stamp lands on it. Claim positions and
// character ranges come from the PDF's text layer (scripts/receipts.py -> src/data/claims.json).
import data from "./data/claims.json";

type Rect = { x: number; y: number; w: number; h: number };
type Claim = { id: string; status: "verified" | "request" | "pending"; rects: Rect[] };
type View = { s: number; tx: number; ty: number };

const STAMP_TEXT: Record<string, string> = {
  "legal-tests": "Understated · 99 pass",
};
const STATUS_TEXT = { verified: "Verified", request: "On request", pending: "Pending" } as const;
const ASPECT = 2829 / 2000;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function initAudit(root: HTMLElement, reduced: boolean) {
  const sheet = root.querySelector<HTMLElement>("[data-sheet]");
  const frame = root.querySelector<HTMLElement>("[data-lens-frame]");
  const list = root.querySelector<HTMLElement>("[data-claims]");
  const win = root.querySelector<HTMLElement>("[data-claims-window]");
  const progressEl = root.querySelector<HTMLElement>("[data-audit-progress]");
  if (!sheet || !frame || !list || !win || !progressEl) return;

  const claims = (data.claims as Claim[]).filter((c) => list.querySelector(`[data-claim="${c.id}"]`));
  const items = claims.map((c) => list.querySelector<HTMLElement>(`[data-claim="${c.id}"]`)!);
  const N = claims.length;

  // ---- marks, stamps and the seal, placed in page units ----
  const marks: HTMLElement[][] = [];
  const stamps: HTMLElement[] = [];
  // placed stamp boxes in page fractions (x of width, y of height), so stamps never pile up
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const STAMP_H = (2.2 * 1.6) / 100 / ASPECT + 0.006;
  const overlaps = (a: { x: number; y: number; w: number; h: number }) =>
    placed.some((b) => a.x < b.x + b.w + 0.008 && b.x < a.x + a.w + 0.008 && a.y < b.y + b.h && b.y < a.y + a.h);
  claims.forEach((c) => {
    marks.push(
      c.rects.map((r) => {
        const m = document.createElement("span");
        m.className = "mark";
        Object.assign(m.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
        sheet.appendChild(m);
        return m;
      }),
    );
    const widest = c.rects.reduce((a, b) => (b.w > a.w ? b : a));
    const text = STAMP_TEXT[c.id] ?? STATUS_TEXT[c.status];
    const s = document.createElement("span");
    s.className = "stamp";
    s.dataset.status = c.status;
    s.textContent = text;
    // centred above the claim's widest line, nudged sideways or below if another stamp is there
    const wFrac = ((text.length * 0.66 + 1.2) * 2.2) / 100;
    const cx = clamp(widest.x + widest.w / 2 - wFrac / 2, 0.04, 0.96 - wFrac);
    const above = widest.y - 0.031;
    const below = widest.y + widest.h + 0.004;
    const tries = [
      { x: cx, y: above },
      { x: clamp(cx + wFrac + 0.02, 0.04, 0.96 - wFrac), y: above },
      { x: clamp(cx - wFrac - 0.02, 0.04, 0.96 - wFrac), y: above },
      { x: cx, y: below },
      { x: clamp(cx + wFrac + 0.02, 0.04, 0.96 - wFrac), y: below },
      { x: clamp(cx - wFrac - 0.02, 0.04, 0.96 - wFrac), y: below },
    ];
    const spot = tries.find((t) => !overlaps({ x: t.x, y: t.y, w: wFrac, h: STAMP_H })) ?? tries[0];
    placed.push({ x: spot.x, y: spot.y, w: wFrac, h: STAMP_H });
    s.style.left = `${spot.x * 100}%`;
    s.style.top = `${spot.y * 100}%`;
    s.style.setProperty("--rot", `${[-6, -4, -8, -5][stamps.length % 4]}deg`);
    sheet.appendChild(s);
    stamps.push(s);
  });
  const totals = { verified: 0, request: 0, pending: 0 };
  claims.forEach((c) => totals[c.status]++);
  const seal = document.createElement("span");
  seal.className = "seal";
  seal.innerHTML = `Audited 25 Nov 2026<small>${totals.verified} verified · ${totals.request} on request · ${totals.pending} pending</small>`;
  sheet.appendChild(seal);

  const setUnit = () => sheet.style.setProperty("--u", `${sheet.getBoundingClientRect().width / 100 / (currentScale || 1)}px`);
  let currentScale = 1;

  // ---- reduced motion: the finished audit, still ----
  if (reduced) {
    stamps.forEach((s) => s.classList.add("is-on"));
    seal.classList.add("is-on");
    setUnit();
    new ResizeObserver(setUnit).observe(sheet);
    progressEl.textContent = `Audit complete: ${totals.verified} verified, ${totals.request} on request, ${totals.pending} pending.`;
    return;
  }

  // ---- scene ----
  root.classList.add("is-scene");
  marks.flat().forEach((m) => m.classList.add("is-future"));

  let W0 = 0;
  let H0 = 0;
  let fw = 0;
  let fh = 0;
  let segLen = 0;
  let views: View[] = [];
  const phone = () => window.innerWidth < 1024;

  const viewFor = (c: Claim | null): View => {
    if (!c) return { s: 1, tx: (fw - W0) / 2, ty: (fh - H0) / 2 };
    const x0 = Math.min(...c.rects.map((r) => r.x)) * W0;
    const y0 = Math.min(...c.rects.map((r) => r.y)) * H0;
    const x1 = Math.max(...c.rects.map((r) => r.x + r.w)) * W0;
    const y1 = Math.max(...c.rects.map((r) => r.y + r.h)) * H0;
    const bw = x1 - x0;
    const bh = y1 - y0;
    let s = Math.min((fw * 0.86) / bw, (fh * 0.42) / bh, phone() ? 3.6 : 3);
    s = Math.max(s, 1.35);
    let tx = fw / 2 - (x0 + bw / 2) * s;
    let ty = fh / 2 - (y0 + bh / 2) * s - fh * 0.04;
    if (W0 * s >= fw) tx = clamp(tx, fw - W0 * s, 0);
    if (H0 * s >= fh) ty = clamp(ty, fh - H0 * s, 0);
    return { s, tx, ty };
  };

  const layout = () => {
    segLen = window.innerHeight * 0.42;
    root.style.height = `${window.innerHeight + (N + 2) * segLen}px`;
    fw = frame.clientWidth;
    fh = frame.clientHeight;
    W0 = Math.min(fw * 0.92, (fh * 0.94) / ASPECT);
    H0 = W0 * ASPECT;
    sheet.style.setProperty("--w0", `${W0}px`);
    sheet.style.setProperty("--u", `${W0 / 100}px`);
    // On a phone the whole page is a thumbnail, so the ending zooms onto the stamped lower half and the seal.
    const outro = phone()
      ? viewFor({ id: "outro", status: "verified", rects: [{ x: 0.05, y: 0.62, w: 0.9, h: 0.33 }] })
      : viewFor(null);
    views = [viewFor(null), ...claims.map(viewFor), outro];
    last = -1;
  };

  const lerpView = (a: View, b: View, t: number): View => ({
    s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * t),
    tx: a.tx + (b.tx - a.tx) * t,
    ty: a.ty + (b.ty - a.ty) * t,
  });

  let last = -1;
  let shownActive = -2;
  const on = new Array<boolean>(N).fill(false);
  let sealOn = false;

  const render = () => {
    const r = root.getBoundingClientRect();
    const span = root.offsetHeight - window.innerHeight;
    const p = span > 0 ? clamp(-r.top / span) : 0;
    if (p === last) return;
    last = p;
    const t = p * (N + 2);
    const seg = Math.min(N + 1, Math.floor(t));
    const f = t - seg;

    // camera
    let v: View;
    if (seg === 0) v = views[0];
    else v = lerpView(views[seg - 1], views[seg], ease(clamp(f / 0.4)));
    currentScale = v.s;
    sheet.style.transform = `translate3d(${v.tx}px, ${v.ty}px, 0) scale(${v.s})`;

    // which claims are stamped
    const active = seg >= 1 && seg <= N ? seg - 1 : seg > N ? N : -1;
    let landed = false;
    for (let i = 0; i < N; i++) {
      const should = i < active || (i === active && f >= 0.42) || seg > N;
      if (should !== on[i]) {
        on[i] = should;
        stamps[i].classList.toggle("is-on", should);
        if (should && i === active) {
          stamps[i].classList.add("is-landing");
          landed = true;
          window.setTimeout(() => stamps[i].classList.remove("is-landing"), 340);
        }
      }
      marks[i].forEach((m) => {
        m.classList.toggle("is-active", i === active);
        m.classList.toggle("is-future", i > active && seg <= N);
      });
    }
    root.classList.toggle("is-outro", seg > N);
    const wantSeal = seg > N && f >= 0.5;
    if (wantSeal !== sealOn) {
      sealOn = wantSeal;
      seal.classList.toggle("is-on", wantSeal);
      if (wantSeal) {
        seal.classList.add("is-landing");
        landed = true;
        window.setTimeout(() => seal.classList.remove("is-landing"), 340);
      }
    }
    if (landed) {
      frame.classList.remove("audit-thud");
      void frame.offsetWidth;
      frame.classList.add("audit-thud");
    }

    // the log follows the camera
    if (active !== shownActive) {
      shownActive = active;
      const a = clamp(active, 0, N - 1);
      items.forEach((it, i) => {
        it.classList.toggle("is-active", i === active);
        it.classList.toggle("is-done", i < active || active >= N);
        it.classList.toggle("is-near", Math.abs(i - a) <= 1);
      });
      const focus = items[clamp(active, 0, N - 1)];
      const y = active < 0 ? 0 : win.clientHeight * 0.3 - (focus.offsetTop + focus.offsetHeight / 2) + focus.offsetHeight / 2;
      list.style.setProperty("--log-y", `${Math.min(0, y)}px`);
    }

    // running tally
    const done = { verified: 0, request: 0, pending: 0 };
    claims.forEach((c, i) => on[i] && done[c.status]++);
    if (seg === 0) progressEl.textContent = `${N} claims to check. Keep scrolling to run the audit.`;
    else if (seg <= N)
      progressEl.innerHTML = `Claim ${seg} of ${N} · <b>${done.verified} verified</b> · ${done.request} on request · ${done.pending} pending`;
    else progressEl.innerHTML = `Audit complete: <b>${totals.verified} verified</b>, ${totals.request} on request, ${totals.pending} pending.`;
  };

  let raf = 0;
  let visible = false;
  const loop = () => {
    raf = 0;
    if (!visible) return;
    render();
    raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
  }).observe(root);

  // Keyboard users: focusing a claim's link moves the scroll to that claim's beat.
  items.forEach((it, i) => {
    it.addEventListener("focusin", () => {
      const top = root.getBoundingClientRect().top + window.scrollY;
      const target = top + (i + 1 + 0.6) * segLen;
      if (Math.abs(window.scrollY - target) > segLen * 0.5) window.scrollTo({ top: target });
    });
  });

  let rt = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      layout();
      render();
    }, 80);
  });
  const img = sheet.querySelector("img");
  layout();
  render();
  if (img && !img.complete) img.addEventListener("load", () => { last = -1; render(); }, { once: true });
}
