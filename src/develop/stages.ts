// What the readout says at each stage. The last line is the pipeline's real evaluation result.
export const STAGES: { name: string; note: string }[] = [
  { name: "Bayer mosaic", note: "One colour sample per pixel, as the sensor records it." },
  { name: "Noise-level map", note: "Noise estimated from the image itself: σ² = 1.1e-2·x + 7.4e-4." },
  { name: "Neural denoiser", note: "A compact network removes noise from the RAW signal." },
  { name: "Noise-model bound", note: "Changes larger than 2σ are capped, so the network cannot invent detail." },
  { name: "Demosaic", note: "Full colour rebuilt at every pixel." },
  { name: "White balance and colour", note: "Camera colour converted to what your eye expects." },
  { name: "Hybrid output", note: "29.84 dB mean PSNR on 26 held-out phone images. Traditional pipeline: 25.40 dB." },
];
