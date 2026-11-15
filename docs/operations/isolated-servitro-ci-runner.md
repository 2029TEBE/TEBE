# Isolated Servitro CI runner

## Purpose

The CI workflow uses a dedicated self-hosted runner label set:

`self-hosted`, `linux`, `x64`, `servitro-tebe-ci`.

Register this runner only after it is isolated from the production application. Do not relabel the existing production runner.

## Security requirements

- Use a dedicated unprivileged Linux account and a separate runner installation directory.
- Prefer a disposable VM or isolated host. If using containers, do not expose the host Docker socket to pull-request jobs.
- Do not mount production application directories, production database volumes, SSH keys, Cloudflare credentials, Paddle credentials, or other production secrets.
- Do not place the runner on a network path that can reach customer data or production control planes.
- Use ephemeral runner instances where practical; otherwise restrict who can administer the runner and routinely patch/rebuild it.
- Keep GitHub runner registration tokens out of source control, logs, shell history and chat.
- Ensure enough disk, memory and CPU for PostgreSQL, Redis and Docker image builds. Serialize jobs if resources are limited.
- Restrict this runner group to this repository and allow pull-request workflows only after the isolation review.

## Registration

1. Create or provision the isolated CI VM/host.
2. In GitHub, open **Settings → Actions → Runners → New self-hosted runner** for this repository.
3. Select Linux x64 and follow GitHub's currently displayed download, checksum-verification and configuration commands.
4. During configuration, add the custom label `servitro-tebe-ci`. Keep the standard `self-hosted`, `linux` and `x64` labels.
5. Install and start the runner as a service under its dedicated unprivileged account.
6. Confirm GitHub shows the runner as **Idle** and online with all four labels.
7. Confirm the runner cannot read production files, secrets, database sockets or customer networks before enabling pull-request execution.

Never copy a runner registration token into this repository. Tokens are short-lived and must be generated in GitHub at registration time.

## Validation

After the runner is online:

1. Dispatch the CI workflow and verify all three jobs start on the isolated runner.
2. Confirm `audit`, `Dependency-free source checks`, and `verify` all execute and report their actual test results.
3. Confirm PostgreSQL and Redis are disposable services created for the job and are destroyed after it.
4. Confirm the workflow artifact and job summary are published.
5. Confirm a failed test remains a failed check; do not use `continue-on-error`, unconditional success, or skipped required checks as a substitute.

## Rollback

If the runner is unavailable, restore the previous runner selectors in `.github/workflows/ci.yml` and use a supported GitHub-hosted runner only after confirming account billing/usage permits it. Do not route untrusted PR jobs to the production runner as a fallback.
