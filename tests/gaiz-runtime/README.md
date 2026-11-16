# Offline engineering acceptance

Use pinned checkouts of the TO and TEBE runtime PRs. Install PGlite 0.5.16 in an
isolated tools directory (not a production database). Then run:

```sh
GAIZ_TO_CHECKOUT=/absolute/path/to/TO \
PGLITE_MODULE=/absolute/path/to/tools/node_modules/@electric-sql/pglite/dist/index.js \
node --test tests/gaiz-runtime/acceptance.mjs
```

The suite applies the actual draft migrations 0020–0027 only to a fresh disposable
PostgreSQL-WASM instance. It exercises real cryptographic signatures/decryption,
restricted-role RLS, signed grants/results, independent approved patch hashes,
CAS/revision triggers, durable SQL replay rejection, registry revocation and
same-transaction audit rollback. The TO file-ledger and real Vault tests live in
`gaiz/runtime/`. No production connection string or secret is needed.

This is not a substitute for multi-connection PostgreSQL lock contention,
production authentication, distributed failover or independent security review.
Hosted CI was postponed by the user; no test status is fabricated or waived.
