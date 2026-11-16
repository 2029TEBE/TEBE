# GAIZ Shield authorized service boundary — Draft v1

**Status:** interface proposal only. No live endpoint, feature entitlement, cross-app identity or report engine is wired. Do not advertise report execution or customer verification as available.

## Repository ownership
- **TO:** GAIZ2 wire format, cryptographic test vectors, offline signing/encryption tooling.
- **TEBE:** only authoritative tenant authentication, membership/roles, policy decisions, import validation, audit and database writes.
- **TEFE:** public catalogue and local test-only inspection; no private keys, customer tenant data, direct database queries or unapproved remote service calls.
- **Standalone ORGAIZ reports:** may be delivered through an independently approved commercial service; must not force an EPMO subscription. EPMO import is optional and subject to separate entitlements and human approval.

## Candidate versioned service schema (not deployed)
All operations MUST be authenticated HTTPS with enforced session/audience, CSRF/origin and rate-limiting safeguards. Proposed routes require explicit security and architecture review before implementation; never infer availability from this document.

| Proposed operation | Candidate route | Protection |
|---|---|---|
| Discover permitted tools | `GET /api/v1/gaiz/tools` | Authenticated catalogue filtered server-side |
| Start bounded report job | `POST /api/v1/gaiz/jobs` | Verified inputs, authenticated user, quota/entitlement, tenant or standalone customer context; idempotency key |
| Check own job state | `GET /api/v1/gaiz/jobs/:jobId` | Owner/session, tenant and rate limit; no arbitrary lookup |
| Download approved output | `GET /api/v1/gaiz/jobs/:jobId/artifacts/:artifactId` | Fresh per-request authorization, content disposition, no permanent public URL |
| Preview EPMO import | `POST /api/v1/gaiz/imports/preview` | Valid signature, schema, tenant, membership; no writes |
| Approve EPMO draft import | `POST /api/v1/gaiz/imports/:id/approve` | Authorized human, audit and idempotency, existing RLS and transactional draft writes |

**None of these routes is currently added**. Never connect the public website to them until the backend contract is accepted and live staging tests pass.

## Normalized shapes
Request: `{toolId: string, format: 'pdf'|'html'|'gaiz', inputs: Record<string, unknown>}`. UTF-8 JSON body <=64 KiB, <=32 top-level input fields, schema-specific validation in addition to these generic limits.

Job: `{jobId: string, status: 'queued'|'processing'|'completed'|'failed'|'expired'|'canceled', outputs?: {artifactId: string, format:'pdf'|'html'|'gaiz'}[]}`. Output identifiers are pointers, not signed URLs. Do not treat job metadata as download authorization.

## Security requirements
1. TEBE's existing `TenantMiddleware` derives identity from an authenticated server session. An inbound tenant ID header, query parameter, report manifest or client-side certificate cannot establish authority.
2. GAIZ2 verification `verifyGaiz2ReadOnly` needs a **server-managed** Ed25519 issuer public key, expected issuer and expected tenant; never accept a caller-provided issuer trust key as a production authority.
3. A valid Ed25519 signature means only that the signed bytes match the independently trusted issuer key. It DOES NOT grant decrypt, import, report access, subscription or recovery rights.
4. Artifact authorization, recipient key release, purpose/entitlements, audit, rate limits, storage/quarantine, secure content rendering, expiry/revocation and replay defence require separate reviewed implementation.
5. No direct TEFE/TO access to TEBE database, no universal platform owner decryption and no customer data in static assets or test fixtures.
6. Keep `GAIZ_SERVICE_CONTRACT='orgaiz.gaiz.jobs.v1-draft'` out of production claims until approved; a schema alone is not an API.

## Local verification (works without GitHub Actions)
```sh
node --test apps/api/src/gaiz/gaiz2-fixed-fixture.test.mjs
node --test apps/api/src/gaiz/gaiz2-readonly-verifier.test.mjs
node --test apps/api/src/gaiz/gaiz-service-contract.test.mjs
```

TO fixture pin: SHA-256 `14e8a1f6ccc4dd0cf021dfd78a6d03f43f4124ea7854767b1052bcc6c01b5aef`, synthetic test issuer key only.

## Release gate
Human-approved TO spec and issuer trust policy; independent fixture verification; guarded live services with real authorization, schema and replay tests; security and privacy review; visual, mobile and RTL checks; approved rollback. No merge or deployment is authorized by this draft.
