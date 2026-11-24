// The audit: the resume page is the stage. Scrolling moves a camera from claim to claim; each
// claim is underlined where it sits in the PDF and a stamp lands beside it, in the right margin.
// Claim positions and character ranges come from the PDF's text layer
// (scripts/receipts.py -> src/data/claims.json). The log opens on a real LegalLens note, so the
// visitor sees the tool's format before the claims that use it.
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
  const claimItems = claims.map((c) => list.querySelector<HTMLElement>(`[data-claim="${c.id}"]`)!);
  const steps = Array.from(list.children) as HTMLElement[]; // intro, the claims, summary
  const N = claims.length;

  // ---- stamps: in the right margin, level with the claim's first line; stacked if they meet ----
  const STAMP_H = (2.2 * 1.6) / 100 / ASPECT;
  const boxes: Rect[] = [];
  const overlaps = (a: Rect) =>
    boxes.some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h + 0.003 && b.y < a.y + a.h + 0.003);

  const marks: HTMLElement[][] = [];
  const stamps: HTMLElement[] = [];
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
    const text = STAMP_TEXT[c.id] ?? STATUS_TEXT[c.status];
    const w = ((text.length * 0.66 + 1.2) * 2.2) / 100;
    const first = c.rects[0];
    let box: Rect = { x: 0.945, y: first.y + first.h / 2 - STAMP_H / 2, w, h: STAMP_H };
    for (let k = 1; overlaps(box) && k < 8; k++) {
      const dy = Math.ceil(k / 2) * (STAMP_H + 0.004) * (k % 2 ? 1 : -1);
      box = { ...box, y: first.y + first.h / 2 - STAMP_H / 2 + dy };
    }
    boxes.push(box);
    const s = document.createElement("span");
    s.className = "stamp";
    s.dataset.status = c.status;
    s.textContent = text;
    s.style.left = `${box.x * 100}%`;
    s.style.top = `${box.y * 100}%`;
    s.style.setProperty("--rot", `${[-4, -2, -5, -3][stamps.length % 4]}deg`);
    sheet.appendChild(s);
    stamps.push(s);
  });

  const totals = { verified: 0, request: 0, pending: 0 };
  claims.forEach((c) => totals[c.status]++);
  const seal = document.createElement("span");
  seal.className = "seal";
  seal.innerHTML = `Audited 25 Nov 2026<small>${totals.verified} verified · ${totals.request} on request · ${totals.pending} pending</small>`;
  sheet.appendChild(seal);

  // ---- reduced motion: the finished audit, still ----
  if (reduced) {
    stamps.forEach((s) => s.classList.add("is-on"));
    claimItems.forEach((it) => it.classList.add("is-stamped"));
    seal.classList.add("is-on");
    const setUnit = () => sheet.style.setProperty("--u", `${sheet.getBoundingClientRect().width / 100}px`);
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

  const viewFor = (rects: Rect[] | null): View => {
    if (!rects) return { s: 1, tx: (fw - W0) / 2, ty: (fh - H0) / 2 };
    const x0 = Math.min(...rects.map((r) => r.x)) * W0;
    const y0 = Math.min(...rects.map((r) => r.y)) * H0;
    const x1 = Math.max(...rects.map((r) => r.x + r.w)) * W0;
    const y1 = Math.max(...rects.map((r) => r.y + r.h)) * H0;
    const bw = x1 - x0;
    const bh = y1 - y0;
    const s = Math.max(1.2, Math.min((fw * 0.9) / bw, (fh * 0.5) / bh, phone() ? 3.4 : 2.8));
    const tx = fw / 2 - (x0 + bw / 2) * s;
    const ty = fh / 2 - (y0 + bh / 2) * s;
    return { s, tx, ty };
  };

  const layout = () => {
    segLen = window.innerHeight * 0.42;
    root.style.height = `${window.innerHeight + (N + 2) * segLen}px`;
    fw = frame.clientWidth;
    fh = frame.clientHeight;
    W0 = Math.min(fw * 0.86, (fh * 0.96) / ASPECT);
    H0 = W0 * ASPECT;
    sheet.style.setProperty("--w0", `${W0}px`);
    sheet.style.setProperty("--u", `${W0 / 100}px`);
    // each claim is framed together with its stamp in the margin
    views = [viewFor(null), ...claims.map((c, i) => viewFor([...c.rects, boxes[i]])), viewFor(null)];
    last = -1;
    shown = -2;
  };

  const lerpView = (a: View, b: View, t: number): View => ({
    s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * t),
    tx: a.tx + (b.tx - a.tx) * t,
    ty: a.ty + (b.ty - a.ty) * t,
  });

  let last = -1;
  let shown = -2;
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
    const v = seg === 0 ? views[0] : lerpView(views[seg - 1], views[seg], ease(clamp(f / 0.4)));
    sheet.style.transform = `translate3d(${v.tx}px, ${v.ty}px, 0) scale(${v.s})`;

    // stamps
    const active = seg >= 1 && seg <= N ? seg - 1 : seg > N ? N : -1;
    let landed = false;
    for (let i = 0; i < N; i++) {
      const should = i < active || (i === active && f >= 0.42) || seg > N;
      if (should !== on[i]) {
        on[i] = should;
        stamps[i].classList.toggle("is-on", should);
        claimItems[i].classList.toggle("is-stamped", should);
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

    // the log: intro note, then each claim, then the summary
    if (seg !== shown) {
      shown = seg;
      steps.forEach((it, i) => {
        it.classList.toggle("is-active", i === seg);
        it.classList.toggle("is-done", i < seg);
        it.classList.toggle("is-near", Math.abs(i - seg) <= 1);
      });
      win.classList.toggle("is-moved", seg > 0);
      const focus = steps[seg];
      const y = seg === 0 ? 0 : win.clientHeight * 0.12 - focus.offsetTop;
      list.style.setProperty("--log-y", `${Math.min(0, y)}px`);
    }

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

  // Keyboard users: focusing a step's link moves the scroll to that step.
  steps.forEach((it, i) => {
    it.addEventListener("focusin", () => {
      const top = root.getBoundingClientRect().top + window.scrollY;
      const target = top + (i + 0.6) * segLen;
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
  layout();
  render();
  const img = sheet.querySelector("img");
  if (img && !img.complete) img.addEventListener("load", () => { last = -1; render(); }, { once: true });
}
