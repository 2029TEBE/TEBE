# Paddle-only runtime candidate

This draft removes retired payment-provider runtime wiring and replaces the billing UI with a read-only Paddle experience. Customer checkout, webhooks and paid entitlements remain blocked until secure provider reconciliation is proven.

Applied SQL migrations and historical finance data remain unchanged; deployed schema integrity, financial reconciliation and rollback cannot be sacrificed to remove textual references from history.

All remaining source and infrastructure checks must pass on the exact commit. Independent sandbox merchant approval and deployment verification are still necessary before paid launch.
