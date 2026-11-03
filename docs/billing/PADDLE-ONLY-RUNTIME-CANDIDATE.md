# Paddle-only runtime removal — review candidate

This source-only candidate removes inactive-provider settings from all environment examples and API configuration, unregisters legacy provider controllers, and removes legacy checkout/mutation execution from customer routes and the billing UI.

**NO-GO for live payments.** The Paddle webhook deliberately returns a non-2xx error until signed receipt validation, atomic database writes, idempotent settlement, provider API checks, lifecycle handling and tenant-bound entitlement verification are implemented and tested in a real sandbox.

Old financial records and already-applied SQL migrations must not be rewritten or deleted. The repository still contains archival code, migration names and regression tests referencing the previous provider. This is **not** a claim of zero references across Git history or source.

Required next: migrate dormant payment helper files and legacy tests in separate bounded batches, then run full CI, validate true sandbox checkout, and independently approve staging and live release.
