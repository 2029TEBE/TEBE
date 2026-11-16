# GAIZ durable job queue and private artifact store — DEVELOPMENT DRAFT

This work continues GAIZ execution **without touching Stripe or Paddle**.
It is a source-code foundation, NOT a deployed durable queue, database
migration or connected object-storage instance. The new components are not
registered in NestJS, not scheduled, and not available to users.

## Scope
- `gaiz-postgres-worker-queue.mjs`: injected, disabled-by-default PostgreSQL
  worker queue adapter for `gaiz-report-worker.mjs` from PR #526.
  `claimNext` uses a DB transaction and `FOR UPDATE SKIP LOCKED` to
  claim queued or expired jobs, stores only a hash of the random 256-bit lease
  token, and atomically switches the queued order to `processing`.
  `confirmEntitlement` verifies current active customer and a durable,
  non-expired entitlement row.
  `completeWithArtifact` rechecks lease, customer, entitlement and staged
  artifact digest/ownership under row locks and commits order+job+artifact and
  audit as a single DB transaction.
  `failClaim` is fence-checked; stale worker tokens cannot overwrite a newer
  claim and eligible failures requeue with bounded attempts.
- `gaiz-private-artifact-store.mjs`: requires injected private encrypted object
  storage, verifies content digest before upload and after read, generates
  random server-only object keys, persists stage metadata in a DB transaction,
  and checks locked customer+order+job+artifact state and revocation before
  returning bounded bytes. No public buckets, presigned URLs or cross-tenant
  download claims are accepted.
- `gaiz-queue-storage.test.mjs`: source-only synthetic tests for queue claims,
  rollback, token lease, private encrypted writes, checksum and revoked-artifact
  behavior. **Not run as part of this PR.**
- `docs/gaiz/PROPOSED_ORGAIZ_WORKER_STORAGE_SCHEMA.sql`: proposal with
  `BEGIN ... ROLLBACK`, so it is **not an applied migration**. The
  `orgaiz_order_entitlements` grant provenance requires separate approval.

## Critical integration prerequisites
1. **Database review and migration:** existing commerce schema lacks lease,
   deadline, worker format/inputs, staging and entitlement columns/tables.
   Write and test a real forward/backward migration, unique ownership and
   foreign-key constraints, indexes, dedicated service principals, audit
   history and FORCE RLS policies. With no policies the draft denies access.
2. **Durable entitlement:** payments remain deferred. Do not create fake paid
   orders, fabricate `verifiedByServer`, or grant production entitlements to
   test users. For offline demos use the deterministic renderer without
   customer data. A free trial requires a separate reviewed authorization rule.
3. **Storage implementation:** connect a real encrypted private bucket/blob
   backend, configured KMS envelope encryption or equivalent, object owner
   binding and immutable staging. Add mark-and-sweep cleanup for orphan blobs,
   staged DB rows, and cancelled/refunded artifact revocations. No provider
   credentials committed here.
4. **Lease correctness:** test concurrent workers, retries, crashed jobs,
   expired leases, max-attempt dead letters, heartbeat/renewal, deadline,
   processing row recovery, job deduplication and transaction isolation.
   Review the order and row locking sequence against payment/refund revocation
   transactions. All untrusted IDs must be derived from server-controlled
   ownership and not HTTP bodies.
5. **Download delivery:** `readAuthorized` intentionally buffers at most
   10MB inside the locking transaction; streaming requires a separate
   reviewed concurrency/revocation strategy. Authenticate every request,
   check CSRF where applicable, add safe `Content-Disposition`, CSP,
   no-store, rate limits, cache/proxy controls, download audit and retention.
   Never serve HTML from the app origin without approved isolation.
6. **End-to-end tests:** run Node test suite, PostgreSQL DB/role/RLS tests and
   real encrypted storage tests in staging, including policy denial,
   over-quota output, corrupted bytes, cancellation/refund, role revocation,
   stale leases, audit atomicity and storage failures before production merge.

Manual check:
```sh
node --test apps/api/src/gaiz/gaiz-queue-storage.test.mjs \
  apps/api/src/gaiz/gaiz-report-worker.test.mjs
```

**Do not merge or deploy as a working queue without RLS, real migrations,
binding to actual storage and passing security/functional tests.**
Payment integration remains paused.
