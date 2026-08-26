# Design QA — Main Reservoir Graphic 3D UI

- Source visual truth: `images/digital-twin/design-target-graphic-3d-v1.png` (`853 x 1844`)
- Generated hero: `images/digital-twin/main-reservoir-isometric-v1.png` (`1086 x 1448`)
- Transparent brand asset: `images/digital-twin/fus-logo-white-v1.png`
- Local visual canary: `/?sensorPreview=1&qa=1`
- Reference and implementation viewport: `390 x 844 CSS px`, `deviceScaleFactor: 1`
- Preview telemetry: `0.577 m`, `104.9 m3`, `13.1%`, `6.40 mA`
- Safety state: `DATA ONLY · SAFE_OFF`; no pump, valve, or relay command control is rendered.

## Visual evidence

- Full reference/implementation comparison: `qa/comparison-pass2.png`
- Mobile viewport: `qa/implementation-mobile-390x844.png`
- Mobile full page: `qa/implementation-mobile-390-full.png`
- Desktop viewport: `qa/implementation-desktop-1024x1000.png`
- Browser measurements and interaction evidence: `qa/browser-evidence.json`

The source was resized to `390 x 844` and placed beside the browser-rendered implementation in one comparison image. The final mobile layout has no horizontal overflow. The rendered document height is `866 px`; the `SAFE_OFF` footer is reachable and begins inside the target viewport at `y=826 px`, matching the source's intentionally edge-cropped footer treatment.

## Comparison history

### Pass 1

- [P1] White square appeared behind the logo.
  - Fix: generated and used a transparent white brand asset.
- [P1] Header occupied a separate solid block and pushed the reservoir below the source composition.
  - Fix: overlaid the header on the hero with a source-aligned transparent gradient.
- [P2] Main metrics and charts were too tall for the mobile composition.
  - Fix: reduced metric spacing and chart canvas height while preserving labels and legibility.
- [P1] A cloud-sync failure toast obscured the metrics during local visual QA.
  - Fix: the read-only QA harness now returns an inert local response for the cloud boot check.

### Pass 2

- Full-view side-by-side comparison completed at the same viewport.
- Header, logo, status, reservoir crop, water-level callouts, primary metrics, charts, and footer align with the selected visual direction.
- No remaining actionable P0, P1, or P2 visual differences.
- [P3] The implementation hero has subtler depth-contour detailing than the concept source; this does not affect hierarchy, telemetry reading, or the approved graphic direction.

## Functional and responsive checks

- Mobile: `390 x 844`; scroll width `390`; no horizontal overflow.
- Desktop: `1024 x 1000`; centered app width `760`; no horizontal overflow.
- Canvas evidence: capacity gauge, depth profile, and 24-hour history all produced non-empty pixel output.
- Capacity gauge uses its actual `58 x 62 CSS px` slot, so the complete base ring and the `13.1%` progress arc remain visible without horizontal scaling.
- Keyboard focus is visible on the logo navigation button.
- Logo navigation works and the digital-twin view can be reopened.
- Local `sensorPreview=1` bypasses the login gate only on `localhost/127.0.0.1`; `auth-locked` is false, the gate is hidden, and no persistent session is stored.
- Footer is reachable.
- Forbidden output text check is false for `เปิดปั๊ม`, `เปิดวาล์ว`, and `สั่งรีเลย์`.
- Browser console errors: none.
- Browser page errors: none.
- Automated syntax and safety suite: `16/16` passed.

final result: passed
