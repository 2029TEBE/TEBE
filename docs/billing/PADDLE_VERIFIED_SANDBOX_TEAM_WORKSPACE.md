# THE EPMO — verified Paddle Sandbox catalog mapping (8 November 2026)

**Scope: sandbox catalog identity only; review-only branch. No checkout, payment, webhook settlement, entitlement activation, production deployment or live merchant approval.**

## Verified directly from the authenticated Paddle Sandbox product detail screen

| Field | Verified value |
| --- | --- |
| Paddle environment | Sandbox / Test mode |
| Account display name | The Epmo |
| Catalog product | THE EPMO — Team Workspace |
| Product status | Active |
| Product ID | `pro_01m6x789k8kmvez6zk7cm17wdz` |
| Recurring price status | Active |
| Price ID | `pri_01m6x7w5zy16nktzjwg2ezas2d` |
| Currency | USD |
| Amount | 49.00 / month |
| Trial | None |
| Internal description | THE EPMO \| Team Workspace \| Monthly \| USD 49 |

**Important:** Product and price IDs are public-facing identifiers, not API secrets. They belong to the sandbox only and must never be silently reused with Paddle live APIs.

## Safe wiring contract for integration review

- The catalog key `team_workspace_monthly` maps to this **exact** sandbox `pri_` ID, paired with the verified `pro_` ID.
- Server-side checkout must obtain the price from an approved server-owned mapping. The browser may select only an allowlisted plan key; it must not supply an arbitrary price, amount, tenant ID or customer ID.
- The server must read an explicit environment (`PADDLE_ENV=sandbox`) and fail closed on absent/mismatched configuration. No fallback to live endpoints, no placeholder credentials.
- `PADDLE_ENABLED=false` and payment collection disabled until independently approved authenticated checkout, tenant-bound invoice and durable signed-webhook settlement exist.
- The read-only preflight in ancestor #438 can accept `PADDLE_SANDBOX_PRICE_IDS=pri_01m6x7w5zy16nktzjwg2ezas2d` in a trusted runtime; it still needs a scoped sandbox API key, expected seller ID, client token and verified staging notification destination to report full readiness.
- Do not treat this catalog mapping as proof of paid entitlement, subscription activation, refunds, renewals or production readiness.

## Acceptance required before integration

1. Authenticated read-only API preflight independently confirms seller ID, exact active price and interval.
2. Review existing billing architecture and select a single approved server-owned catalog module; no duplicate billing authority.
3. Add unit tests for sandbox/live separation, price/product pair, USD 4900 minor units, monthly interval, input tampering and disabled billing.
4. Continue integrated CI and genuine sandbox checkout/webhook acceptance under issue #443 after merchant credentials are safely provisioned.

Related: #431–#438 and #443.
