# S16 offline monitoring and health contract

This review-only contract validates a pair of separate Saudi shared/dedicated monitoring profiles. It **does not** configure alerts, cloud resources, endpoints, or operational monitoring. Run locally with `node --test scripts/staging-monitoring-contract.test.mjs`. CLI: `node scripts/staging-monitoring-contract.mjs path/to/nonsecret-inventory.json`.

Required per-profile controls: distinct namespace, authenticated private metrics, redacted logs without raw audit payloads, minimal health (/healthz) and readiness (/readyz) probes without secrets or tenant data, bounded retention, and alert coverage for API/web availability, HTTP 5xx, p95 latency, database connectivity, backup freshness, restore-drill age, and certificate expiry.

Do not claim operational acceptance from this validator. Before any deployment, independently verify alert routing and on-call response, authenticated scrape access, TLS/WAF, actual telemetry redaction, synthetic probe behavior, backup and restore evidence, provider residency, tenant isolation, and rollback. All fixture attestations intentionally remain false.
