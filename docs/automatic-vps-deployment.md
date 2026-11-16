# Backend deployment readiness

The existing CI-gated deployment implementation is tracked in PR #484:
https://github.com/2029TEBE/TEBE/pull/484

This change fixes the billing-disabled preflight and bootstrap SQL only.
It does not install a second deployment pipeline or activate billing.
Follow the reviewed deployment workflow's actual environment, secret names,
SSH host verification and rollback requirements before enabling it.

Updates appear after successful CI and deployment, not immediately at git push.
Never deploy a pull-request revision directly to production.

## Observed activation blockers, 2026-11-10

- VPS checkout /opt/the-epmo is 6471523278521b22ac63a41785ddd084e5d86a4f.
- GitHub main is d07f14b661024e1924dcc359413ba3b592d320de; CI run
  42826989554 passed.
- Candidate production preflight passed 21/25 checks. It rejected four Stripe
  requirements: adapter enabled, live key, signing secret and webhook URL.
  At that checkpoint production deliberately had STRIPE_ENABLED=false.
  The updated preflight supports explicit BILLING_MODE=disabled, with Stripe
  and reference payments explicitly false, no payment credentials, and no
  test-mode exception. This is an application release, not live billing
  activation. Stripe is the supported payment provider; activation requires
  verified credentials, signed webhooks and staging payment acceptance.
- The production checkout has a one-line bootstrap SQL correction and untracked
  configuration backups. Preserve these before any rsync --delete deployment.
- Existing backups were visible, but a current isolated restore rehearsal has
  not been verified in this session.
- Deployment SSH credentials and host pin have not been provisioned/verified.

Rollback: retain the current application images, exact source revision and a
verified backup outside /opt/the-epmo. Application rollback is only safe if the
new migrations remain compatible. Do not automate destructive database restore.
Disable future deployments by setting EPMO_DEPLOY_ENABLED=false.
