# Automatic VPS deployment

Main pushes run source checks and dependency audit before the full integration
job. Only a successful verified main push may reach the deployment steps.
Pull requests and workflow_dispatch never receive deployment credentials.
The verify/deploy job is serialized per ref and skips superseded main commits.

Activation requires repository variables `EPMO_DEPLOY_ENABLED=true`,
`EPMO_DEPLOY_HOST=user@verified-server`, and `EPMO_DEPLOY_KNOWN_HOSTS`
(the trusted host public-key line verified through the server console), plus
secret `EPMO_DEPLOY_SSH_KEY` for an authorized deployment identity. Do not use
ssh-keyscan output as the sole proof of server identity. Prefer a deployment
account scoped to the application and required Docker operations.

Existing infra/deploy.sh remains the deployment mechanism, including local
verification, remote destination checks, production configuration validation,
image builds, pre-migration backup, migration ledger validation and bounded
health checks. A failed gate fails the deployment job; it never becomes a
successful deployment receipt. No auth protections are relaxed.

Updates appear after CI, verification and deployment complete, not immediately
at git push. A failed release leaves an Actions failure requiring investigation.
Do not activate until a first supervised deployment and rollback rehearsal pass.

## Observed activation blockers, 2026-11-10

- VPS checkout /opt/the-epmo is 6471523278521b22ac63a41785ddd084e5d86a4f.
- GitHub main is d07f14b661024e1924dcc359413ba3b592d320de; CI run
  42826989554 passed.
- Candidate production preflight passed 21/25 checks. It rejected four Stripe
  requirements: adapter enabled, live key, signing secret and webhook URL.
  Current production deliberately has STRIPE_ENABLED=false; Paddle is intended.
  The updated preflight supports explicit BILLING_MODE=disabled, with Stripe
  and reference payments explicitly false, no payment credentials, and no
  test-mode exception. This is an application release, not live billing
  activation. Paddle remains a separate implementation/activation requirement.
- The production checkout has a one-line bootstrap SQL correction and untracked
  configuration backups. Preserve these before any rsync --delete deployment.
- Existing backups were visible, but a current isolated restore rehearsal has
  not been verified in this session.
- Deployment SSH credentials and host pin have not been provisioned/verified.

Rollback: retain the current application images, exact source revision and a
verified backup outside /opt/the-epmo. Application rollback is only safe if the
new migrations remain compatible. Do not automate destructive database restore.
Disable future deployments by setting EPMO_DEPLOY_ENABLED=false.
