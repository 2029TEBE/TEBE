# THEEPMO consolidation audit — 2026-11-09

## Authoritative ownership

| Role | Repository | Live target |
| --- | --- | --- |
| Public frontend | https://github.com/2029TEFE/TEFE | Cloudflare Pages `theepmo-website`; theepmo.com and www.theepmo.com |
| Authenticated app and backend | https://github.com/2029TEBE/TEBE | app.theepmo.com A 85.93.31.149; host service identity still needs verification |

Both repositories are private, unarchived, default main. Keep apps/web in TEBE until an independently validated UI migration exists. Git branches and old PRs are not duplicate repositories.

## Live Cloudflare observations

Zone-owning account: Alsaleemfaisal@outlook.com's Account, ID `809a1bee2454c599b0622ad286455ffb`. No account transfer performed.

`theepmo-website` is Git-connected to 2029TEFE/TEFE, production branch main, production commit bafd70795b2e082b01760cfc93eb6abab17e7108. Git integration now works; older documentation describing error 8000011/manual-only delivery is stale. Its automatic production and preview branch deployments were disabled during this audit. Existing production remains served. No deploy hooks were defined.

`theepmo-preview` is linked to faisalwrokksa-hub/THEEPMOTEST, with Deployments paused already visible. It retains preview.theepmo.com. Do not delete until callback, CORS, cookie, webhook and rollback dependencies are verified. Pausing does not take existing URLs offline.

## DNS inventory (all TTL Auto)

| Name | Type | Target/value | Proxy | Decision |
| --- | --- | --- | --- | --- |
| app | A | 85.93.31.149 | Proxied | Keep; verify VPS app and TLS |
| mail | A | 85.93.31.149 | DNS only | Preserve |
| preview | CNAME | theepmo-preview.pages.dev | Proxied | Retirement candidate; hold |
| @ | CNAME | theepmo-website.pages.dev | Proxied | Keep |
| www | CNAME | theepmo-website.pages.dev | Proxied | Keep; verify canonical redirect separately |
| @ | MX | mail.theepmo.com, priority 10 | DNS only | Preserve |
| _dmarc | TXT | v=DMARC1; p=none; adkim=r; aspf=r | DNS only | Preserve |
| mail._domainkey | TXT | Existing RSA DKIM public key | DNS only | Preserve exact existing value |
| @ | TXT | v=spf1 ip4:85.93.31.149 ~all | DNS only | Preserve |

No api, staging or api-staging records are present. Do not invent origins or create these before verified host routing and certificates. There are no arbitrary numbered DNS labels requiring renaming. Provider IDs and content-addressed preview deployment URLs must not be renamed.

## CI and workflow evidence

- TEFE current main latest run: https://github.com/2029TEFE/TEFE/actions/runs/42055391819 — success.
- TEBE current main latest CI: https://github.com/2029TEBE/TEBE/actions/runs/42589671974 — success after PR 469.
- TEBE CI tests/builds only; it does not deploy production.
- TEBE one-time import workflow was still capable of writing uploaded source directly to main. This draft removes that obsolete workflow, retaining CI unchanged.
- TEFE deploy-cloudflare-pages.yml is manual-only, but duplicates the now-working Pages Git delivery mechanism. Review retirement rather than running it.

## Remaining gates and rollback

No DNS, production release, database, email or application code changes were made. DNS rollback means retaining all current record values above; obtain a fresh zone export before any future mutation. Frontend delivery rollback means restoring branch-control selections only after release authorization. Backend workflow rollback is a Git revert of this proposed change.

NO-GO for deleting legacy resources or changing DNS: backend live identity, authentication/session flow, API origin and contracts, CORS/cookies/webhooks, staging isolation, host backups/restore and legacy URL references remain unverified. A complete host inventory and fresh DNS export are required before cutover. Exactly two authoritative repositories are established; account-wide legacy repository retirement is not yet verified.

Direct inspection: https://dash.cloudflare.com/809a1bee2454c599b0622ad286455ffb/theepmo.com/dns/records and https://dash.cloudflare.com/809a1bee2454c599b0622ad286455ffb/pages/view/theepmo-website
