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

GAIZ and GAIZ2 are former naming variants for the **GIZE** intelligence capability, commercially branded **GIZE AI**. Preserve `GAIZ1`, `GAIZ2`, `.gaiz`, existing protocol magic, endpoints and persisted identifiers as explicitly documented compatibility identifiers, not separate products. Customer-facing labels must say GIZE AI. Renaming any cryptographic bytes or APIs requires a versioned backward-compatible migration, tests and release authorization.
