import { FRAG, VERT } from "./shaders";

export interface DevelopOptions {
  /** Element the canvas fills (the sticky hero stage). */
  stage: HTMLElement;
  /** The heading whose `.line` children are drawn into the texture. */
  heading: HTMLElement;
  /** Returns the current progress, 0 = RAW, 1 = developed. */
  progress: () => number;
  /** Called when the progress changes, with the value used for the frame. */
  onProgress?: (p: number) => void;
  /** Whether the pointer loupe is allowed (fine pointers only). */
  loupe?: boolean;
  /** Mosaic pitch as a fraction of the font size (font size / cellDivisor). */
  cellDivisor?: number;
}

const hex = (h: string): [number, number, number] => {
  const v = h.trim().replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as [number, number, number];
};

/** Returns null when WebGL is unavailable; the caller then leaves the HTML heading as it is. */
export function createDevelop(opts: DevelopOptions) {
  const { stage, heading } = opts;
  const canvas = document.createElement("canvas");
  canvas.className = "hero-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
  } catch (err) {
    console.warn("[develop] WebGL shader failed, keeping the plain heading.", err);
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = {
    text: u("uText"), res: u("uRes"), p: u("uP"), alt: u("uAlt"), time: u("uTime"), cell: u("uCell"),
    dpr: u("uDpr"), mouse: u("uMouse"), loupe: u("uLoupe"), ground: u("uGround"), ink: u("uInk"),
    accent: u("uAccent"), bound: u("uBound"),
  };

  const css = getComputedStyle(document.documentElement);
  gl.uniform3fv(U.ground, hex(css.getPropertyValue("--c-ground") || "#111214"));
  gl.uniform3fv(U.ink, hex(css.getPropertyValue("--c-ink") || "#e7e7e3"));
  gl.uniform3fv(U.accent, hex(css.getPropertyValue("--c-amber") || "#f5a33a"));
  gl.uniform3fv(U.bound, hex(css.getPropertyValue("--c-bound") || "#e5566f"));

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.text, 0);

  const textCanvas = document.createElement("canvas");
  const tctx = textCanvas.getContext("2d")!;

  let dpr = 1;
  let w = 0;
  let h = 0;
  let nameRect = new DOMRect();

  // Draw the heading's lines into the texture at exactly their laid-out positions.
  const paintText = () => {
    const sr = stage.getBoundingClientRect();
    textCanvas.width = w;
    textCanvas.height = h;
    tctx.clearRect(0, 0, w, h);
    const cs = getComputedStyle(heading);
    const size = parseFloat(cs.fontSize) * dpr;
    const pct = parseFloat(cs.fontStretch) || 100;
    const KEYS: [number, string][] = [[62.5, "extra-condensed"], [75, "condensed"], [87.5, "semi-condensed"], [100, "normal"], [112.5, "semi-expanded"], [125, "expanded"]];
    const stretch = KEYS.reduce((a, b) => (Math.abs(b[0] - pct) < Math.abs(a[0] - pct) ? b : a))[1];
    tctx.font = `normal normal ${cs.fontWeight} ${stretch} ${size}px ${cs.fontFamily}`;
    tctx.fillStyle = "#fff";
    tctx.textBaseline = "alphabetic";
    tctx.textAlign = "left";
    heading.querySelectorAll<HTMLElement>(".line").forEach((line) => {
      const r = line.getBoundingClientRect();
      const text = (line.textContent || "").trim().toUpperCase();
      const m = tctx.measureText(text);
      const asc = m.fontBoundingBoxAscent;
      const desc = m.fontBoundingBoxDescent;
      const lh = r.height * dpr;
      const top = (r.top - sr.top) * dpr;
      const baseline = top + (lh - (asc + desc)) / 2 + asc;
      tctx.fillText(text, (r.left - sr.left) * dpr, baseline);
    });
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    const hr = heading.getBoundingClientRect();
    nameRect = new DOMRect(hr.left - sr.left, hr.top - sr.top, hr.width, hr.height);
    // Mosaic pitch scales with the name so the letters stay legible at stage 1.
    gl.uniform1f(U.cell, Math.max(3, (parseFloat(cs.fontSize) / (opts.cellDivisor ?? 26)) * dpr));
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = stage.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width * dpr));
    h = Math.max(1, Math.round(r.height * dpr));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.res, w, h);
    gl.uniform1f(U.dpr, dpr);
    paintText();
    dirty = true;
  };

  // ---- loop ----
  let dirty = true;
  let visible = true;
  let raf = 0;
  let lastP = -1;
  let lastTick = -1;
  let mouse = { x: -9999, y: -9999, inside: false };
  let loupeR = 0;
  const LOUPE = 112;

  const frame = (now: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const p = Math.min(1, Math.max(0, opts.progress()));
    const tick = Math.floor(now / 42) % 4096; // grain refresh at ~24 fps, like film
    const target = mouse.inside ? LOUPE * dpr : 0;
    const loupeMoving = Math.abs(target - loupeR) > 0.5;
    loupeR = loupeMoving ? loupeR + (target - loupeR) * 0.22 : target;
    const grainy = p < 0.62 || (loupeR > 0.5 && p > 0.5);
    const changed = dirty || p !== lastP || loupeMoving || (grainy && tick !== lastTick) || (loupeR > 0.5 && mouseMoved);
    if (changed) {
      gl.uniform1f(U.p, p);
      gl.uniform1f(U.alt, p > 0.5 ? 0 : 1);
      gl.uniform1f(U.time, tick % 64);
      gl.uniform1f(U.loupe, loupeR);
      gl.uniform2f(U.mouse, mouse.x * dpr, h - mouse.y * dpr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (p !== lastP) opts.onProgress?.(p);
      lastP = p;
      lastTick = tick;
      dirty = false;
      mouseMoved = false;
    }
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  let mouseMoved = false;
  if (opts.loupe) {
    window.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        const sr = stage.getBoundingClientRect();
        const x = e.clientX - sr.left;
        const y = e.clientY - sr.top;
        const pad = LOUPE * 0.5;
        const inside =
          x > nameRect.left - pad && x < nameRect.right + pad && y > nameRect.top - pad && y < nameRect.bottom + pad;
        mouse = { x, y, inside };
        mouseMoved = true;
      },
      { passive: true },
    );
    document.documentElement.addEventListener("pointerleave", () => {
      mouse.inside = false;
    });
  }

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      dirty = true;
      start();
    }
  });
  io.observe(stage);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      dirty = true;
      start();
    }
  });

  let resizeTimer = 0;
  const ro = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      start();
    }, 60);
  });

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    stage.closest(".hero")?.classList.remove("gl-on");
    canvas.remove();
  });

  return {
    canvas,
    mount() {
      stage.prepend(canvas);
      resize();
      ro.observe(stage);
      start();
    },
    invalidate() {
      dirty = true;
      start();
    },
    repaintText() {
      paintText();
      dirty = true;
      start();
    },
  };
}
