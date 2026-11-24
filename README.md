# Vinochan Rajesh · portfolio

Live: https://vinochan-rajesh.vercel.app

A one-page portfolio. The hero runs a WebGL re-enactment of the seven stages of the Hybrid ISP camera pipeline
(1st place, RV University Computer Vision Hackathon 2026) on the name as you scroll.

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build into dist/
npm run images     # rebuild public/img from the project figures (needs assets-src/)
```

- `src/develop/` hero shader (raw WebGL, no library), stage texts
- `src/compare.ts` the before/after slider
- `scripts/export_isp.py` exports full-resolution images from the hybrid-isp pipeline
- `docs/DIRECTION.md` the design contract

Fonts: Hubot Sans and Mona Sans (SIL Open Font License, licences in `public/fonts/`).
