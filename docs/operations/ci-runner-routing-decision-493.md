# CI runner routing decision (PR #493 split — Patch C)

Status: **routing proposed in this draft; isolated runner registration and availability not verified**.

Patch C proposes the following selectors; this draft must not merge until runner isolation and required checks are verified. The required jobs remain distinct:
- `Dependency-free source checks` (`source-guards`): production runner `servitro-tebe` only on trusted main pushes; PR/manual jobs on dedicated `servitro-tebe-ci`.
- `audit`: production runner `servitro-tebe` only on trusted main pushes; PR/manual jobs on dedicated `servitro-tebe-ci`.
- `verify`: dedicated `servitro-tebe-ci` for full disposable PostgreSQL/Redis, API and web builds, integration tests, evidence uploads.

## Provisioning decision and validation still required

Provision a **separate** isolated Linux x64 Docker CI machine and register it with labels `self-hosted`, `linux`, `x64`, `servitro-tebe-ci`. Confirm it is online, available to this repository, and adequate for disposable PostgreSQL/Redis, builds, tests, and evidence. Only after it is verified online and isolated may this PR's routing change be merged; demonstrate full `verify` execution on the exact commit. Never add `servitro-tebe-ci` to the production runner or permit untrusted PR code on the production host.

The production deployment workflow still uses `ubuntu-latest` and requires its own successful scheduling, enable flag, and full release gates; this patch does not modify deployment routing.

Never expose production SSH keys, deployment credentials, customer data, production volumes, host Docker socket, or production network reachability to the CI runner. Separate accounts and network controls are required.

## Required validation and merge gate

Keep `audit`, `Dependency-free source checks`, and `verify` distinct, with existing branch protection and check names. Validate workflow safety, migration-chain integrity, deployment script bash syntax, disposable CI services, full verification, and sanitized evidence artifacts against the exact proposed SHA. No spending cap increase, CI bypass, relabeling of production, or production deployment is authorized by this documentation.

PR #493 remains the original reference until A, B, and this routing decision are completely accounted for.
