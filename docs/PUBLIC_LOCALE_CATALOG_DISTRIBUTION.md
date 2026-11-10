# THE EPMO — public catalog distribution contract (draft)

## Current implementation (not a released integration)

The SaaS draft branch can generate a **public-only, deterministic candidate catalog** using:

```bash
node scripts/build-public-locale-catalog.mjs > public-locale-catalog.json
```

The JSON includes `schemaVersion`, `source`, `scope`, `releaseApproved=false`,
`coverage=partial`, the 23 registered frontend locales, limited UI text, and a SHA-256
integrity digest computed over the same object without the `sha256` property.

This is not a complete translation pack. It includes only catalogued front-end labels.
English is the source; absent translations are omitted rather than invented. It does not
ship backend contracts, secrets, accounts or tenant data.

## Required consumer checks for TEFE

1. Give the marketing repository write permission through the approved GitHub
   integration, or have its maintainer consume this artifact on its existing draft PR #23.
2. Establish an authenticated, pinned artifact transfer in CI. Do not fetch private
   SaaS source packages from a public browser at runtime.
3. Verify `schemaVersion===1`, `releaseApproved` and `coverage` against the
   intended release policy. **Do not publicly advertise full 19-language coverage.**
4. Recompute the SHA-256 over the exact JSON payload excluding `sha256`.
5. Verify 23-locale registry parity, placeholder parity and absence of unknown locale
   keys. Preserve existing marketing-only content until the canonical semantic-key
   migration is implemented and reviewed.
6. Perform side-by-side review of overlapping keys and migration of each public
   marketing key into the authoritative catalog before removing the old source.
7. Gate any release on accessibility, RTL, device testing and Cloudflare trigger
   verification. Keep both PRs draft until that evidence exists.

## Explicit limitations

- There is not yet a physically shared translation source consumed by both deployments.
- The existing English-string key system is a transitional representation; long-term
  source keys must be stable and semantic.
- The package does **not** approve machine translations, localized exports, emails,
  19-language completion, or any production deployment.
- Existing API / board-pack EN/AR restrictions must remain in place.
