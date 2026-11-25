// Projects, sideways. On a wide screen with motion allowed the four projects become one pinned
// track: scrolling down slides the panels sideways, with a short rest on each. It stays a plain
// vertical list when the screen is narrow or short, when motion is reduced, without JS, or when any
// panel would not fit the stage (it measures, then backs off).

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type Track = {
  /** The scroll position that shows `el`, when it sits in the track and the track is on; else null. */
  scrollYFor(el: Element): number | null;
};

export function initTrack(root: HTMLElement, reduced: boolean): Track {
  const rail = root.querySelector<HTMLElement>("[data-track-rail]");
  const countEl = root.querySelector<HTMLElement>("[data-track-count]");
  const bar = root.querySelector<HTMLElement>("[data-track-bar]");
  if (!rail) return { scrollYFor: () => null };

  const panels = Array.from(rail.children) as HTMLElement[];
  const names = panels.map((p) => p.querySelector(".title")?.textContent?.trim() ?? "");
  const N = panels.length;

  let on = false;
  let step = 0; // px from one panel's start to the next
  let hold = 0; // scroll spent resting on a panel
  let move = 0; // scroll spent sliding to the next
  let unit = 0;
  let total = 0;
  let last = -1;
  let shown = -1;

  const wanted = () => !reduced && N > 1 && window.innerWidth >= 1024 && window.innerHeight >= 680;

  const off = () => {
    on = false;
    root.classList.remove("is-track");
    root.style.height = "";
    rail.style.transform = "";
  };

  const layout = () => {
    if (!wanted()) return off();
    root.classList.add("is-track");
    rail.style.transform = "";
    // every panel must fit the stage; a panel that would need its own scroll means: stay vertical
    if (panels.some((p) => p.scrollHeight > p.clientHeight + 2)) return off();
    on = true;
    step = panels[1].offsetLeft - panels[0].offsetLeft;
    hold = window.innerHeight * 0.3;
    move = window.innerHeight * 0.9;
    unit = hold + move;
    total = N * hold + (N - 1) * move;
    root.style.height = `${window.innerHeight + total}px`;
    last = -1;
    shown = -1;
  };

  const render = () => {
    if (!on) return;
    const s = clamp(-root.getBoundingClientRect().top, 0, total);
    if (s === last) return;
    last = s;
    const k = Math.min(N - 1, Math.floor(s / unit));
    const f = k >= N - 1 ? 0 : clamp((s - k * unit - hold) / move);
    rail.style.transform = `translate3d(${(-(k + ease(f)) * step).toFixed(1)}px, 0, 0)`;
    if (bar) bar.style.transform = `scaleX(${(s / total).toFixed(4)})`;
    const cur = f > 0.5 ? k + 1 : k;
    if (cur !== shown && countEl) {
      shown = cur;
      countEl.innerHTML = `Project <b>${cur + 1}</b> of ${N} · ${names[cur]}`;
    }
  };

  const yForPanel = (i: number) => root.getBoundingClientRect().top + window.scrollY + i * unit + hold * 0.5;

  // keyboard: tabbing into a panel brings it on stage
  panels.forEach((p, i) => {
    p.addEventListener("focusin", () => {
      if (!on) return;
      const y = yForPanel(i);
      if (Math.abs(window.scrollY - y) > hold * 0.5) window.scrollTo({ top: y });
    });
  });

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

  let rt = 0;
  const relayout = () => {
    layout();
    render();
  };
  window.addEventListener("resize", () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(relayout, 120);
  });
  relayout();
  // the fit check depends on the real fonts
  document.fonts?.ready.then(relayout);

  return {
    scrollYFor(el: Element) {
      if (!on || !root.contains(el)) return null;
      const i = panels.findIndex((p) => p.contains(el));
      return i < 0 ? yForPanel(0) - hold * 0.5 : yForPanel(i);
    },
  };
}
