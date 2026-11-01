import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const ci = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
const runner = readFileSync(resolve(root, 'scripts/phase15d-run-web-smoke.sh'), 'utf8');
const checker = readFileSync(resolve(root, 'scripts/phase15d-web-smoke.mjs'), 'utf8');
test('CI executes runtime acceptance after compiling web and checking artifacts', () => {
  const build = ci.indexOf('pnpm --filter @pmo/web build');
  const artifact = ci.indexOf('node scripts/verify-build-artifacts.mjs --scope all');
  const smoke = ci.indexOf('bash scripts/phase15d-run-web-smoke.sh');
  assert.ok(build >= 0 && artifact > build && smoke > artifact);
});
test('runner starts compiled standalone server rather than dev server', () => {
  assert.match(runner, /apps\/web\/\.next-prod\/standalone\/apps\/web\/server\.js/);
  assert.match(runner, /NODE_ENV=production/);
  assert.doesNotMatch(runner, /next dev/);
});
test('runner fails clearly when compiled artifact is missing', () => {
  assert.match(runner, /if \[\[ ! -s "\$ARTIFACT" \]\]/);
});
test('runner terminates temporary web server on failures and success', () => {
  assert.match(runner, /trap cleanup EXIT/);
  assert.match(runner, /kill "\$WEB_PID"/);
});
test('web acceptance uses no credentials or mutating HTTP methods', () => {
  assert.match(checker, /method: 'GET'/);
  assert.match(checker, /redirect: 'manual'/);
  assert.doesNotMatch(checker, /method: '(POST|PATCH|DELETE)'/);
});
test('smoke covers Arabic RTL and the protected Super Admin page', () => {
  assert.match(checker, /pmo_lang=ar/);
  assert.match(checker, /lang: 'ar', dir: 'rtl'/);
  assert.match(checker, /'\/super-admin'/);
});

test('runner refuses to mistake a pre-existing service for the compiled app', () => {
  assert.match(runner, /port 3000 is already serving HTTP/);
});

test('F61 exact-SHA CI runs local authenticated journeys and publishes masked artifacts', () => {
  assert.ok(ci.includes("EPMO_CUSTOMER_JOURNEY: '1'"));
  assert.ok(ci.includes("EPMO_JOURNEY_ADMIN_USER: 'platform@aetherix.test'"));
  assert.ok(ci.includes("EPMO_JOURNEY_RESTRICTED_USER: 'engineer@al-nakheel.test'"));
  assert.ok(ci.includes('epmo-local-authenticated-journey-'));
  assert.ok(runner.includes('node scripts/frontend-customer-journey.mjs'));
  assert.ok(runner.includes('WEB_ORIGIN=http://localhost:3000 HOSTNAME=localhost'));
  const journey = readFileSync(resolve(root, 'scripts/frontend-customer-journey.mjs'), 'utf8');
  assert.ok(journey.includes('keyboard_navigation_focus_and_escape'));
  assert.ok(journey.includes('logout_revokes_session'));
  assert.ok(journey.includes('mask: page.locator'));
  assert.ok(!journey.includes('context.tracing.start'));
});

test('F61 compiled standalone browser serves real client bundles before authenticated UAT', () => {
  // A successful HTML-only smoke is insufficient: without static JS the
  // recovery/invitation forms never hydrate and false-positive UAT is possible.
  assert.ok(runner.includes('STATIC_SRC=apps/web/.next-prod/static'));
  assert.ok(runner.includes('STANDALONE_WEB=apps/web/.next-prod/standalone/apps/web'));
  assert.ok(runner.includes('cp -a "$STATIC_SRC/." "$STANDALONE_WEB/.next-prod/static/"'));
  assert.ok(runner.includes('cp -a apps/web/public/. "$STANDALONE_WEB/public/"'));
  const bundle = runner.indexOf('compiled Next.js client bundle is not served');
  const journey = runner.indexOf('node scripts/frontend-customer-journey.mjs');
  assert.ok(bundle > 0 && journey > bundle);
  assert.ok(runner.includes('http://localhost:3000/_next/static/$STATIC_REL'));
});

test('F61 canceled synthetic recovery interception cannot crash CI or leak into later scenarios', () => {
  const journey = readFileSync(resolve(root, 'scripts/frontend-customer-journey.mjs'), 'utf8');
  assert.ok(journey.includes("await page.unrouteAll({ behavior: 'ignoreErrors' })"));
  assert.ok(journey.includes('let interceptionFailed = false;'));
  assert.ok(journey.includes('interceptionFailed = true;'));
  assert.ok(journey.includes("requests !== 1 || interceptionFailed"));
  assert.ok(journey.includes("report.failed++"));
});


test('F61 local authenticated browser waits for client hydration before JS form negatives', () => {
  const journey = readFileSync(resolve(root, 'scripts/frontend-customer-journey.mjs'), 'utf8');
  const hydrated = journey.match(/waitUntil: 'networkidle'/g) ?? [];
  assert.ok(hydrated.length >= 7, 'all recovery/reset/invitation client forms must wait for bundles');
});

test('F61 mobile app shell cannot expand to wide billing/settings table min-content', () => {
  const css = readFileSync(resolve(root, 'apps/web/src/app/globals.css'), 'utf8');
  assert.match(css, /\.shell\s*>\s*div\s*\{\s*min-inline-size:\s*0/);
  assert.match(css, /@media \(max-width: 940px\) \{ \.shell \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
});

test('F62 settings tables remain semantic and keyboard-scrollable at 375px RTL', () => {
  const settings = readFileSync(resolve(root, 'apps/web/src/app/(app)/settings/page.tsx'), 'utf8');
  assert.equal((settings.match(/className="scrollx" role="region"/g) ?? []).length, 3);
  for (const section of ['Workspace', 'Members', 'What your role can do']) {
    assert.ok(settings.includes(`aria-label={t('${section}')} tabIndex={0}`));
  }
});

test('F62 authenticated CI uses the API-aligned localhost origin and verifies a real Secure session cookie', () => {
  // Production mode marks pmo_session Secure. The browser's localhost
  // exception is not equivalent to 127.0.0.1 for this acceptance harness.
  assert.ok(runner.includes('NODE_ENV=production WEB_ORIGIN=http://localhost:3000 HOSTNAME=localhost'));
  assert.ok(runner.includes('EPMO_UAT_URL=http://localhost:3000'));
  assert.ok(runner.includes('PHASE15D_WEB_URL=http://localhost:3000'));
  assert.ok(!runner.includes('http://127.0.0.1:3000'));
  const journey = readFileSync(resolve(root, 'scripts/frontend-customer-journey.mjs'), 'utf8');
  assert.ok(journey.includes('await context.cookies(cfg.origin)'));
  assert.ok(journey.includes("cookie.name === 'pmo_session'"));
  assert.ok(journey.includes('cookie.secure && cookie.httpOnly'));
});
