# Transactional email activation

Production remains `MAIL_TRANSPORT=none` until a verified provider is available.
The Cloudflare adapter supports the VPS without relying on an AWS instance role.
Existing SES behavior remains available.

## Required before activation

1. Sign in to the Cloudflare account that owns the **active** theepmo.com zone.
   A second pending zone is not the production sending domain.
2. Check Email Sending availability, plan limits and any charges before activation.
3. Verify a dedicated sending subdomain, for example notifications.theepmo.com.
   Preserve existing inbound MX records. Complete the provider's SPF/DKIM checks.
4. Create a narrowly scoped Email Sending token for the production account.
   Store it only in the server-managed production environment, never Git or the web app.
5. Configure `MAIL_TRANSPORT=cloudflare`, `MAIL_FROM`, `MAIL_CF_ACCOUNT_ID` and
   `MAIL_CF_API_TOKEN`. Restart the API through the deployment process.
6. With authorization, send a real invitation and recovery request to a controlled
   inbox. Check provider delivery results, spam placement, Arabic text, link origin,
   invitation expiry and recovery-token reuse. Do not claim inbox delivery from an
   accepted/queued API response alone.

Offline tests use an injected mock HTTP client and never send email. The adapter
has a fixed HTTPS endpoint, rejects redirects and invalid configuration, bounds
request size/time, checks recipient acceptance, and redacts provider error bodies.
It does not automatically retry an ambiguous response, which may already have
accepted the message. Failed recovery sends retain the existing token-revocation
behavior. Operator review is still required for provider failures and throttling.

Rollback: set `MAIL_TRANSPORT=none` and redeploy. Recovery and invitation flows
must then report unavailable delivery rather than imply that mail was sent.

Reference: https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
