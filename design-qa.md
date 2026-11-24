# Landing Design QA

Date: 2026-09-07
Build: 20260907landingsoft1
final result: passed

## Scope

Implement selected direction 3 with softer typography, natural photography, and simpler content. Keep the existing logo and the authenticated application. Local preview only; no commit, push, deployment, account creation, or production data changes performed.

Preview: http://127.0.0.1:4183/?landing=1&build=20260907landingsoft1

Source visual truth:
`C:/Users/USER/.codex/generated_images/01a0706b-5ca9-74a1-8974-9dd8f1c04c57/exec-0f041b4b-e99b-4aac-9474-b9d5ebc500a9.png`

Evidence directory:
`C:/Users/USER/.codex/visualizations/2026/09/05/01a0706b-5ca9-74a1-8974-9dd8f1c04c57/landing-soft-qa/`

Implementation screenshot:
`C:/Users/USER/.codex/visualizations/2026/09/05/01a0706b-5ca9-74a1-8974-9dd8f1c04c57/landing-soft-qa/final-reviewed-1023.png`

## Evidence and Normalization

- Source: 1023 x 1537 pixels, a complete page mock, not a device frame.
- Primary implementation: 1023 x 2200 CSS pixels, DPR 1, screenshot 1023 x 2200. Same width, public page at scroll top, closed FAQs and dialogs. The actual content is about 2151 pixels high. The taller page intentionally accommodates real copy, accessible controls, and a genuine app screenshot; neither image was stretched vertically for comparison.
- `comparison-reviewed-full.png`: source and implementation together on a shared canvas, aligned at the top; empty canvas beneath the shorter source is not page content.
- `comparison-final-hero.png`: focused hero/header comparison. The last copy-only adjustment did not change this region.
- `comparison-reviewed-product.png`: same-width product region crops from the source and post-fix implementation. Actual product imagery intentionally differs from the generated UI in the mock.
- `comparison-mobile-trial.png`: source experiment band alongside the final 390 x 844 mobile capture, explicitly a responsive comparison rather than a pixel-identical viewport claim.
- Additional inspected captures: `final-desktop-1440.png`, `final-wide-1920.png`, `final-mobile-320.png`, `mobile-390.png`, `lower-900.png`, `faq-mobile.png`, `register-mobile.png`, and `reviewed-mobile-trial.png`.
- Viewports checked: 320 x 740, 390 x 844, 900 x 800, 1023 x 1537/2200, 1440 x 1000, and 1920 x 1080.
- Some early full-page capture attempts returned blank or malformed raster output despite correct DOM geometry. Those captures were rejected, not used as evidence or public assets. The accepted app image is `actual-app-1280.png`, a normal viewport capture.

## Comparison History

1. P2: legacy landing styles leaked into the new page. Header height was 115px instead of the intended compact header, the brand subtitle had insufficient contrast, and a mint background replaced white. Evidence: `comparison-01.png`. Removed only the obsolete public-landing block from the shared stylesheet and isolated the new styles. Header is now 86px at 1440px, with a readable subtitle and white content bands.
2. P2: tablet hero and experiment band were too tall, and initial product text was difficult to inspect. Evidence: `comparison-02.png`. Reduced the tablet hero, shortened redundant copy, removed the additional experiment link, and captured the authentic app again at 1280 x 1000. Updated image dimensions and aspect ratio without stretching. Post-fix evidence: `comparison-reviewed-full.png` and `comparison-reviewed-product.png`.
3. P2: mobile final heading left a one-word last line. Evidence: `faq-mobile.png`. Replaced the heading with shorter Thai copy. Post-fix evidence: `lower-900.png` and the final whole-page comparison; 320px geometry check found no horizontal overflow.
4. P2: hiding desktop line breaks joined two Thai clauses on mobile. Evidence: `final-mobile-trial.png`. Added real whitespace after the breaks, then recaptured and compared. Post-fix evidence: `reviewed-mobile-trial.png` and `comparison-mobile-trial.png`.

No actionable P0/P1/P2 visual or interaction findings remain within this local redesign scope.

## Required Fidelity Surfaces

- Fonts and typography: retain Sarabun with Thai/system fallbacks. Headings use 500 weight, supporting text 400-500, and controls 600. Fixed breakpoint sizes replace viewport-scaled fonts; letter spacing is zero. Thai wrapping, labels, primary heading, and long mobile FAQ answers were inspected. Source uses a generated approximation of typography; retaining the real product font is intentional.
- Spacing and layout: preserve full-bleed farm hero, asymmetric product section, full-width forest experiment band, two-column onboarding/FAQ area, and compact footer. Controls have 6px radii, media/dialogs at most 8px. Sections are not nested cards. Wider vertical spacing and 44px minimum primary navigation/form controls intentionally replace the mock's tiny lower controls.
- Colors and tokens: white, forest green #173e2d, yellow #ffd12f, pale blue #eff5fa, and neutral text. No decorative gradients, orbs, or drawn hero illustration. The hero has only a subtle uniform overlay and text shadow for readability. Existing app theme does not recolor public content or the form. Library icons are neutral rather than the mock's green/blue; accepted as a restrained visual choice.
- Images and assets: separate generated farm and experiment photographs match the selected subjects and composition. Optimized WebP assets total about 684KB. The app proof is a genuine screenshot using isolated synthetic data, labeled as sample data, with an enlargement dialog. The current logo is preserved byte-for-byte; the generated approximation is not used. Icons come from the official Lucide source and retain the ISC license in `images/landing-icons/LICENSE`.
- Copy and content: removed fictional package tiers, invented metrics, repeated feature grids, and unsupported team/AI implications. Trial comparison is included. Financial copy is limited to recorded entries. Offline and cross-device synchronization limitations are explicit. No invented testimonials, contact address, prices, yield claims, or guarantees were introduced.

## Interaction and Regression Checks

- Header navigation, responsive menu opening/closing, anchor scrolling, and all registration/login entry points tested.
- App screenshot enlargement opens, closes with Escape, and returns focus to its trigger.
- FAQ expands/collapses with readable mobile answers.
- Privacy and terms links open native dialogs; direct policy URLs remain accessible with an existing session. Escape closes them.
- Authentication has associated labels, dialog semantics, pressed mode state, password-manager autocomplete, live status, Escape handling, and keyboard focus wrapping.
- Background is hidden from accessibility navigation with aria-hidden and inert attributes while authentication is open. Underlying app is not displayed while auth-locked. Focus returns to the opener, or the menu toggle when its original mobile trigger is collapsed.
- Empty registration produces validation feedback without creating an account. Rapid close before the delayed focus callback does not steal focus back.
- Existing authenticated preview still renders and syncs after leaving the landing. No internal data changes were made for the redesign.
- DOM geometry checks found no horizontal overflow at the checked widths. At 1440 x 1000 the hero ends at y=646; at 1920 x 1080 it ends at y=756, leaving the next section visible. The 320px view also retains a next-section hint.
- All public images loaded after scrolling into view. Browser error logs were empty in the tested final states.
- `node --test --test-reporter=dot tests/interior.test.cjs tests/trials.test.cjs tests/offline.test.cjs tests/recovery.test.cjs tests/landing.test.cjs`: 107 passed, zero failures.
- Syntax checks passed for `js/auth.js` and `js/landing.js`. `git diff --check` passed.
- New local CSS and JavaScript are included in atomic service-worker shell precaching. Offline tests now verify every locally linked stylesheet as well as every local script.

## Remaining Publication Checks

- The existing privacy text mentions a support email but the project has no confirmed public contact address. Its policy meaning was preserved; the owner was asked for a real contact channel. Supply that before publishing. This is an existing content/ownership prerequisite, not a claim of legal-policy review.
- Google OAuth end-to-end consent and real account creation were not repeated. The isolated preview deliberately uses its mock API, so it displays the unconfigured-Google fallback. Production Google configuration and Worker authentication logic were not changed.
- This pass is visual/interaction QA, not a formal accessibility certification or legal review. No Lighthouse run or physical-phone test was performed.

## Implementation Checklist

- [x] Apply refined direction 3 to the existing public page.
- [x] Preserve current logo, internal features, and prior workspace changes.
- [x] Replace fake interface artwork with authentic sample-data proof.
- [x] Verify responsive layout, modal access, navigation, and regressions.
- [x] Keep the working local preview open.
- [ ] Confirm public support contact before a separate deployment request.
