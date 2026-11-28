# Reliability Changes - 2026-09-07

Preview: http://127.0.0.1:4182/?build=20260907reliability1

## Changes

- New receipt items snapshot `costTotal`. Retained units preserve that cost during edits; added units use the staged stock cost. Duplicate product lines are handled together.
- Old receipts without a stored cost return an unknown cost, not today's stock price or zero. Annual cost/profit cards explicitly show incomplete data. No historical costs were invented.
- Voiding retains the receipt and its original items, records `voidedAt`, returns stock once, and disables editing. All sales/customer aggregates exclude void receipts. Shared/printed summaries carry the void status.
- `saleSequence` and the maximum retained number allocate the next number. Cancellation and ordinary category clearing no longer reuse numbers; cloud pulls and recovery preserve the high-water mark. Existing duplicate legacy numbers are not silently rewritten.
- Receipts stay white and legible inside both light and dark app themes. History rows are native buttons.
- Conflict comparison shows section counts and local-only/cloud-only/changed record names, including nested trial differences. Replacement remains whole-snapshot, not automatic record merging.
- Both sides are saved to account-scoped IndexedDB recovery points before approved conflict replacement. The last five points per account are retained transactionally. Settings offers export and restore. Restore itself first saves the current state.
- Backup failure, changed local snapshots, changed cloud revisions, and account changes prevent replacement. Cloud data is persisted before replacing in-memory state so a failed local write cannot discard existing work.
- Service worker precaches required local scripts/CSS/HTML before activation, uses cached responses on network failure or HTTP errors, handles navigation query changes, and limits cache cleanup to this app. Slow network requests fall back after 3.5 seconds when a cached response exists. Build changes no longer erase caches or unregister the worker.
- Photo uploads skip the network while offline and have a 20-second timeout; existing local image fallback is preserved.

## Verification

`node --test tests/interior.test.cjs tests/trials.test.cjs tests/offline.test.cjs tests/recovery.test.cjs`

Result: **89 passed, 0 failed**. Syntax checks passed for modified application scripts and the service worker. `git diff --check` passed (line-ending warnings only).

The new cases cover snapshot costs, legacy unknown costs, edit/void stock valuation, duplicate receipt lines, numbering gaps, all sales aggregates, conflict and restore races, quota failure, account-scoped retention, transactional backup failure, embedded photos, two independent simulated device clients, and service-worker install/fetch behavior.

## Browser Scenarios

Only isolated preview data was used. No production accounts or farm records were modified.

1. Created receipt #1 for 900 with stored cost 750; local stock fell from 10 to 9. Simulated a remote activity while the sale form was open. Conflict UI identified the additional remote activity and local receipt/stock changes.
2. Approved local replacement. Actual browser IndexedDB stored both snapshots. Recovery points remained available after page reload.
3. Restored the saved cloud side: the extra activity returned and sales became zero. Restored the saved local side: receipt #1 and the 900 sale returned. Each restore created a preceding recovery point.
4. Returned HTTP 503 from the isolated preview server, including its mock cloud API. Existing UI remained usable; cancelled receipt #1 locally and verified stock returned to 10. After the server resumed, queued changes synchronized automatically without another replacement prompt.
5. Created receipt #2. History retained both #1 (void) and #2 (active). The void detail had no edit/void actions and displayed a clear void label. Verified the annual shop view reported cost 750 and profit 150 for the active sale.
6. Checked mobile widths 320/390 and desktop 1440. Fixed oversized conflict footer buttons, 36px recovery download targets, and the dark-mode receipt background. Final controls did not expand document width beyond the viewport.

Screenshots (before/fixed pairs) are under:

`C:/Users/USER/.codex/visualizations/2026/09/05/01a0706b-5ca9-74a1-8974-9dd8f1c04c57/farm-all-cards-20260907/reliability/`

- `02-conflict-390-fixed.png`
- `03-recovery-320.png`
- `04-receipt-history-320.png`
- `06-void-receipt-desktop-fixed.png`

## Limits

- Fresh offline navigation could not be conclusively verified in the in-app browser: navigating while the preview server returned 503 produced `net::ERR_BLOCKED_BY_CLIENT`. A reload left the old UI visible, which is insufficient evidence of a fresh offline boot. Service-worker behavior was separately tested with simulated requests/cache responses.
- No physical Android/iOS install, airplane-mode restart, real cross-device session, native file picker/image downscale, or production R2 upload was exercised. The two-device and embedded-photo tests are simulations, not substitutes for field testing.
- Recovery points live only in the current browser profile, are limited to five per account, and are not a remote disaster-recovery archive. Clearing site storage removes them. Embedded images are copied; existing remote image URLs still require that remote object to exist.
- Numeric receipt numbering is monotonic in the synchronized dataset, not a globally reserved sequence. Two disconnected devices can independently issue the same numeric number; receipt IDs remain separate and conflicts require review. Global offline numbering would require device-specific prefixes or server allocation.
- No push or deployment was performed in this turn. Prior uncommitted trial/interior work is preserved.
