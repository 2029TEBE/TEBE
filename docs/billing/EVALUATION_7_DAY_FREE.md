# THE EPMO Evaluation — 7-day free experience

**Release state: DRAFT.** This implementation is not merged or deployed.

## Approved offer
- Name: **THE EPMO Evaluation**
- Duration: **168 hours (seven full days)** from server-side activation
- Price: **SAR 0**
- Card, Paddle product, billing invoice, recurring charge: **none**
- Automatic renewal: **disabled**
- End of trial: access automatically expires without a cron job; upgrade remains voluntary and cannot initiate a charge from this flow
- Data: one fictional portfolio/program, two clearly labeled fictional projects and one sample risk, all in the activating tenant's PostgreSQL RLS boundary

## How it works
1. An existing tenant administrator with `pmoa_admin` capability must sign in to a **new, empty workspace**. There is no public self-service tenant creation in this batch.
2. With `EVALUATION_ACCESS_ENABLED=true` set **only in an approved staging/test deployment**, the billing page displays an opt-in free Evaluation button. A same-origin, CSRF-guarded POST forwards the signed-in cookie, not a caller-supplied tenant or price.
3. API takes the tenant advisory lock shared with platform grant provisioning, checks there has NEVER been a subscription or Evaluation, and that there are no projects/programs/portfolios or enabled paid modules.
4. API creates one trialing subscription and an immutable `tenant_evaluation_trials` row; both expire at exactly `now() + interval '168 hours'`. A tenant-primary-key constraint makes trial reuse impossible. Module grants (Core, PMO, Analytics, Risk) also expire.
5. API creates **only** fictional samples in the authenticated tenant, and records subscription/audit events in the same transaction. There are **no Paddle, Stripe or banking operations**.
6. After expiry, middleware denies access to *all* protected API data routes, including undecorated core routes, while allowing exact read-only subscription/recovery endpoints. A later separately approved paid plan may supersede the expired Evaluation.
7. The `GET /api/v1/subscription/current` view reports status `expired` immediately upon the expiry timestamp even if no background job runs; the bilingual billing page shows the end of trial and optional upgrade wording.

## Security and rollout
- **Default: disabled.** The production API refuses to boot if `DEPLOYMENT_ENV=production` and `EVALUATION_ACCESS_ENABLED=true` to prevent accidental rollout.
- All 27 SQL migrations and source checks must pass; applied migration hashes are immutable and historical finance data is not rewritten.
- The one-time grant table is FORCE RLS and app-role append-only. Database constraints prevent re-using an already granted tenant.
- The offer is accessible only within an already provisioned tenant, not a public signup or registration flow; public landing page remains indicative, with paid Paddle checkout disabled.
- Test both tenant isolation and the actual time cutoff with a disposable authenticated CI tenant. Verify no invoices/payments are created.
- Explicit staging authorization and a separate production release review are required before deployment, advertising, or enabling public signup.
