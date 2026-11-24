# Direction contract (v2: "Verified")

v1 ("Develop", the camera-pipeline shader) scored 7.3 from a blind juror and was replaced at the owner's
request: the site should not be built around one project, and must not read as dependence on AI.

```
DIRECTION   Verified: the portfolio that audits itself
IDEA        On this site, Vinochan's resume is audited the way his LegalLens tool audits a contract:
            every claim is found in the PDF's text layer with its character range and checked against
            a receipt. Competitor test: only the person who built a clause-flagging NLP tool frames a
            resume this way, and the receipts are his alone.
SURFACES    / → Experience · /404 → Experience (same world: "Claim not found")
FIRST VIEW  The name set huge, one line on who he is, the hook ("Resumes are easy to inflate, so I
            audited mine"), Download resume (primary) and the tally card: 7 verified · 2 on request · 1 pending.
LIVE THING  Every claim in the audit opens its receipt in a dialog (IEEE page, merged PR, test run,
            benchmark table, live demo, certificates). Without JS the same links are anchors.
            Second live thing kept from v1: the before/after slider on the ISP's real output.
SIGNATURE   The audit scene (src/audit.ts). A pinned stage: the real resume page (rendered from the PDF,
            phone number redacted) is the lens; scrolling moves a camera from claim to claim, the claim is
            highlighted at its real position, a rubber stamp lands (Verified / On request / Pending /
            Understated), the log beside it shows the quote, its character range and the finding, and a
            final seal reads "Audited 25 Nov 2026". Reduced motion: the stamped page sits still beside the
            full list. No JS: the page image and the list.
PALETTE     ground #111214 · surface #1a1b1e · ink #e7e7e3 · muted #aeada6 · accent #f5a33a (actions,
            verified chips, the winning figure) · paper #ffffff · stamp ink #b45309 / #1d1d1f / #6b6a64.
TYPE        Hubot Sans (display, 700, wdth 125% name / 112.5% titles / 87.5% stamps) · Mona Sans (text,
            400/600/700; figures with zeros use Mona: Hubot only has a barred zero). SIL OFL.
SHAPE       radius 0 · depth by tone steps (ground → surface → raise)
IMAGERY     only real artefacts: the resume page, IEEE Xplore capture, GitHub PR capture, live-demo
            capture, LegalLens phone and desktop sessions, Neralu console, certificates, ISP outputs.
MOTION      motion.css tokens · the audit scene · stamp landing (300 ms) and a 2 px thud · title rise ·
            slider nudge · dialog fade. Lenis on desktop scroll.
LIFTED      micro-label (inspect --allow micro-label): the uppercase, letter-spaced stamps are the
            signature device, a real rubber-stamp form on the paper, not interface labels.
NOT THIS    a terminal/hacker dev portfolio · a SaaS hero · v1's camera-pipeline shader
```

## Receipts and how they were made

- Claims and character ranges: `scripts/receipts.py` (pypdfium2) → `src/data/claims.json`.
- LegalLens test run (99 passed): `public/receipts/legallens-pytest.txt`, run 25 Nov 2026 at ef4192b.
- ISP numbers: hybrid-isp `results/benchmarks.json` (commit 1e79645).
- Neralu: merged PR #20, Priyanshu-senapati/Neralu.
- Paper: IEEE Xplore document 11656530 (public abstract page).
- Pending receipts: proof of the CV Hackathon 1st place and the Hack4SDG finalist placing (owner to supply).
