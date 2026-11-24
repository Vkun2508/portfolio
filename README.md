# Vinochan Rajesh · portfolio

Live: https://vinochan-rajesh.vercel.app

A one-page portfolio that audits its owner's resume: every claim is found in the PDF's text layer with its
character range (the way his LegalLens tool flags contract clauses) and checked against a receipt you can open.

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build into dist/
npm run images     # rebuild public/img from the project figures (needs assets-src/)
```

- `src/audit.ts` the audit scene (pinned scroll, camera over the resume page, stamps)
- `scripts/receipts.py` finds each claim in the resume PDF and renders the page and certificates
- `src/compare.ts` the before/after slider on the Hybrid ISP output
- `scripts/export_isp.py` exports full-resolution images from the hybrid-isp pipeline
- `docs/DIRECTION.md` the design contract

Fonts: Hubot Sans and Mona Sans (SIL Open Font License, licences in `public/fonts/`).
