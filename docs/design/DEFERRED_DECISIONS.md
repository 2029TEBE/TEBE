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
