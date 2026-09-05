## Task and owner

- Owner:
- Branch:
- Target: `develop` / `master` (production approval required)
- Scope:

## Changes

- Files changed:
- User-visible behavior:
- Out of scope:

## Validation

- [ ] `npm run check` passed
- [ ] `git diff --check` passed
- [ ] Staged diff contains only this task
- [ ] UI screenshot/readback attached when applicable

Evidence:

## Safety and data boundaries

- [ ] No token, password, `.env`, private URL, coordinates, private IP, Serial/MAC, or personal data committed
- [ ] `DATA_ONLY` and `SAFE_OFF` preserved, or separate approval is linked
- [ ] Pi 5 remains sole output writer
- [ ] No pump, valve, relay, Modbus, production database, or external-system write added without approval

## Deployment

- [ ] This PR targets `develop` and does not deploy Production
- [ ] If targeting `master`, `APPROVE_PRODUCTION_DEPLOY` is recorded

## Handoff

- Commit:
- Blocked / risks:
- Next action:
