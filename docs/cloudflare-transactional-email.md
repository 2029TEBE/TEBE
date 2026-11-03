# Cloudflare transactional email deployment

This change adds an optional `MAIL_TRANSPORT=cloudflare` adapter shared by workspace invitations, password recovery and existing notifications. It does not add public self-service signup or change password-reset redemption rules.

## Prerequisites and cost gate

Cloudflare's active account for theepmo.com is `809a1bee2454c599b0622ad286455ffb`. Its Email Sending dashboard currently requires Workers Paid. Do not purchase or enable a paid plan without the owner's spending approval. Public Pages hosting can remain on the free plan. Email Routing alone cannot send account emails to arbitrary recipients.

1. Approve the Workers Paid subscription and review its current monthly minimum and email usage pricing in the dashboard.
2. Onboard a sending domain in Email Service and verify all generated DKIM/SPF records. Preserve existing inbound MX and mailbox service; inspect conflicts rather than replacing MX automatically. Keep exactly one SPF policy per hostname, merging authorized senders if required.
3. Create a restricted Email Sending token for this account only. Creation requires owner approval. Store it in the API host's secret environment, never Git, the frontend, browser storage, screenshots or logs.
4. Configure `MAIL_TRANSPORT=cloudflare`, `MAIL_FROM=security@theepmo.com`, `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_EMAIL_API_TOKEN` in the API environment. `WEB_ORIGIN` must be `https://app.theepmo.com`. The production compose mapping includes the two Cloudflare variables only for API.
5. Build and validate the reviewed candidate before replacing the running API. Preserve the previous image and configuration for rollback. Do not merge protected branches or run destructive migrations as part of this change.

## Acceptance

- The adapter uses a fixed Cloudflare HTTPS endpoint, rejects redirects, has a ten-second timeout and returns sanitized errors. There are no automatic POST retries.
- Queued/provider acceptance is not inbox delivery. Confirm a real owner-controlled inbox receives the mail, verify SPF/DKIM/DMARC results, and check that links target the app domain. Do not use fabricated recipients for provider tests.
- Request a real account reset from the app; complete password entry as the user. Confirm single-use token redemption, 30-minute expiry and old-session revocation. Never expose the bearer URL in reports.
- Test an invitation in an isolated test workspace with a confirmed recipient. Confirm role/tenant scoping, expired and replayed links, and revocation after failed provider delivery.
- Keep reset/invitation endpoints behind Cloudflare and retain server-side throttling, CSRF/origin checks, generic account lookup responses and token hashing. Cloudflare delivery supplements these controls; it does not replace them.

Local provider-mocked checks: `node --experimental-strip-types --test apps/api/src/notify/cloudflare-transport.test.mjs`. They send no email and do not prove live deliverability.
