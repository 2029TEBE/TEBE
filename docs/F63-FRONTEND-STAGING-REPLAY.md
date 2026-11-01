# F63 — external HTTPS customer-journey replay (operator handoff, NOT acceptance)

**Status:** prepared and source-tested only. No staging host was contacted by this change. Q76 review-only source integration SHA `2c376419e80c4f4430c95666bb3111d27d6a1ddf` is the initial build ancestor, **not** an immutable deployed-release selection. Always replace it with the newest independently green canonical Q head and independently attest that the staging deployment serves that same SHA. `docs/commercial-release-evidence.json` remains `decision:NO-GO`, `candidateSha:null` until independently accepted gates are evidenced.

## Exact operator prerequisites

1. EPMO4/staging owner independently authorizes and provisions the **isolated synthetic-only** HTTPS origins `https://staging.theepmo.com` and `https://api-staging.theepmo.com` with valid public TLS, nonproduction storage, and a verifiable image/deployment manifest identifying the **exact current canonical SHA**. Do not use production, real customer tenants, or DNS/deploy without separate approval.
2. EPMO1/onboarding owner provisions an admin **`.test`** account with access to **two disposable workspaces**, and a distinct restricted **`.test`** member account; passwords are delivered through an approved secret manager, not chat, logs, command arguments, GitHub Actions, or committed files.
3. Operator runs from an approved machine with Node 22, the exact SHA checkout, frozen `pnpm install`, and `pnpm exec playwright install chromium`. Set the environment variables below via an approved secret manager **without printing them or adding them to shell history**.
4. Independent reviewer separately captures redacted deployed SHA attestation, positive disposable invitation/email receipt, password recovery/reset email receipt, and actual expired-session receipt. The script intentionally does **not** send invitations, send recovery email, accept bearer tokens, change passwords, invoke provider consent, or initiate checkout. These four obligations remain **BLOCKED** and must not be called PASS from the script.

## Single replay command

Set `EPMO_STAGING_REPLAY_CONFIRM=YES_AUTHORIZED_SYNTHETIC_HTTPS_STAGING`, `EPMO_STAGING_WEB_ORIGIN=https://staging.theepmo.com`, `EPMO_STAGING_API_ORIGIN=https://api-staging.theepmo.com`, `EPMO_STAGING_EXACT_SHA=<40-character-current-canonical-head>`, `EPMO_STAGING_ADMIN_USER`, `EPMO_STAGING_ADMIN_PASSWORD`, `EPMO_STAGING_RESTRICTED_USER`, and `EPMO_STAGING_RESTRICTED_PASSWORD` in the operator's **existing secured environment**. Both users must end in `.test` and be distinct. Then run:

```sh
node scripts/frontend-staging-replay.mjs
```

No credentials are echoed. Optional `EPMO_STAGING_UAT_OUT` must remain under the OS temporary directory; default `/tmp/epmo-staging-frontend-replay`.

## Actual behavior and result classification

The script refuses execution without the exact confirmation, two exact HTTPS origins, SHA, TLS verification and disposable identities. It checks **real** HTTPS `/login` and API `/health` with certificate verification, runs Chromium in Arabic 375px RTL and English 1440px LTR, blocks all browser traffic outside the two approved origins, and does **not** intercept or mock any response. It checks login and secure HttpOnly cookie, administrator onboarding invitation control, keyboard focus/escape, loaded subscription/plans/invoices/exceptions, workspace A/B/A round trip, unauthorized workspace rejection, missing-session denial, restricted-role invitation/403/billing denial and logout/session revocation. Invalid login uses a deliberately nonexistent `.test` identity; negative POSTs use a nonexistent UUID. No billing mutations, live charges, invitations, or password changes occur.

Only a **public, unfilled login page** receives a masked screenshot. JSON report `staging-frontend-replay.json` records fixed scenario labels and PASS/FAIL/BLOCKED, not URLs, usernames, passwords, cookies, tokens, response bodies, authenticated screenshots or browser traces. No screenshots/traces of authenticated pages are produced. The report always records `accepted:false`, `deploymentShaIndependentlyVerified:false` and four explicit `BLOCKED_EXTERNAL_INPUT` obligations. Exit code **1** means a real check failed; **2** means checks may pass but external acceptance remains blocked. **Never promote the result to `frontend_customer_journeys` PASS or `staging_smoke` PASS without independent same-SHA review and the missing positive receipts.**

The original `scripts/frontend-customer-journey.mjs` remains strictly **localhost synthetic** and its 46/46 result is not equivalent to this staging replay. This F63 tool does not modify Stripe, Microsoft, billing backend, tenant policies, main, DNS or hosting.
