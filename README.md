# The EPMO — المكتب التنفيذي لإدارة المشاريع


> **GIZE AI branding standard (17 Nov 2026):** Visible names use **ORGANIZATION + STRATEGIZE** (Integrated Organization and Strategy Management), **Powered by GIZE AI** (AI-Powered Intelligence and Decision Support). Preserve authorized THEEPMO branding. The existing `.gaiz` technical file extension and compatibility identifiers remain unchanged pending explicit versioned migration approval. See [GIZE AI brand standard](docs/GIZE_AI_BRAND_STANDARD.md). This is a naming decision, not evidence of deployed functionality.

A multi-tenant delivery-governance platform: portfolios, programmes and projects
governed by stage gates that the software actually enforces, sold as licensable
modules on one platform.

| | |
|---|---|
| Intended production application | https://app.theepmo.com |
| Intended staging application | https://staging.theepmo.com |
| Public marketing website (separate repo) | https://theepmo.com |

## Stack

| Layer  | Choice |
|--------|--------|
| Web    | Next.js 15 (App Router), React 19 |
| API    | NestJS 10, modular monolith |
| Data   | PostgreSQL 16 with row-level security, Redis |
| Shared | Zod contracts imported by *both* sides; Drizzle ORM |

One language end to end, one repository, one deployable unit per environment.
A modular monolith rather than services: the module boundaries are enforced in
code and at the API, which is what the licensing model needs, without paying the
operational cost of a distributed system for a product this size.

## Quick start

```bash
cp .env.example .env
pnpm install
NODE_ENV=development PHASE15_ACCEPT_DISPOSABLE_DB=YES_RESEED_DISPOSABLE_TEST_DATABASE \
  EPMO_ALLOW_LOCAL_SCHEMA_PUSH=YES_I_UNDERSTAND pnpm setup  # disposable local DB only
pnpm dev        # api :4000, web :3000
```

Then open http://localhost:3000 and sign in as `fatima@al-nakheel.test` /
`pmoalign-dev`.

`pnpm setup` **is for disposable local development databases only** and requires
explicit one-time destructive operation opt-ins for both schema push and demo seeding.
`pnpm db:seed` independently requires `NODE_ENV=development` (or `test`),
`PHASE15_ACCEPT_DISPOSABLE_DB=YES_RESEED_DISPOSABLE_TEST_DATABASE`,
matching app/admin PostgreSQL URLs on loopback, and a non-deployed environment.
Keep the opt-in in the command shell rather than in a committed configuration.
It is deliberately blocked against remote, staging, and production databases. It must never target staging or production. For upgrades,
use the checked SQL-ledger command `npm run db:migrate` with administrator
`PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` and `PGPORT` configured;
then apply RLS. The legacy Drizzle migrator is disabled to prevent mixing
migration journals. `pnpm setup` ends by running the tenant-isolation check. If it does not print
**"Tenant isolation holds."**, stop and fix that before writing any feature code.

```bash
pnpm verify     # typecheck + data integrity + RLS proof + tests — run before pushing
```

## What the platform enforces

Four rules are enforced by the database and the API, not by the interface. A
control that is merely hidden is not a control.

**1. Tenant isolation is a database policy.**
The app connects as `pmo_app`, which has neither superuser nor `BYPASSRLS`, so
the policies bind. Each request runs in a transaction that sets `app.tenant_id`;
`set_config(..., true)` makes it transaction-local, so it cannot leak across
pooled connections. Queries carry no `tenant_id` predicate — Postgres adds it.
`packages/db/sql/rls.sql` loops over every table that *has* a `tenant_id` column,
so a new table cannot be left unprotected by forgetting to list it.
Proof: `pnpm verify:rls`.

**2. A stage gate passes three tests or it does not pass.**
Criteria met *with evidence*, approvals signed by the assigned approver, and no
open register item pointed at the gate. The rules are re-evaluated inside the
same transaction that advances the gate, so calling the endpoint directly gets a
409 listing every reason — the disabled button is a courtesy, not the mechanism.

**3. Module licensing is checked on the route.**
`@RequiresModule('finance360')` plus a guard reading the workspace's
entitlements. A workspace on a PMO-only plan is refused at `/api/v1/financials`
even when the URL is typed directly.

**4. The audit ledger is append-only.**
`AuditService.record()` takes the transaction as an argument precisely so the
ledger cannot drift from the data, and the app role is denied `UPDATE` and
`DELETE` on `audit_events`.

Layout uses CSS logical properties (`margin-inline`, `border-inline-end`) so that
Arabic and right-to-left are a `dir` attribute rather than a rewrite.

## Layout

```
apps/web            Next.js — 23 screens, Arabic/RTL, plain-form writes
apps/api            NestJS — capability checks, module guard, governance rules
packages/contracts  Zod schemas + inferred types — the shared source of truth
packages/db         Drizzle schema, RLS policies, migrations, seed, checks
infra/              deploy, database bootstrap, catalogue sync
```

`packages/*` compile to CommonJS in `dist/`, because the Nest build consumes them
as compiled JS. **After editing a contract or the schema, run
`pnpm build:packages`** (or `pnpm dev`, which does it first).

Writes are plain form POSTs to route handlers, not Server Actions: a route
handler has a stable URL, so an open tab keeps working across a redeploy and the
page still functions with JavaScript disabled.

## Environments and deployment boundaries

The authenticated application lives in `2029TEBE/TEBE`. The separate, static marketing website lives in `2029TEFE/TEFE` and is intended for `theepmo.com` / `www.theepmo.com`. Both repositories retain personal-account ownership; TEORG coordinates access without transferring either repository.

| | Production target | Staging target |
|---|---|---|
| Web URL | `https://app.theepmo.com` | `https://staging.theepmo.com` |
| Public API URL (must verify routing) | `https://api.theepmo.com` | `https://api-staging.theepmo.com` |
| Default on-host directory | `/opt/the-epmo` | `/opt/the-epmo-staging` |
| Compose project | `pmo-prod` | `pmo-staging` |
| Server-managed secrets | `.env.prod` | `.env.staging` |
| Web bind | `127.0.0.1` behind trusted TLS proxy | `127.0.0.1` behind trusted TLS proxy |

These are **configuration targets, not a claim that live DNS, Cloudflare, host, certificates, routes, or services are running**. Do not change DNS, app deployment, production secrets, customer data, Stripe settings, mail delivery or database as part of a documentation-only update. The deployment script requires an explicit trusted SSH host, verified environment and safety preflight, and has no default host. Secrets and app database volumes must remain isolated between production and staging.

Deploy commands (only after environment review and authorization):

```bash
EPMO_DEPLOY_HOST=deploy@<verified-host> infra/deploy.sh staging
EPMO_DEPLOY_HOST=deploy@<verified-host> infra/deploy.sh prod
```

For approved schema upgrades, use the checked migration ledger and mandatory backup procedures, not destructive development seeding. Microsoft redirects and external billing webhooks must be registered against actual, verified public endpoints before enabling integrations.

## Secrets

Nothing secret is in this repository, and nothing secret is copied to or from the
server by the deploy scripts. `.env.prod` and `.env.dev` are generated on the box
with `chmod 600`. `.env.example` and `.env.prod.example` document the shape.

## Accounts

The seed creates two demo workspaces, which is what makes the tenant boundary
demonstrable rather than merely claimed:

| Account | Role |
|---|---|
| `fatima@al-nakheel.test` | owner, Al-Nakheel Development |
| `khalid@nexa.test` | owner, Nexa Holdings |
| `pm@pmoalign.test` | `staff_consultant` in **both** — the managed-PMO engagement model |

All three use `pmoalign-dev`. The owner account is separate: it keeps its own
password, a reseed does not reset it, and that password is not in this repository.
