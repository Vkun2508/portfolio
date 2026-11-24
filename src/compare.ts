// Before/after slider over the real chess scene. Pointer drag on the photo (vertical page scroll
// still works on touch), keyboard and screen readers through the range input.
const LABELS: Record<string, string> = {
  traditional: "Traditional ISP <b>18.1 dB</b>",
  raw: "RAW as captured",
  truth: "Ground truth",
};

export function initCompare(root: HTMLElement, reduced: boolean) {
  const frame = root.querySelector<HTMLElement>(".compare-frame");
  const range = root.querySelector<HTMLInputElement>("[data-compare-range]");
  const controls = root.querySelector<HTMLElement>("[data-compare-controls]");
  const leftLabel = root.querySelector<HTMLElement>("[data-left-label]");
  if (!frame || !range || !controls || !leftLabel) return;

  root.classList.add("is-live");
  range.hidden = false;
  controls.hidden = false;

  let pos = 50;
  const set = (v: number) => {
    pos = Math.min(100, Math.max(0, v));
    frame.style.setProperty("--pos", `${pos}%`);
    range.value = String(pos);
    range.setAttribute("aria-valuetext", `${Math.round(100 - pos)}% of the photo shows the hybrid output`);
  };
  set(50);

  range.addEventListener("input", () => set(parseFloat(range.value)));

  let dragging = false;
  const fromEvent = (e: PointerEvent) => {
    const r = frame.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100);
  };
  frame.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    nudging = false;
    frame.setPointerCapture(e.pointerId);
    fromEvent(e);
  });
  frame.addEventListener("pointermove", (e) => {
    if (dragging) fromEvent(e);
  });
  const end = () => {
    dragging = false;
  };
  frame.addEventListener("pointerup", end);
  frame.addEventListener("pointercancel", end);

  controls.querySelectorAll<HTMLInputElement>('input[name="left"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      frame.querySelectorAll<HTMLElement>("[data-left]").forEach((pic) => {
        pic.hidden = pic.dataset.left !== radio.value;
      });
      leftLabel.innerHTML = LABELS[radio.value] ?? "";
    });
  });

  // One small sweep the first time the slider is seen, so it reads as something to drag.
  let nudging = false;
  if (!reduced) {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        nudging = true;
        const t0 = performance.now();
        const keys = [50, 34, 62, 50];
        const dur = 1700;
        const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const step = (now: number) => {
          if (!nudging) return;
          const t = Math.min(1, (now - t0 - 500) / dur);
          if (t >= 0) {
            const seg = Math.min(keys.length - 2, Math.floor(t * (keys.length - 1)));
            const local = ease(t * (keys.length - 1) - seg);
            set(keys[seg] + (keys[seg + 1] - keys[seg]) * local);
          }
          if (t < 1) requestAnimationFrame(step);
          else nudging = false;
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(frame);
  }
}
