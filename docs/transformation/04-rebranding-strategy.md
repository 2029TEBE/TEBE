# The EPMO Rebranding Strategy

Canonical English display name: **The EPMO**. Canonical Arabic display name: **المكتب التنفيذي لإدارة المشاريع**. Stable internal product slug: `the-epmo`.

1. Prioritize visible brand, metadata, notifications, assistants and export labels without changing persisted records or network contracts.
2. Preserve tenant identifiers, `core360` feature IDs, `@pmo` imports and external service registrations unless a migration is separately approved.
3. Apply visual QA in English and Arabic; capture screenshot baselines and check Arabic wordmark width on narrow rail/mobile.
4. For new branding assets and DNS names, obtain design and owner approval before deployment.
5. Coordinate future domain changes with redirects, Microsoft OAuth callbacks, cookie settings, webhook registrations and deployment infrastructure.
6. Release with regression coverage and rollback via source revision and deployment snapshot.

The supplied archive is **source-only**. No live environment, production data or third-party configuration has been modified.

## Legacy naming compatibility: GAIZ = GIZE

**GAIZ is the legacy name of GIZE, not a separate product.** The customer-facing AI product brand is **GIZE AI**. All applicable new user-facing names, navigation, descriptions and translations must say GIZE / GIZE AI, not GAIZ. The historical `GAIZ`, `GAIZ1`, `GAIZ2` and `.gaiz` identifiers may still appear only in explicit legacy compatibility instructions, immutable signed data, protocol versions, file extensions, existing API paths, persisted references and migration/audit records. Existing GAIZ artifacts and clients must continue to work under the GIZE brand; never rewrite encrypted wire bytes, silently rename extensions, invalidate signatures, or change endpoints without versioned aliases, migration tests and coordinated release approval.
