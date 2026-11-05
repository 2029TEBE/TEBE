# THE EPMO — Paddle Sandbox Account Setup (Step 1)

**Current confirmed status: account not verified.** No active Paddle browser session, Paddle connector, or accessible account confirmation was found during this review. Connected Gmail search yielded no relevant Paddle activation email. GitHub's passing CI is **synthetic** and does not prove Paddle account ownership.

Paddle's sandbox is separate from the live merchant account. **Sandbox use does not require live merchant approval**. Account signup and credential issuance require an authorized business operator; repository automation must not manufacture those credentials, submit private business details, or create a live account.

## Operator setup — dashboard only
1. Open Paddle's **sandbox** dashboard: https://sandbox-vendors.paddle.com/ . Create the distinct sandbox account if one does not exist, verify the account email, and ensure its business name is THE EPMO. Do not confuse this with live https://vendors.paddle.com/ .
2. Under **My account → Settings → Authentication**, generate a least-privilege **sandbox** API key. The initial read-only preflight requires `price.read` and `notification_setting.read`. Additional transaction permissions belong to a separately scoped staging credential when approved. Generate a `test_` client-side token for the future sandbox checkout.
3. Under **Catalog → Products**, create fictional sandbox-only product(s) with recurring monthly/annual price(s). Do **not** copy the draft marketing prices into a binding customer offer without commercial review.
4. Only after a dedicated HTTPS **staging** notification handler is deployed and verified, add a **sandbox** notification destination. Subscribe to `transaction.completed`, `adjustment.created`, and `adjustment.updated`. Store the generated destination secret in a managed secret store and match it to the staging handler. Do **not** point Paddle at `app.theepmo.com` or the production domain.
5. Keep `BILLING_PROVIDER=paddle`, `PADDLE_ENV=sandbox`, and `PADDLE_ENABLED=false`. The current webhook writer still rejects staging/production writes by design; publishing a sandbox destination alone does not activate payment handling.

## Read-only account readiness verifier
Run only in a trusted shell or a secret-managed environment. **Never paste values into chat, a GitHub commit, a log, or a terminal transcript shared publicly.** Configure the following variables as secrets (their values are never printed by the verifier):

```text
PADDLE_SANDBOX_PREFLIGHT=READ_ONLY
BILLING_PROVIDER=paddle
PADDLE_ENV=sandbox
PADDLE_ENABLED=false
PADDLE_SANDBOX_API_KEY=<secret sandbox API key>
PADDLE_SANDBOX_ACCOUNT_ID=<expected slr_ account identifier>
PADDLE_SANDBOX_CLIENT_TOKEN=<test_ client token>
PADDLE_SANDBOX_PRICE_IDS=<comma-separated pri_ sandbox recurring price IDs>
PADDLE_SANDBOX_WEBHOOK_URL=<verified HTTPS staging notification URL>
PADDLE_SANDBOX_WEBHOOK_SECRET=<secret destination signing key>
```

Execute `node scripts/paddle-sandbox-account-preflight.mjs`. It uses only read-only HTTPS GET calls to `https://sandbox-api.paddle.com/`, `/prices`, and `/notification-settings`. It never prints a credential, a secret, account details, or raw API responses. Output is boolean readiness evidence; it does not create resources, run transactions, or deploy changes. Without a connected account, it reports `NOT_VERIFIED` and exits nonzero.

A verified sandbox account can precede full catalog and notification setup; only `sandboxSetupComplete: true` means all the verifier's **account-and-configuration** checks passed. It does **not** mean payments, hosted checkout, notification delivery, staging writes, invoice state changes, or entitlements have been tested.

## Follow-on acceptance (separate release gate)
- Verify genuine Paddle sandbox response and notification delivery to a non-production HTTPS service.
- Keep signed-event handling fail-closed until a staging-specific durable writer is independently reviewed and approved.
- Prove replay, webhook ordering, refund and dispute reconciliation, and no cross-tenant activation with genuine provider IDs and disposable PostgreSQL.
- Require full green CI, backup/restore, legal/commercial terms, and explicit release approval before live payment activation.

Sources: https://developer.paddle.com/sdks/sandbox/ and https://developer.paddle.com/api-reference/api-root/get-api-root/ .
