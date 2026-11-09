# Deferred decisions — THEEPMO design-first v3
Updated 2026-11-08
| Item | Reason | Lowest-risk next action |
|---|---|---|
| Live operational metrics and tenant usage | No audited authorized read contracts mapped for proposed vendor dashboard | Keep 'not measured' and synthetic prototype; scope API work separately |
| Real agent execution, approvals, spending | No verified execution/authorization service | Keep controls disabled; require future security design and explicit owner authorization |
| Storage usage and telemetry | No verified measurements | Show unavailable state, not zero |
| Cloudflare/DNS/hosting/deployment | Explicitly excluded | No action |
| Backend/API/database/RLS changes | Explicitly excluded | No action |
| Paid UI or model services | No cost authorization | Use existing/free source-backed components |
| Production release or merge | Not auto-approved | Draft review-only PRs; future explicit release approval |
| Screenshots, typecheck, accessibility, tenant security | No local runtime/test evidence in this task | Execute targeted checks in QA task; report skipped if environment unavailable |
| TEFE /sa routing | Design-only localization concept | Preserve existing language switch and defer routing |
| Existing theme defaults | TEBE currently dark-first and stores preference under pmo-theme-v2 | Preserve preference; consider alternate default only with UX evidence |


## CI blockers newly verified on TEBE PR #442 (2026-11-08)
| Item | Evidence | Safe disposition |
|---|---|---|
| Dependency audit failed | GitHub Actions run 42455007874, audit job: 67 vulnerabilities — 2 critical, 25 high, 31 moderate, 9 low | Preserve lockfile during design-only phase; commission separate dependency/security investigation and patch review before merge |
| Eight integration/security test failures | GitHub Actions run 42455007874: 7 Microsoft integration test failures and 1 financial import authorization-status mismatch (400 vs 403) | No bypass or weakening assertions; distinguish missing CI environment configuration from actual API logic defect, then rerun security regression |
| CI acceptance evidence gate failed | CI run 42455007874, verify job | Resolve root tests and rerun full gate; no release sign-off |
| Final browser/visual checks | Offline static showcase source can be inspected, but hosted browser and screenshot evidence for latest commit not verified | Download in local browser; record 1440/768/390, dark/light, Arabic RTL, keyboard focus, overflow and accessibility results |
| Full Arabic localization of design gallery | Gallery provides RTL geometry switch only, English labels remain | Localize the gallery only if necessary; existing app Arabic behavior must still be regression-tested |
