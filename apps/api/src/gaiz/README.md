# GAIZ / TEBE verification boundary (candidate)
This module is an isolated **read-only** consumer of TO's proposed `GAIZ1` envelope.
It validates signature and tenant scope using a backend-controlled issuer public key.
It does not authenticate the requesting user, decrypt data, grant import privileges,
write to the database, or expose a public endpoint. Do not wire it into NestJS controllers
until key trust, authenticated tenant authorization, content validation, and explicit
approval and audit paths have been designed and reviewed.
Test: `node --test apps/api/src/gaiz/gaiz-verifier.test.mjs`.
