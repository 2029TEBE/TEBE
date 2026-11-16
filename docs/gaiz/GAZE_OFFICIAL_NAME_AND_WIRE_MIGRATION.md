# .GAZE — official name and legacy compatibility review

**Official display name and proposed extension:** `.GAZE` (exact spelling, uppercase). No independent product named "GAIZ2" or "GAZE 2".

## Existing bytes are not renamed or silently converted
- TO experimental producer currently emits `GAIZ1\\n` and `GAIZ2\\n` magic bytes under legacy `.gaiz` filenames.
- TEBE's independent verifiers, sealed fixtures, SHA-256 expectations, key custody grants and database identifiers currently refer to the legacy experimental protocol. These internal identifiers MUST remain stable until a versioned protocol migration is reviewed and accepted.
- A `.GAZE` extension is a **proposed** future packaged format and does not imply that the current legacy wire bytes have been ratified.
- TEFE and TEBE may display `.GAZE` as the product name while explicitly describing their legacy-format preview limitations. Never label an unreviewed legacy file as production-valid.

## Required migration before releasing .GAZE
1. TO protocol owner specifies final magic bytes, canonical signed/AAD inputs, content-type, filename extension, version negotiation and rejection of unknown or downgraded formats.
2. Cross-runtime TO, TEBE and TEFE consumers receive independent positive/negative fixtures before any parser accepts a new wire header.
3. Issuer/recipient trust stores, key rotation, revocation and tenant-bound authorization remain independent of display names.
4. Approved frontend/API mappings and localized customer messaging may switch to `.GAZE`, without implicit conversion, before production release.
5. CI may automatically test compatible legacy consumers and new fixtures. Formal protocol freeze, human import consent, real KMS release and security rollout may never be auto-approved.

This is a brand alignment and migration contract, not a live protocol upgrade, production KMS connection or deployment.
