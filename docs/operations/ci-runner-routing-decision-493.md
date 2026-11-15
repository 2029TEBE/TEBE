# CI runner routing decision (PR #493 split — Patch C)

Status: **BLOCKED — infrastructure and runner availability not verified**.

Current main remains authoritative for runner selectors. The required jobs remain distinct:
- `Dependency-free source checks` (`source-guards`): production runner `servitro-tebe` only on trusted main pushes; PR jobs on `ubuntu-latest`.
- `audit`: production runner `servitro-tebe` only on trusted main pushes; PR jobs on `ubuntu-latest`.
- `verify`: `ubuntu-latest` for full disposable PostgreSQL/Redis, API and web builds, integration tests, evidence uploads.

## Decision required before changing routing

Option 1: Keep the above selectors until GitHub-hosted allowance is usable again, with the Actions spending cap held at $0.

Option 2: Provision a **separate** isolated Linux x64 Docker CI machine and register it with labels `self-hosted`, `linux`, `x64`, `servitro-tebe-ci`. Confirm it is online, available to this repository, and adequate for disposable PostgreSQL/Redis, builds, tests, and evidence. Only then propose a follow-up routing commit and demonstrate full `verify` execution. Never add `servitro-tebe-ci` to the production runner or permit untrusted PR code on the production host.

Never expose production SSH keys, deployment credentials, customer data, production volumes, host Docker socket, or production network reachability to the CI runner. Separate accounts and network controls are required.

## Required validation and merge gate

Keep `audit`, `Dependency-free source checks`, and `verify` distinct, with existing branch protection and check names. Validate workflow safety, migration-chain integrity, deployment script bash syntax, disposable CI services, full verification, and sanitized evidence artifacts against the exact proposed SHA. No spending cap increase, CI bypass, relabeling of production, or production deployment is authorized by this documentation.

PR #493 remains the original reference until A, B, and this routing decision are completely accounted for.
