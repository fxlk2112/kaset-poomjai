# Lark Personal Wallet Preview

This is a loopback-only preview, not a production deployment. Existing PIN-only
The existing account owner records, income, photos and recovery settings remain unchanged.

## Identity and Access

- Entry: `http://127.0.0.1:4208/wallet-preview.html?mode=lark`.
- Login uses the same `LARK_APP_ID` as Base reads. Lark open IDs are app-scoped.
- The backend exchanges the authorization code and reads Lark user information.
- The tenant must match `LARK_WALLET_TENANT_KEY` configured by the operator.
- Expense queries and attachment ownership checks use the authenticated open ID.
  A submitted payer ID can only equal that ID. There is no department-wide role.
- Personal reads include this payer across departments, never all department payers.
- PIN, encryption key, recovery code, cached income, photos and receipt profile are
  partitioned by app, tenant and open ID, not name or email.
- The Lark session is an HttpOnly cookie. Provider tokens stay in server memory.
  Restarting the preview requires Lark login again. No refresh token is persisted.
- State is single-use, browser-bound and expires. Both login state and sessions are
  bounded. Provider identity is revalidated on protected requests.
- No endpoint writes to Lark. Receipts do not automatically sign documents.

## Operator Setup

Real Base IDs, owner identity and organization URL are not included in this repository.
Create the ignored `tools/.wallet-private/runtime.json` with `LARK_WALLET_BASE_APP`,
`LARK_WALLET_TABLE`, `LARK_WALLET_BASE_ORIGIN` (an HTTPS Lark organization origin),
`LARK_WALLET_TEAM`, `LARK_WALLET_OWNER_ID` and `LARK_WALLET_OWNER_NAME`.
Environment variables override that file. Missing or invalid configuration fails
closed, without making a Lark request. The legacy owner is required only by this
local server; personal wallets still use the identity verified by OAuth.

Optional `tools/.wallet-private/receipt-cells.json` holds company/profile text for
template cells B2, D3, D4, C29 and H29. It is returned only after PIN unlock.
The public template keeps those fields blank. Private files are never served as files.
Neither these files nor logs, screenshots, income or evidence belong in a release commit.

Use the existing Lark app that can read `FIN-EXPENSE (Phase 1)`. Do not create a
different OAuth app without planning an open-ID migration.

1. Enable browser/web login in the app and register the exact redirect URL:
   `http://127.0.0.1:4208/__wallet/oauth/callback`.
2. Enable `contact:user.base:readonly` for login. Keep the existing Base-read and
   evidence-download permissions; do not request write permissions for this feature.
3. Confirm the app's availability includes the intended users. Publish/approve
   configuration changes through the organization's normal Lark process.
4. Supply the allowed organization's tenant key through the server environment as
   `LARK_WALLET_TENANT_KEY`. Do not accept a tenant supplied by the browser or learn
   it from the first arbitrary login.
5. Set `LARK_WALLET_LOGIN_ENABLED=1`, retain the existing `LARK_APP_ID` and
   `LARK_APP_SECRET`, and restart only `tools/wallet-read-server.cjs 4208`.
6. The user completes Lark login/consent and their own PIN setup. Keep the recovery
   code privately. Never paste credentials or recovery codes into the task chat.

Missing configuration keeps login disabled. A configured flag is not proof the
Lark console settings or availability are correct. Verify with two real authorized
accounts before rollout, including logout, session expiry and cross-user denial.

### Configured Local Preview (2026-10-14)

The existing app's loopback redirect and `contact:user.base:readonly` user scope
have been configured. `tenant:tenant:readonly` was added to verify the app's own
organization through the official tenant API, not through an arbitrary login.
The verified tenant and opt-in flag are in the ignored local file
`tools/.wallet-private/lark-login.env`; app secrets and access tokens are not
stored there. Keep using the existing app credentials in the environment.

From the repository root, start the wallet preview with Node 24:

```powershell
node --env-file=tools/.wallet-private/lark-login.env tools/wallet-read-server.cjs 4208
```

Stop only the previous wallet preview process before restarting on the same port.
Do not stop the main farm preview or delete any private PIN files. The local env
file is not deployed or committed. Re-verify the tenant and payer identity mapping
before changing the Lark app. Real user login and account-isolation checks remain
required; configuration success is not proof of an end-to-end login.

### Real Account Check (2026-10-14)

- The existing account owner completed real Lark consent, PIN setup and recovery acknowledgement.
- The UI payer open ID matched the existing payer; real expenses and a sample
  evidence image loaded. Refresh preserved the same unique record count and total.
- The new personal wallet starts without legacy income or an opening balance.
  No old wallet data was imported, changed or deleted during this check.
- Initial callbacks returned the generic login error. After restarting the preview
  and obtaining a fresh authorization, login succeeded. The original failure cause
  was not captured and remains unconfirmed; do not describe it as a proven fix.
- Optional `LARK_WALLET_AUTH_DIAGNOSTICS=1` logs only fixed stage/reason labels and
  numeric codes to stderr. It never logs tokens, authorization codes or identities.
- Automated suite: 497 passing tests. A second real account, logout/expiry flows
  and cross-device financial persistence still require validation before rollout.

## Data and Rollout Limits

### Department Wallets

- After unlocking a personal Lark wallet, the user explicitly selects the department
  whose money is managed. Selection is remembered in the encrypted personal book.
- The selected department is a budgeting scope, not an access permission. Backend
  identity and attachment access still restrict every read to the authenticated payer.
- Exact `ทีม/แผนก` values from Lark classify expenses. Only this department's records
  deduct its balance. Other departments stay visible in a separate tab without debit;
  missing or ambiguous departments go to review and do not deduct automatically.
- Opening balances and income (including photo namespaces) are separate per department.
  Old unscoped funds remain untouched and can be inspected, but are not auto-assigned.
- Opening dates limit the expense groups displayed. Printing uses the active expense
  group. Source disappearance retains a known department's last debit with a warning;
  a source edit replaces classification on the next successful refresh.
- Switching department does not edit Lark, transfer money, or imply department-wide
  access. No selected department means no computed balance and no new income entry.

- Lark expenses can be read by the authenticated payer on each device. Locally
  entered income, opening balance and income photos are still browser-local,
  encrypted. They do not yet synchronize between devices.
- The personal Lark wallet does not auto-import the legacy single-owner wallet.
  Review and explicitly migrate balances before replacing the old workflow.
- Removing or reassigning a Lark record preserves its old debit with a review
  warning; disappearance is not treated as proof of a refund.
- Other devices cannot connect to this loopback server. Production needs HTTPS
  deployment, a registered production callback, durable per-user financial storage,
  managed secrets, backups and operational access revocation. Do not expose this
  development server using a public tunnel as a substitute.
- There is no automatic department-manager access. This requires a separate,
  explicit permission model and audit trail.

## References

- https://open.larksuite.com/document/server-docs/getting-started/authen-v1/build-login-free-system-
- https://github.com/larksuite/cli/blob/main/internal/auth/paths.go

## Checks

Run `node --test tests/*.test.cjs`. Authentication and cross-user tests use mocked
provider responses and temporary PIN files, not real financial records.
