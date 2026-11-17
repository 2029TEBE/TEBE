# Brand terminology and compatibility register — 2026-11-17

## Approved commercial language
- **ORGANIZATION** — Organizational Design and Governance.
- **STRATEGIZE** — Strategic Planning and Execution.
- **ORGANIZATION + STRATEGIZE** — Integrated Organization and Strategy Management.
- **GIZE** — AI-Powered Enterprise Intelligence.
- **GIZE AI** — AI-Powered Intelligence and Decision Support.
- **Powered by GIZE AI** is the endorsed product attribution.
- Retain **THE EPMO** where it is the authorized commercial identity.
- Translate descriptions, but keep the literal brand **GIZE AI** unchanged in every locale.

## Compatibility register — retain until versioned migration
- `gaiz` paths, source import names, function identifiers, test fixtures and integration types may be technical compatibility identifiers, not user-visible brands.
- `.gaiz`, `GAIZ1` and `GAIZ2` are experimental file-format/protocol identifiers; do not mutate bytes, signature verification, content types, accepted extensions, wire values or stored data merely to rebrand.
- Review any public routes, saved preferences, authentication names, environment variables, billing identifiers and webhook event fields before changing them. Add aliases and regression coverage when changing public identifiers.
- Historical reports, release notes, archived evidence and fixtures are exempt from text replacement when clearly identified as historical.

## Required verification before merge
1. Case-insensitive audit of active UI strings, translations, meta tags, accessibility labels, messages, email templates, and public documentation.
2. Human review of remaining old-name matches classified as history, compatibility, technical identifier, pending migration, or unresolved inconsistency.
3. Run the relevant build, offline tests, localization coverage checks, visual light/dark and mobile checks.
4. Report code merge separately from Cloudflare/server production deployment; do not assume deployed from a merged commit.

## Scope of this branch
This register establishes naming and safety boundaries. It is **not** evidence that the full repository has been rebranded or tested.