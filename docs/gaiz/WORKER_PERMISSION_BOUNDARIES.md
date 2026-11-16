# GAIZ service identity and permission boundary — design review

**Status: proposal only. Not installed, not activated, not an approval.**
Reconcile with `packages/db/sql/rls.sql` and production role grants before any
disposable deployment. This document must never be executed as SQL.

## Roles and responsibilities

| Principal | Allowed | Explicitly forbidden |
|---|---|---|
| `pmo_app` (interactive API) | Authenticated tenant-scoped metadata reads; submit quarantine bytes through a scoped intake mechanism; request approval decision through approved transaction API | Read raw ciphertext; INSERT/UPDATE trusted artifact or mapping evidence; directly create import receipts; switch to verifier/executor identities |
| `gaiz_verify_worker` (future isolated service) | Read quarantined ciphertext under an authenticated tenant/work item claim; record only verified artifacts and immutable validated proposals | Approve customer imports, write business documents, issue execution receipts, access other tenants |
| `gaiz_execute_worker` (future isolated service) | Execute a single approved import as a tenant-bound, short-lived work item with atomic audit and draft document creation | Forge issuer signature / AEAD evidence; create human approvals; rewrap or release DEKs; change gates/projects to approved |

The two worker principals are **not currently implemented or deployed**.
They must have independently issued, short-lived credentials and be unable to
`SET ROLE` into each other. Never `GRANT gaiz_verify_worker TO pmo_app` or
`GRANT gaiz_execute_worker TO pmo_app`. Do not use elevated
`SECURITY DEFINER` handlers without a separate, reviewed threat model.

## Minimum controls before introducing workers

1. Every database transaction sets `app.tenant_id` from an **authenticated,
   server-controlled** claim, never from a document manifest, HTTP parameter,
   message queue body or client-supplied request.
2. RLS must be **FORCE**d for all seven GAIZ tables. Work roles must not be
   table owners, superusers or have `BYPASSRLS`.
3. The tenant's issuer allow-list and key revocation state must be selected by
   the verifier from backend-owned immutable policy, not from artifact fields.
4. Verified artifact rows and validated proposal rows are *append-only* to the
   verifier role; the interactive application role cannot INSERT or UPDATE them.
   Trusted timestamps must be server generated.
5. Only the executor may create `gaiz_import_receipts`. Receipt and business
   document insertion, job state change, audit entry and replay claim are
   **one transaction**. The executor needs narrowly scoped privilege over the
   existing `documents` and `audit_events` tables.
6. Human approval is a separate user action with authenticated approver identity,
   tenant membership and `pmoa_approve`, never an artifact flag. Store approval
   against the immutable mapping fingerprint and revision.
7. Verify the **exact** quarantine bytes via a stored SHA-256 and AES-GCM tag
   before persisting mapping data. One signature verification is insufficient.
8. Rotation, DEK wrapping/unwrapping, per-tenant quotas, retention and
   expired-work-item recovery all require separately reviewed design and tests.
9. Re-run the established RLS script after schema/roles installation in the
   disposable environment to identify broad GRANT regressions. Review role
   membership chains and column grants, not just direct table privileges.
10. Quarantine exception paths must not mark a job `verified` or `approved`.

## Explicit release gates

No automatic approval, merge or production deployment can proceed until all
of the following have machine-verifiable evidence plus human security signoff:

- TO producer conformance with genuine emitted fixtures (including negative
  cases), a frozen canonical signed payload schema and reviewed key wrapping.
- Two-tenant disposable PostgreSQL tests with concurrent same-key and
  different-key submissions, fail/rollback, replay and cross-tenant writes.
- A verifier role that **cannot execute** and an executor role that **cannot
  forge evidence**, with effective grants/role membership independently tested.
- End-to-end authenticated API and UI tests, logging/privacy review, quarantine
  retention cleanup, emergency revocation and rate limits.
- Successful full TypeScript/build/test/CI on the exact reviewed commit.

Routine checks can be scheduled or run automatically. A check passing does
not mean a human import approval, security approval or release was issued.
