# THE EPMO production release gate — 2026-11-10

**Decision: NO-GO for merge-to-production and live deployment at this revision.**
Requested by project owner with automatic approval; no additional owner confirmation
is required once technical gates are satisfied. Approval does not substitute for
working release machinery, live service identity or rollback verification.

## Verified GitHub candidates

| Surface | Draft PR | Head before this audit | Latest CI | Result |
| --- | --- | --- | --- | --- |
| SaaS and backend | 2029TEBE/TEBE#483 | `e36e99ccf87e7695e82da74a47a3af379cc437d1` | 42816140123 | Success |
| Marketing | 2029TEFE/TEFE#23 | `c5d0366d58085aebb8e39806fb1d20b10d256089` | 42820702641 | Success |

Both candidate PRs are open and draft, GitHub reports mergeable=true.
CI validates code, but production readiness is a separate gate.

## Blocking release findings

1. **Public site remains intentionally preview-only.** Both current marketing
   main and its PR contain `_headers` with `X-Robots-Tag: noindex, nofollow`
   and `robots.txt` with `Disallow: /`. Marketing HTML also contains
   `meta name="robots" content="noindex,nofollow"`; preview CI explicitly
   enforces noindex, preview disclosures, and disabled checkout. A merge must
   not be described as a public production launch while these requirements hold.
2. **Cloudflare Pages deployment path is not verified.** Infrastructure audit
   `docs/infrastructure-consolidation-20261109.md` states TEFE Pages production
   auto-deploy and preview deployments were disabled. This is *historical
   evidence*, not a fresh Cloudflare API read. Current account and Pages state,
   Git integration, branch mapping, domain TLS, staged deployment, rollback
   and origin health require a fresh authenticated inspection. No Cloudflare
   deployment capability is connected in this audit session.
3. **SaaS CI does not deploy its production host.** Main `.github/workflows/ci.yml`
   builds and tests; there is no evidenced authenticated rollout to the
   `app.theepmo.com` runtime. Prior infrastructure audit identifies a VPS
   origin but does not verify currently running code identity, certificates,
   session and tenant isolation, backup restore, secrets, rollout or rollback.
4. **Internationalization release scope is incomplete.** The 23 locale variants
   represent 19 languages, but full translated and reviewed UI, notifications,
   emails and report/export templates are not implemented. The marketing shared
   label file is a *manually pinned 17-label snapshot*, not a verified automated
   cross-repository publication pipeline. EN/AR approved backend export guards
   must not be silently relaxed.
5. **Live production smoke tests are absent.** No authenticated current
   Cloudflare Pages deployment ID or current app build SHA, release evidence
   bundle, verified live endpoints, web accessibility/RTL/device acceptance,
   or rollback demonstration is attached to these two candidate heads.
   A failed external unauthenticated page fetch is not proof of a service outage.

## Safe completion order (bulk)

- Verify authorized Cloudflare account and Pages project; export zone state;
  confirm Pages production branch, auto-deploy switch, current deployment SHA,
  TLS and rollback availability. Preserve MX, SPF, DKIM and DMARC records.
- Separate *public production* SEO/robots policy from *preview/staging* in
  TEFE, remove noindex only from approved production output, retain disabled
  payment calls until real merchant launch approval, and test both artifacts.
- Verify VPS deployment mechanism, production git revision, live health,
  login/logout/password reset, tenant RLS, backup/restore, sessions, email,
  payments and authenticated API smoke checks before backend rollout.
- Confirm releases do not claim all 19 languages are translated or exports
  exist where only English fallback is available.
- Perform staging rollout, browser/device/RTL/accessibility validation and
  rollback rehearsal; capture CI and deployment evidence.
- Then promote signed-off candidate commits through approved protected
  branches, monitor live health, and record production commit/deployment IDs.

## Operational actions in this audit

No PRs merged, no production deploys issued, no DNS records, mail, billing,
customer data, credentials or Cloudflare project settings modified. These
constraints are technical **NO-GO** safeguards, not missing owner approval.

## References

- SaaS PR: https://github.com/2029TEBE/TEBE/pull/483
- Marketing PR: https://github.com/2029TEFE/TEFE/pull/23
- SaaS verified CI: https://github.com/2029TEBE/TEBE/actions/runs/42816140123
- Marketing verified CI: https://github.com/2029TEFE/TEFE/actions/runs/42820702641

## Passive production HTTPS preflight — 10 November 2026

A new non-mutating GitHub-hosted preflight was committed in marketing PR #23:

- `c819586`: `scripts/check-live-production.mjs`, HTTPS-only public endpoint probes, safe redirect allowlist, no credentials or writes.
- `477027b`: offline regression tests for success/failure behavior.
- `b2b1beb`: independent GitHub Actions preflight workflow.
- `03cc464`, `f1c0320`: require public marketing endpoints not to return `X-Robots-Tag: noindex` and test the rule.
- `f1c0320` passed the ordinary marketing validation workflow (run `42824108047`) while **production preflight failed** (run `42824108207`). This is an expected release-gate failure: production is not ready.

Direct external evidence from the preflight runner (run `42824065925`):
| URL | HTTPS GET status | Robots header | Assessment |
|---|---|---|---|
| `https://theepmo.com/` | 200 | `noindex, nofollow` | NO-GO: not indexable |
| `https://www.theepmo.com/` | 200 | `noindex, nofollow` | NO-GO: not indexable |
| `https://app.theepmo.com/login` | 200 | none observed | Reachable only, auth and deployed revision not certified |

No source or tool has authenticated live Cloudflare Pages configuration,
confirmed build SHA at production, verified web/API sessions and tenant isolation,
verified host backups/rollback, or established a deployment connector. Passing
source CI and public HTTP 200 responses **do not** prove release readiness.

**Release decision remains NO-GO**. No merges, Pages deployment, VPS rollout,
DNS changes, payments or email changes were performed. This decision reflects
verified technical safeguards, not missing owner authorization.
