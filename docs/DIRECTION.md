# Direction contract

```
DIRECTION   Develop, chosen over Poster wall and 3D flythrough: only Vinochan built this pipeline
IDEA        On this site, Vinochan's own hybrid ISP becomes the scroll: his name arrives as a noisy
            RAW sensor readout and develops, stage by stage, into a clean image.
            Competitor test: another CS student's portfolio fails, because they did not build or win with this pipeline.
SURFACES    / → Experience · /404 → Experience (same world)
FIRST VIEW  The name as a live RGGB mosaic with sensor grain, the plain HTML supporting line, two buttons
            and a stage readout "1/7 Bayer mosaic". Phone: same, name semi-condensed on two lines.
LIVE THING  Drag slider over the real Nexus 6 ISO 3200 chess scene: Traditional (18.1 dB) vs Hybrid (25.6 dB),
            with RAW-as-captured and ground-truth options. Pointer drag plus a range input for keyboard.
            Without JS: the two images side by side with captions.
SIGNATURE   Hero shader (raw WebGL, src/develop). Scrolling the pinned hero runs the 7 stages:
            Bayer mosaic → noise-level map (σ² = 1.1e-2·x + 7.4e-4, the pipeline's own estimate) →
            neural denoiser → noise-model bound → demosaic → white balance → tone. Ends on the real result
            (29.84 dB vs 25.40 dB). Fine pointer: a loupe shows the other state under the cursor.
            Reduced motion / no WebGL / no JS: the plain HTML <h1>.
PALETTE     ground #111214 · surface #1a1b1e · ink #e7e7e3 · muted #aeada6 · accent #f5a33a (inferno amber)
            · bound red #e5566f (only inside the shader and the stage figure). palette.mjs: PASS.
TYPE        Hubot Sans (display, wdth 125% desktop / 87.5% phone, 700) · Mona Sans (text, 400/600). SIL OFL.
SHAPE       radius 0 · depth by tone steps only (ground → surface)
IMAGERY     only the project's own figures and screenshots (scripts/export_isp.py, scripts/images.mjs).
            Treatment: pictures develop in (grain layer lifting off + clip reveal).
MOTION      tokens in src/styles/motion.css · hero scrub · pinned 7-stage strip (≥1024px) · title rise · slider nudge
LIFTED      none
NOT THIS    terminal/hacker-green dev portfolio · centred mesh-gradient SaaS hero · Leasedraw and LegalLens v2 looks
```
