# Database code maintenance: identity, onboarding and security — review only

This batch reorganizes **source only** in `faisalwrokksa-hub/THEEPMOTEST`; it does not connect to any live database, change SQL migration history, publish images, change Cloudflare, or send mail.

## Source layout

- `packages/db/src/schema.ts` stays the public export path for existing imports and Drizzle configuration.
- `packages/db/src/schema/identity.ts` owns the preexisting `tenants`, `users`, `memberships`, and role enum definitions, moved without schema alteration.
- `packages/db/src/schema/onboarding.ts` declares the **already existing** `tenant_profiles` and `tenant_invitations` tables created by migration `0016`, preserving the foreign keys, partial uniqueness, token hash checks, invitation consumption semantics and tenant-scoped meaning. No new SQL migration is created or applied.
- `packages/db/src/seed/dev-env.ts` contains the existing disposable-local development env writer. The destructive seed still executes `assertDisposableSeedSafety` before connecting.
- `scripts/verify-db-structure.mjs` and its tests check source inventory against historical SQL CREATE TABLE statements, tenant RLS guards, transaction-local context and seed safety.
- Historical migration journal, SQL contents, checksums and Drizzle snapshots remain unchanged.

## Known security risks requiring a separate staged change

1. The `packages/db/sql/rls.sql` script grants broad table and default privileges before revoking specific rights. This is flagged in the source audit; replace it with reviewed least-privilege grants only after inventorying *all* application queries against a disposable real PostgreSQL instance. Future tables must not inherit write access unintentionally.
2. `pmo_app` currently has global `SELECT` on `users`, which also exposes password hashes to the application role. Authentication and invitation flows currently depend on the ability to find existing users. Introduce a narrowly authorized lookup or carefully constrained security-definer operation, with tests, before removing any existing grant.
3. The Drizzle snapshots do not constitute a reliable source-of-truth for migration `0016` and later SQL-ledger tables. **Do not use `drizzle-kit push` or generate an automatic production migration from these source changes.** The checked SQL-ledger remains authoritative. A separate migration-snapshot reconciliation should be reviewed prior to future schema generation.
4. Invite delivery is not proven, and registration must remain invitation-only and fail-closed until SMTP and IMAP delivery are independently verified.
5. Legacy Stripe financial history is retained as-is. Paddle conversion must occur in its separate review branches and must not rewrite paid/settled historic transactions.

## Checks and acceptance

```bash
node scripts/verify-db-structure.mjs
node --test scripts/db-structure-security.test.mjs
node scripts/verify-migration-chain.mjs
pnpm build:packages
```

The source audit is **not a substitute** for PostgreSQL role inspection, two-tenant negative access tests, verified database restoration, or a deployment signoff. Run those against disposable staging with the restricted role before rolling out any privilege changes.

This PR is review-only. Do not merge it or deploy to the VPS until the isolated checks pass and the team reviews the Drizzle compatibility impact. No Servitro support contact is authorized.
