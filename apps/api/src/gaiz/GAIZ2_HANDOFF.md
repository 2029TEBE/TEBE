# GAIZ2 TEBE read-only verification adapter
This module consumes the experimental TO `GAIZ2\n` draft. Do not use it to authorize enterprise imports or decrypt tenant data.

- Entry point: `verifyGaiz2ForPreview(bytes,{trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope})`.
- Trusted issuer key and tenant expectation must come from TEBE's authenticated server-side policy, **not** from uploaded files or caller-supplied HTTP fields.
- Returns only a hash receipt with `authorizationGranted:false` and `importAllowed:false`. No NestJS controller, database writes, RLS changes or secret custody introduced.
- Separate GAIZ1 verifier remains unchanged to avoid silent version upgrades or downgrades.
- Test: `node --test apps/api/src/gaiz/gaiz2-verifier.test.mjs`.
- TO authoritative draft: `faisalwrokksa-hub/TO:gaiz/CONTRACT-v2.md`, GAIZ PR #30.
- Tests generate an independently implemented synthetic GAIZ2 envelope on TEBE's runner. **A pinned byte-for-byte TO-produced fixture and cross-repository CI are not yet in place.** Do not claim this is full end-to-end integration.
- Security review, key registry, revocation, strict business schema checks, fuzzing, replay policy and permissions must precede any production integration.
