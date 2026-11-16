# GAIZ Commercial Fulfilment — independent standalone customer service (draft)

**Status: SOURCE-CODE FOUNDATION ONLY; NOT a live service.** No route is registered, no payment provider is connected, no customer data exists in this branch, and the SQL is a reviewed-only proposal under `docs/gaiz/`.

## Scope implemented
- `gaiz-commercial-policy.mjs` provides fail-closed customer ownership checks, idempotent state transitions requiring current revision, provider-paid confirmation, server-side report entitlement evidence, and expiring, nonrevoked artifact authorization. It cannot infer authorization from an OIDC token, a GAIZ signature or a checkout return URL.
- `gaiz-fulfillment-service.mjs` is **disabled by default**. It requires injected authenticated ORGAIZ session store, atomic order store, verified provider event adapter, execution verifier, audited artifact store and audit implementation. It derives job ownership from the server, not the request body.
- `gaiz-commercial-policy.test.mjs` adds synthetic positive/negative boundary tests. These are **not yet executed** because TEBE CI scheduling remains blocked and no authenticated non-production runner was available.
- `PROPOSED_ORGAIZ_COMMERCE_SCHEMA.sql` contains draft separate customer, order, event, job and artifact records, unique provider event/transaction identifiers, owner indexes, FORCE RLS, and **no permissive RLS policies**. The entire file is wrapped in `ROLLBACK`, is not an executable migration and has not been run.

## Business service boundaries

Standalone ORGAIZ:
1. A successful separate OIDC authorization-code/PKCE flow creates a server-side session and a stable account uniquely keyed by `issuer + subject`. No EPMO subscription is needed.
2. The customer selects an approved tool and a server-priced product. The server writes a customer-owned order in `awaiting_payment` and initiates a genuine provider checkout session. Never accept caller-submitted prices or payment status.
3. Only a provider-verified signed webhook, replay checked against a durable unique event ledger, can transition the order to `paid`. Verify exact environment, amount, currency, provider transaction ID and canonical order owner. Execute state transition and audit **in one DB transaction** with CAS revision.
4. The server checks product quota, tool restrictions, customer identity and payment rights before queueing a bounded job. Secure worker claims jobs with DB locking; execution is idempotent and audited.
5. Only a completed job and owner-authorized artifact can be downloaded. Every GET must independently revalidate the logged-in ORGAIZ customer, order state (including refunds), job ownership, object metadata, expiry, revocation and current entitlement. Use authenticated, streamed downloads, safe MIME and content disposition, and CSP-sandboxed HTML views.
6. A signed and encrypted `.gaiz` artifact additionally requires a trusted issuer and controlled recipient key custody. **Payment never grants a tenant import, decryption key or EPMO membership.**
7. Enterprise import remains a wholly separate workflow requiring EPMO membership and human sign-off (TEBE #507).

## IMPORTANT: reviewer-only interfaces
The pure functions accept data structures. A `verifiedByServer` boolean in a test object is not an unforgeable credential; production MUST construct these objects from trusted authenticated services, never from external JSON. The injected `orders.commitTransition` adapter MUST implement durable atomic transaction and revalidation; similarly `artifactStore.readAuthorized` MUST recheck revocation and enforce storage object binding immediately before returning bytes.

## Still unimplemented
- Real provider account/configuration and secret provisioning
- OIDC token exchange, durable state store, actual customer session endpoints and customer persistence
- Actual payment checkout provider, signed webhook verification, payment ledger and settlement/refund lifecycle
- Actual report generator, background processing, concurrency/quota enforcement and object storage
- Real RLS migrations, roles and policies; secure artifact serving and revocation
- Cross-repo GAIZ2 acceptance, key custody, security review and staging E2E tests

## Release constraints
Do not register this service or route on production. No auto-approval of identity, money movement, cryptography, tenancy or import. GitHub Actions test queue is not a prerequisite for continuing SOURCE development, but an independently reproducible passing suite plus security acceptance remains required before merge and deployment.

Manual test once an isolated checkout is available:
```sh
node --test apps/api/src/gaiz/gaiz-commercial-policy.test.mjs
```
