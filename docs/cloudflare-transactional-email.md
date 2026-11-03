# Cloudflare transactional email pilot

Invitations, password recovery and notification outbox use the same optional `MAIL_TRANSPORT=cloudflare` adapter. Public Pages hosting remains free. No public signup or password-reset redemption policy changes are included.

## Free pilot configuration

Cloudflare permits free sending to verified Email Routing destination addresses, limited to 200 distinct destinations per account. The same verified mailbox can receive invitations, recovery and transactional notices; these actions do not each consume a destination slot. Cloudflare verification and the application's approval list are separate controls. Neither means the EPMO account has been activated.

Set API-only environment values:

- `MAIL_TRANSPORT=cloudflare`, `MAIL_FROM=security@theepmo.com`
- `CLOUDFLARE_ACCOUNT_ID=809a1bee2454c599b0622ad286455ffb`
- `CLOUDFLARE_EMAIL_API_TOKEN`: restricted Email Sending secret, never commit or expose to the browser
- `CLOUDFLARE_EMAIL_MODE=verified-only` (default)
- `CLOUDFLARE_PILOT_RECIPIENTS`: comma-separated, individually approved recipient addresses, at most 200 unique normalized addresses
- `WEB_ORIGIN=https://app.theepmo.com`

An empty or invalid pilot list disables sending. Non-approved recipients never reach the provider. Recovery keeps its generic response for unapproved recipients. Cloudflare must independently verify every destination. Do not mark a recipient verified merely because it appears in the environment list.

Sending to arbitrary recipients requires Workers Paid; `CLOUDFLARE_EMAIL_MODE=paid` removes the local pilot restriction only after a separately authorized upgrade. Do not enable a paid subscription without owner approval. Newsletters and offers require a separate opt-in marketing service, consent records and unsubscribe handling.

## Outstanding live setup

Email Routing is not activated on the active zone. Its current onboarding proposes replacing the apex MX records, which would affect the existing Servitro mailbox. Preserve inbound mail until the owner chooses and verifies a migration or forwarding arrangement. Do not click Activate or overwrite the existing SPF/MX records blindly. No sending token or recipient verification has been provisioned by this change.

After the mail-routing decision, verify the destination mailbox, authorize creation of a restricted sending credential, configure API secrets, build the reviewed candidate and preserve the previous image/configuration for rollback. Keep exactly one SPF policy per hostname, with the appropriate authorized senders.

## First-release behavior

Administrators see invitation states, expiry, revocation and a resend action. Resending waits five minutes, preserves the recorded role/email, revokes the prior link and issues a new single-use invitation. Provider acceptance is explicitly distinguished from activation and inbox delivery. Acceptance queues one bilingual welcome notification in the membership transaction; the existing notification worker sends it later.

The adapter uses a fixed Cloudflare HTTPS endpoint, rejects redirects, has a ten-second timeout and returns sanitized errors. It does not retry POST requests automatically. Cloudflare delivery supplements the application's throttling, CSRF/origin checks, token hashing and tenant permissions.

## Acceptance before declaring live

- Build and type-check API and web; run the provider-mocked and existing invitation/recovery tests.
- Confirm a real owner-controlled inbox receives a message and inspect SPF/DKIM/DMARC. Provider acceptance alone is insufficient.
- Have the owner request a real reset and enter their own new password. Confirm single use, 30-minute expiry and old-session revocation. Never publish the bearer URL.
- In an isolated workspace, verify invitation acceptance, resend invalidates the previous link, tenant/role scoping, expiry/replay rejection and welcome delivery.
- Check desktop and phone layouts and failed-provider handling. Do not send test mail to fabricated recipients.

Local provider-mocked checks: `node --experimental-strip-types --test apps/api/src/notify/*.test.mjs`. These send no email and do not prove live deliverability.
