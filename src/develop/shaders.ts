// The hero "develop" shader. Seven stages, in the order the hybrid ISP runs them:
// 1 Bayer mosaic · 2 noise-level map · 3 neural denoiser · 4 noise-model bound ·
// 5 demosaic · 6 white balance and colour · 7 tone (the hybrid output).
// The noise model is the one the pipeline estimated on the real test scene:
// sigma^2 = 1.1e-2 * x + 7.4e-4.

export const VERT = /* glsl */ `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uText;
uniform vec2 uRes;
uniform float uP;
uniform float uAlt;
uniform float uTime;
uniform float uCell;
uniform float uDpr;
uniform vec2 uMouse;
uniform float uLoupe;
uniform vec3 uGround;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec3 uBound;

const float NLF_A = 0.011;
const float NLF_B = 0.00074;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float gauss(vec2 p, float t) {
  float u1 = max(hash12(p + vec2(t * 17.0, t * 7.0)), 1e-4);
  float u2 = hash12(p * 1.37 + vec2(t * 3.0 + 19.1, t * 11.0 + 5.3));
  return sqrt(-2.0 * log(u1)) * cos(6.2831853 * u2);
}

float seg(float p, float k) {
  return clamp(p * 7.0 - k, 0.0, 1.0);
}

float bump(float t) {
  return smoothstep(0.0, 0.22, t) * (1.0 - smoothstep(0.72, 1.0, t));
}

// Polynomial fit of matplotlib's inferno, the colormap the pipeline's own noise maps use.
vec3 inferno(float t) {
  const vec3 c0 = vec3(0.0002189403691192265, 0.001651004631001012, -0.01948089843709184);
  const vec3 c1 = vec3(0.1065134194856116, 0.5639564367884091, 3.932712388889277);
  const vec3 c2 = vec3(11.60249308247187, -3.972853965665698, -15.9423941062914);
  const vec3 c3 = vec3(-41.70399613139459, 17.43639888205313, 44.35414519872813);
  const vec3 c4 = vec3(77.162935699427, -33.40235894210092, -81.80730925738993);
  const vec3 c5 = vec3(-71.31942824499214, 32.62606426397723, 73.20951985803202);
  const vec3 c6 = vec3(25.13112622477341, -12.24266895238567, -23.07032500287172);
  return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
}

vec3 develop(vec2 frag, float p) {
  float s0 = seg(p, 0.0);
  float s1 = seg(p, 1.0);
  float s2 = seg(p, 2.0);
  float s3 = seg(p, 3.0);
  float s4 = seg(p, 4.0);
  float s5 = seg(p, 5.0);
  float s6 = seg(p, 6.0);

  // Sensor cells: stage 1 settles from coarse to the mosaic pitch, stage 5 resolves to single pixels.
  float cell = uCell * (1.0 + 0.45 * (1.0 - smoothstep(0.0, 1.0, s0)));
  cell = mix(cell, 1.0, smoothstep(0.0, 1.0, s4));
  vec2 cc = floor(frag / cell);
  vec2 centre = (cc + 0.5) * cell;

  float cov = texture2D(uText, centre / uRes).a;
  vec3 truth = mix(uGround, uInk, cov);

  // Signal-dependent noise from the real noise model, removed by the denoiser (3) and the bound (4).
  float amt = 1.0 - 0.86 * smoothstep(0.0, 1.0, s2) - 0.14 * smoothstep(0.0, 1.0, s3);
  vec3 n = vec3(gauss(cc, uTime), gauss(cc + 31.7, uTime), gauss(cc + 71.3, uTime));
  vec3 sigma = sqrt(NLF_A * truth + NLF_B) * 2.4;
  vec3 noisy = truth + n * sigma * amt;

  // RGGB colour filter array.
  vec2 par = mod(cc, 2.0);
  vec3 cfa = par.y < 0.5
    ? (par.x < 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0))
    : (par.x < 0.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  vec3 mosaic = noisy * cfa * vec3(1.05, 0.92, 1.25);

  // Camera colour before white balance (6), flat tone before the tone curve (7).
  vec3 camTint = mix(vec3(0.70, 1.0, 0.62), vec3(1.0), smoothstep(0.0, 1.0, s5));
  vec3 col = mix(noisy * camTint, mosaic, 1.0 - smoothstep(0.0, 1.0, s4));
  float tone = smoothstep(0.0, 1.0, s6);
  col = mix(mix(vec3(0.085), col, 0.78), col, tone);

  // 2: the noise-level map, shown as the pipeline shows it (inferno).
  float sg = sqrt(NLF_A * cov + NLF_B) / 0.108;
  col = mix(col, inferno(clamp(sg * 0.92 + n.g * 0.05, 0.0, 1.0)), bump(s1) * 0.94);

  // 3: what the network removed glows as it leaves.
  col += inferno(clamp(abs(n.g) * 0.42, 0.0, 1.0)) * bump(s2) * 0.6 * (0.25 + cov);

  // 4: the noise-model bound caps about one cell in ten where there is signal.
  float edge = clamp(cov * (1.0 - cov) * 4.0 + cov * 0.4, 0.0, 1.0);
  float capped = step(hash12(cc + 7.0), 0.099 * 2.2 * edge);
  col = mix(col, uBound, capped * bump(s3) * 0.95);

  return clamp(col, 0.0, 1.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec3 col = develop(frag, uP);

  if (uLoupe > 0.5) {
    float d = distance(frag, uMouse);
    float m = 1.0 - smoothstep(uLoupe - 1.5 * uDpr, uLoupe, d);
    if (m > 0.0) {
      col = mix(col, develop(frag, uAlt), m);
    }
    float ring = 1.0 - smoothstep(0.0, 1.25 * uDpr, abs(d - uLoupe));
    col = mix(col, uAccent, ring);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;
