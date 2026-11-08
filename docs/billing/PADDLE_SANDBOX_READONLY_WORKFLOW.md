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
