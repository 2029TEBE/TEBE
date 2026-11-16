# GAIZ — pinned offline validation without GitHub Actions

**Review-only:** This is a repeatable procedure, **not evidence that Servitro has run the checks**. The script is intended for a dedicated non-root account with a read-only GitHub SSH deploy key and Node 22. Do **not** run it in the production checkout or grant Docker socket, database or production secrets to the test account.

## Target
Repository: `2029TEBE/TEBE`. Source branch: `feat/gaiz-auth0-provider-candidate-20261116`. Audited head commit at preparation: `662b53bc10f398024d463e13ed4a5faf87dd77e3`.

The script obtains a fresh disposable checkout, verifies the requested **exact commit**, rejects dirty state or tracked environment files, drops environment variables during test processes, syntax-checks all GAIZ JavaScript modules, then executes 10 selected dependency-free Node test files.

## Operator commands (unprivileged account)
```bash
# In an isolated HOME of a non-root account with read-only GitHub SSH access:
git clone --quiet --branch ops/servitro-offline-release-checks \
  git@github.com:2029TEBE/TEBE.git "$HOME/gaiz-runner"
cd "$HOME/gaiz-runner"
bash scripts/gaiz-pinned-offline-runner.sh \
  662b53bc10f398024d463e13ed4a5faf87dd77e3
```

Result log is written to `$HOME/gaiz-validation-results/<SHA>-<UTC>.log`. The temporary checkout is removed at exit. A failed command exits nonzero and must not be interpreted as a successful validation. Future commits require their own reviewed SHA and test run. A private read-only deploy key is sufficient; do not use a write-capable personal access token.

## Evidence and limitations
Record the SHA, UTC time, Node version, full test output, exit status and failure stack traces in the draft PR. Test output is from actual GitHub checkout bytes only after the operator runs these commands, **not** from a reconstruction or GitHub Actions. Verify no production data, network, billing, DNS or customer records are modified.

This script **does not execute** TypeScript/Nest build, real auth service integration, server database migrations/RLS, customer payment/fulfilment, cross-tenant integration, or production deploy. Those remain separate acceptance gates.

No exception to independent security approval or branch protections is authorized.
