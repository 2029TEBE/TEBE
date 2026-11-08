# Paddle Sandbox — secure read-only API verification

The draft branch contains a manually triggered workflow:
`.github/workflows/paddle-sandbox-catalog-readonly.yml`.

**Status: not executed against the real Paddle account.** This workflow cannot be selected in the normal GitHub Actions UI until its workflow file is present on the repository's default branch. Do not merge a stacked draft PR solely to make the button visible; the full review/release gates still apply.

## Configuration (authorized operator only)

1. In the Paddle **Sandbox** dashboard, create a narrowly scoped **sandbox** API key with `price.read` and `product.read`. Never use a live merchant key.
2. In GitHub repository Settings → Secrets and variables → Actions, add **repository secret** `PADDLE_SANDBOX_READONLY_API_KEY`. Do not add any secret to a PR, discussion, comment, document, source file or workflow input.
3. When this workflow has been safely merged to the default branch through normal review, select **Actions → Paddle Sandbox Catalog — read-only verification → Run workflow**. It uses Node.js 22 with no dependency install, checkout credentials disabled, and GitHub read-only permissions.
4. The check performs exactly two sandbox **GET** operations for the known `pri_` and `pro_` IDs, verifies product association, active states, `4900` minor units in `USD`, monthly recurrence and no trial. It outputs only booleans and a sanitized reason code, never tokens or provider responses.

Missing keys, incorrect permissions, network errors, entity mismatch and non-sandbox configuration **fail closed**. The test does not create transactions, collect payments, modify merchant settings, process Webhooks, or activate subscriptions.

## Mandatory follow-on release gates

Real sandbox transaction and notification lifecycle, durable reconciliation after ambiguous provider responses, independently signed webhook verification, entitlement safety, production merchant approval, security review and explicit release approval remain outstanding under issue #443. `PADDLE_ENABLED=false` and the public checkout HTTP 503 must remain in force.

Developer API references:
- https://developer.paddle.com/api-reference/prices/get-price/
- https://developer.paddle.com/api-reference/products/get-product/

## Tax and total protection

The catalog API reports the base recurring price, not a customer's final payable amount. The read-only verifier now returns a sanitized `taxMode` and always sets `finalCustomerTotalVerified:false`; tax mode can be `account_setting`, `external`, `internal`, or `location`. Regional overrides must be absent for the strict USD $49 base-price assertion. Even with no regional override, VAT/tax, discounts and Paddle transaction calculations can change the amount the customer actually pays. Do not equate this catalog preflight with an authorized settlement amount, and do not grant entitlements until independently verified provider settlement is reconciled to the agreed invoice terms.

The existing synthetic settlement writer matches its fixed test invoice amount. Real taxes and the commercial invoice/checkout tax treatment still need explicit product/legal review and provider integration tests; this read-only workflow does not solve that.
