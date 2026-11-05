# Email-verified THE EPMO signup -> optional Evaluation

**Review-only.** Backend draft PR #440 is stacked on the already-tested free Evaluation PR #439. These branches are **not deployed**.

## Scope and trust boundaries
1. `GET /signup` presents bilingual English/Arabic name, email and workspace-name inputs only in a named staging deployment with `SIGNUP_ENABLED=true`.
2. `POST /api/signup/request` checks browser origin before forwarding to `POST /auth/signup/request` under tight throttling. The API requires a real delivering email provider (`MAIL_TRANSPORT=ses` plus verified `MAIL_FROM`), a trusted HTTPS `WEB_ORIGIN`, and checks a per-email cooldown inside PostgreSQL. **It never returns whether an email account already exists.**
3. Each request creates a cryptographically random 256-bit token; only its SHA-256 hash is retained in the database. The email link has the secret in `#token=`, never in an HTTP pathname or query. It expires after 30 minutes, can be consumed once and is revoked if delivery fails.
4. Confirmation asks the recipient for a new password (12+ chars). A PostgreSQL `SECURITY DEFINER` function validates the single-use token under a row lock, inserts a normal global user with `is_platform_admin=false` by default, creates a random-slug empty tenant, and assigns this user as owner, all in one transaction. The application DB role cannot directly create global tenants or read signup token hashes.
5. Email verification does **not** log the person in automatically, accept a credit card, start a trial or create a Paddle subscription. After signing in, the owner explicitly activates the existing `evaluation_7day` plan through the separately reviewed Evaluation endpoint. The full 168-hour clock begins **only then**.
6. No invitation sending, tenant membership, payment-provider connection, live charges, or customer records are altered during source review.

## Activation gates
- `SIGNUP_ENABLED=false` in development, staging and production templates. API refuses startup with registration enabled outside expressly named staging or disposable GitHub CI.
- A publicly accessible signup requires a working, verified SES sender and HTTPS staging site. The SMTP ports on a separate VPS do not substitute for verified transactional SES delivery.
- Confirm rate limits, CAPTCHAs/WAF thresholds, abuse reporting, email deliverability, domain policies, security/privacy disclosures and personally identifiable information retention before any production release.
- Use isolated database credentials (application role `pmo_app` only), exact migration checksums, vendor review, and the staging RLS audit.
- Review the pending `signup_requests` table's data-retention policy; schedule database-administrator cleanup of requests after expiry and any applicable legal hold.
- Run automated token replay, expired token, concurrent verification, duplicate email and cross-tenant tests on a disposable database and fake account data only.

## Release restrictions
No merges, production deployments, DNS changes, live Paddle charges or real customer email sending were performed here. The marketing signup call-to-action remains disabled pending end-to-end staging acceptance.
