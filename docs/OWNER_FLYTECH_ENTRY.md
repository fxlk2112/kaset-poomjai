# FLYTECH Home entry

Task `OWNER-FLYTECH-ENTRY-001`, owner SUCHA, branch `pick/flytech-entry-v1`.
Source: `origin/develop@40721b5` plus the owner main app checkpoint `9e80e64`; source PRs #5, #6 and #7 are dependencies.

The owner requested a taller Home card, the supplied FLYTECH logo in place of the droplet icon, title `FLYTECH`, subtitle `Precision AgTech Solutions`, and immediate publication to the existing owner main Worker.

The card is 154 CSS pixels tall on tablet/desktop and at least 136 pixels on small phones. The complete subtitle can wrap without ellipsis. The original supplied JPEG is copied unchanged; its metadata contains only orientation, resolution and color information. The card still opens `App.nav('iot')`, preserving the existing plot map and its separate weather/system-health buttons. The app header branding is unchanged.

Only the entry markup/styles, matching existing navigation-test label, logo and release evidence change. Auth, data feeds, backend, Worker configuration, device services and Commerce are outside scope. `DATA_ONLY / SAFE_OFF`.

Local browser checks pass at 360 x 800, 840 x 1180 and 1280 x 900: logo decoded, exact title/subtitle, minimum height, no card/subtitle/page overflow, unchanged map navigation and no script/console errors. See `qa/flytech-entry/`. The existing label assertion was updated to match the owner's new title.

Deploy only the existing owner main Worker using `wrangler.owner-main.jsonc`. Prior frontend rollback version: `0cf534c7-1323-4819-b957-e5ab7c238834`. Current deployment version and independent readback are recorded in `COLLAB_STATUS.md` after release.

Published on 6 September 2026: source `36fe596`, Worker version `86e7be2a-f3f0-4fdd-9913-c776af61638c`. Live build and four asset hashes match, including the supplied logo; backend version is unchanged and output control remains false. All 99 tests pass. Live Chrome viewport checks pass at all three sizes; this is not a physical iPad Safari verification. See [release readback](../qa/flytech-entry/release-readback.json), [tablet](../qa/flytech-entry/tablet-home.png) and [phone](../qa/flytech-entry/phone-home.png).
