# Data Collector Access

Apply the additive migration before publishing the Worker or frontend:

```powershell
cd worker
npx wrangler d1 execute farmultimate-db --remote --file=team.sql
```

Check the database name against `wrangler.toml` before executing. This migration
only creates team tables/indexes; it does not modify existing farm records.
Deploy the Worker next, then the Pages site including `collector.html`.
The normal Pages release allowlist includes the collector entry point.

## Permissions

- Owners invite an individual email and choose plots and activity types.
- Owners can inspect and edit existing scopes. Updates require the current grant
  revision; a conflicting edit must be reloaded instead of overwriting it.
- Send the generated invitation link directly. No invitation email is sent.
- The link expires after seven days, is single-use, and requires the invited
  account's email. Only its SHA-256 digest is stored on the server.
- Owners can regenerate a pending or expired invitation from Members and Permissions.
  Regeneration keeps the same grant/email/scopes, invalidates the old link and
  starts a new seven-day expiry. A revision guard prevents concurrent acceptance,
  revocation or another regeneration from being overwritten. Raw links cannot be
  recovered after closing the result; they are not stored in browser storage.
- Collectors receive a field-allowlisted context, never the owner's full state,
  stock balances, financials, analytics, recipes, or other collectors' records.
  Spray/fertilizer permissions expose only product ID, name, unit and package size.
- Sampling units with legacy free-text plot names must match exactly one existing
  plot, or have an explicit plotId. Unmatched/ambiguous units are not shared.
- Submissions remain separate until the owner approves. Spray/fertilizer records
  can include up to 20 unique stock products with positive quantities (4 decimals).
  Owner approval of successful material-using work requires confirmMaterials=true,
  consumes inventory and records current stock cost with the same data.js rules
  as the main app. Pending/returned/failed work never consumes stock. Records
  without materials remain zero-cost. Explicit external materials contain only
  source=external, name, quantity and unit. They never create inventory items,
  deduct stock or infer a cost. Mixed submissions consume/price only stock rows;
  both sources remain visible to the owner in the approved activity.
  Insufficient available stock (including reservations), deleted products or
  changed units leave approval pending without changing owner state.
  Worker imports data.js through its CommonJS export; browser storage initialization
  is skipped for that server-side path. No separate stock arithmetic is maintained.
- Returns and resubmissions have revisions and an audit trail. Revocation is
  checked again inside submission writes and approvals.
- Approval uses the owner state revision and a D1 transaction to avoid replacing
  concurrent edits. Existing trial values are never overwritten.

## Offline and Limits

Collector drafts/queues use account-scoped local storage, not owner storage.
Offline operation requires a previous online login and context download.
Access is rechecked on upload. Revoking access cannot remotely erase cached
context on an offline device. Logout removes that account's cached collector data.

Changing the plot, cycle, type, trial, unit or metric asks before resetting results.
One previous draft is retained per assignment, with a restore action. Invalidated
scopes block the old draft rather than silently selecting a different plot.

Each queued record supports up to 100 inspection points and three compressed
photos. Photos remain inline in the local offline queue, then become private R2
references after upload. Device queue limit: 20. The existing owner JSON size limit still
applies; a rejected approval leaves the submission pending and existing data intact.
Owner and collector histories use pages of 100 records, members use pages of 200.
Counts are server-side totals rather than the current page length.

## Private Photos

Reapply the idempotent migration even if the earlier team schema was installed:
it now includes team_photos. The PHOTOS binding is required for photo submissions.
Objects use immutable team-private/ keys. Only the owner and the submitting member
can resolve a current submission's image through team_photo_get. Member access also
requires an active grant and the current plot/type scope. Public Worker /photo/
requests to this prefix are denied, including URL-encoded variants.

Before release, verify the R2 bucket has NO public r2.dev or custom-domain access.
If the existing bucket must stay public, use a separate private binding/bucket;
do not deploy private photos to a publicly exposed bucket.
See https://developers.cloudflare.com/r2/buckets/public-buckets/.

The owner JSON stores a small image-compatible reference, not the photo bytes.
Pending legacy inline photos migrate on approval. Already approved inline images
are left unchanged. Photo upload failure leaves submission/owner data unchanged.
An interrupted upload can leave an unlinked object: there is no automatic purge.
Any future cleanup must preserve references in current submissions, owner state
and audit history and use a retention grace period. Historical payloads remain in
the audit table, but the UI does not provide a historical-photo gallery.

## Verification

```powershell
node --test tests/*.test.cjs
node tools/preview-server.cjs 4193 --demo --team
```

The preview uses isolated in-memory SQLite, fake R2 and synthetic farm data. Its collector
account is `collector@example.invalid` / `Preview123!`; these credentials do not
exist in production. The owner preview auto-signs in. Server restart resets the
preview database. Production Google sign-in and the real remote migration must
be verified separately during release.
