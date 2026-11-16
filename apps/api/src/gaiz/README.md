# GAIZ / TEBE verification boundary (candidate)
This module is an isolated **read-only** consumer of TO's proposed `GAIZ1` envelope.
It validates signature and tenant scope using a backend-controlled issuer public key.
It does not authenticate the requesting user, decrypt data, grant import privileges,
write to the database, or expose a public endpoint. Do not wire it into NestJS controllers
until key trust, authenticated tenant authorization, content validation, and explicit
approval and audit paths have been designed and reviewed.
Test: `node --test apps/api/src/gaiz/gaiz-verifier.test.mjs`.

## Experimental GAIZ2 read-only adapter — separately reviewed
- `gaiz2-readonly-verifier.mjs`: strict GAIZ2 canonical signed-envelope verification, independently supplied issuer Ed25519 public key and expected tenant/issuer scope. No decryption, key custody, API route or database operations.
- `gaiz2-trust-policy.mjs`: selects exactly one active non-revoked issuer key from an externally authenticated server-controlled trust bundle, validates public key fingerprint and tenant scope. Ambiguous overlapping rotations fail closed. A bundle passed in an HTTP request would NOT be trusted.
- `gaiz-service-contract.mjs`: proposed bounded, versioned job request and response validators and a tenant-context precondition. NOT an authorization grant.
- `GAIZ_SERVICE_CONTRACT_DRAFT.md`: proposed authenticated report catalogue, job/status/download and human-approved import boundaries. These routes are NOT implemented.

### Offline execution independent of GitHub Actions
```sh
node --test apps/api/src/gaiz/gaiz-verifier.test.mjs
node --test apps/api/src/gaiz/gaiz2-fixed-fixture.test.mjs
node --test apps/api/src/gaiz/gaiz2-readonly-verifier.test.mjs
node --test apps/api/src/gaiz/gaiz2-trust-policy.test.mjs
node --test apps/api/src/gaiz/gaiz-service-contract.test.mjs
```

Synthetic fixed fixture comes from TO review PR #33, SHA-256 `14e8a1f6ccc4dd0cf021dfd78a6d03f43f4124ea7854767b1052bcc6c01b5aef`. Its public key must never be used for production issuer trust. The existing GAIZ1 verifier must reject GAIZ2 bytes. Signing-valid is not tenant-authorized or import-approved.
