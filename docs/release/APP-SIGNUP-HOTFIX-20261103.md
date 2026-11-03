# Public /signup application hotfix — 2026-11-03

Scope: a narrowly scoped source fix for the app repository `faisalwrokksa-hub/THEEPMOTEST`. The static public marketing repo `emkanycom-hash/theepmo-website` is separate, and this hotfix never copies the app source into the marketing repo.

Problem: independent CA-trusted GitHub HTTPS observations on 2026-11-03 returned `https://app.theepmo.com/signup` **404**, while `/login` returned 200. The default-branch app source did not have an `apps/web/src/app/signup/page.tsx` route, even though the newer unpublished Q91 integration branch did.

Change: add a truthful bilingual invitation-request `/signup` Next route, link to it from `/login`, and add route-level source tests. Make clear that the team is troubleshooting inbound/outbound email and replies may be delayed. Does not perform self-service user/tenant creation, payment, entitlement activation or mail dispatch; no secrets.

Release: must pass exact-head source/Next build CI, then be safely merged and deployed by an authorized operator to the **application** service, never the marketing Pages site. Verify exact deployed image/commit SHA and repeat independent `/signup` HTTPS smoke with 200. This PR does **not** authorize migrating other draft paid-billing features, and no checkout may be opened merely from this change.

Mail operator note: authoritative MX points to `mail.theepmo.com` on `85.93.31.149`, while an independent network test observed TCP connection refusal on ports 465, 587, 993. Real mail receipt and reply remain blocked until the VPS mail daemon/listener/firewall is repaired. Do not claim signup request mail delivery without both inbound and outbound proof.
