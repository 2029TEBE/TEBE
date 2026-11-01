#!/usr/bin/env node
/**
 * F44: real browser customer journeys against a DISPOSABLE LOOPBACK stack.
 * Requires two distinct .test accounts: an admin in two disposable workspaces
 * and a restricted user. Workspace switches affect only synthetic sessions.
 * Does not use real invitations, send recovery email, change workspace data,
 * or claim HTTPS staging/provider acceptance. No credential-bearing traces.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { journeyConfiguration, JOURNEY_VARIANTS, assertJourneyLayout, assertMutationRedirect } from './frontend-customer-journey-policy.mjs';

const cfg = journeyConfiguration(process.env);
await mkdir(cfg.out, { recursive: true, mode: 0o700 });
const report = { scope: 'LOCAL_DISPOSABLE_SYNTHETIC_ONLY_NOT_STAGING_ACCEPTANCE', variants: [], passed: 0, failed: 0 };
const known = new Set([
  'locale_direction_failed', 'missing_heading', 'horizontal_overflow',
  'missing_invitation_error', 'missing_recovery_error', 'fragment_not_scrubbed',
  'authentication_failed', 'missing_admin_invitation_form', 'missing_billing_screen',
  'restricted_billing_access', 'restricted_invitation_access', 'mutation_not_rejected',
  'unsafe_mutation_redirect', 'unexpected_mutation_feedback', 'unexpected_auth_redirect',
  'workspace_switch_fixture_missing', 'workspace_switch_not_confirmed',
  'workspace_switch_revert_failed', 'invitation_false_success',
  'recovery_request_replayed', 'recovery_rate_limit_not_explained',
  'billing_return_false_confirmation', 'recovery_false_success', 'reset_false_success',
]);
const fakeToken = '00000000-0000-4000-8000-000000000000.' + 'A'.repeat(43);
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const variant of JOURNEY_VARIANTS) {
    const context = await browser.newContext({
      viewport: { width: variant.width, height: variant.height },
      locale: variant.lang === 'ar' ? 'ar-SA' : 'en-GB',
      reducedMotion: 'reduce', deviceScaleFactor: 1,
    });
    await context.route('**/*', route => {
      let permitted = false;
      try {
        const url = new URL(route.request().url());
        permitted = url.origin === cfg.origin || ['data:', 'blob:'].includes(url.protocol);
      } catch { /* fail closed */ }
      return permitted ? route.continue() : route.abort();
    });
    await context.addCookies([{ name: 'pmo_lang', value: variant.lang, url: cfg.origin }]);
    const page = await context.newPage();
    page.on('dialog', dialog => { void dialog.dismiss(); });
    const result = { variant: variant.name, checks: [] };
    report.variants.push(result);
    async function step(name, run) {
      try {
        await run();
        // Fixed-name screenshots only; never record authenticated traces or secrets.
        const capture = new Set([
          'expired_login_bilingual', 'recovery_503_no_success',
          'recovery_429_singleflight_no_success',
          'invitation_403_no_acceptance', 'invitation_html_200_rejected', 'admin_login_and_onboarding',
          'admin_subscription_read', 'billing_return_not_proof', 'admin_workspace_switch_round_trip',
          'restricted_login_and_no_invitation_form',
          'restricted_billing_redirect',
        ]);
        const screenshot = capture.has(name) ? variant.name + '-' + name + '.png' : undefined;
        if (screenshot) await page.screenshot({ path: join(cfg.out, screenshot), fullPage: true, animations: 'disabled' });
        result.checks.push({ name, status: 'PASS', ...(screenshot ? { screenshot } : {}) });
        report.passed++;
      } catch (error) {
        result.checks.push({ name, status: 'FAIL', code: known.has(error?.message) ? error.message : 'browser_journey_failed' });
        report.failed++;
      }
    }
    async function layout() {
      const state = await page.evaluate(() => ({
        lang: document.documentElement.lang, dir: document.documentElement.dir,
        heading: !!document.querySelector('h1'),
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assertJourneyLayout(state, variant);
    }
    async function login(user, password) {
      await context.clearCookies();
      await context.addCookies([{ name: 'pmo_lang', value: variant.lang, url: cfg.origin }]);
      await page.goto(cfg.origin + '/login', { waitUntil: 'domcontentloaded' });
      await page.locator('input[name="identifier"]').fill(user);
      await page.locator('input[name="password"]').fill(password);
      await page.locator('button[type="submit"]').click();
      try {
        await page.waitForURL(url => url.origin === cfg.origin && url.pathname === '/', { timeout: 20000 });
      } catch { throw new Error('authentication_failed'); }
    }
    async function mutation(form) {
      return page.request.post(cfg.origin + '/api/onboarding', {
        data: new URLSearchParams(form).toString(),
        headers: { origin: cfg.origin, 'content-type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0, timeout: 15000,
      });
    }
    try {
      await step('expired_login_bilingual', async () => {
        await page.goto(cfg.origin + '/login?error=expired', { waitUntil: 'domcontentloaded' });
        await page.getByRole('alert').waitFor();
        await layout();
      });
      await step('recovery_503_no_success', async () => {
        await page.route('**/api/password-recovery/request', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
        await page.goto(cfg.origin + '/forgot-password', { waitUntil: 'domcontentloaded' });
        await page.locator('input[type="email"]').fill('journey-recovery@example.test');
        await page.locator('button[type="submit"]').click();
        await page.getByRole('alert').waitFor();
        if (await page.getByRole('status').count()) throw new Error('missing_recovery_error');
        await layout();
        await page.unroute('**/api/password-recovery/request');
      });
      await step('recovery_429_singleflight_no_success', async () => {
        // Synthetic rate limit: rapid repeated submits must create one request,
        // show localized guidance, and never claim a recovery email was sent.
        let requests = 0;
        await page.route('**/api/password-recovery/request', async route => {
          requests++;
          await new Promise(resolve => setTimeout(resolve, 200));
          await route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
        });
        await page.goto(cfg.origin + '/forgot-password', { waitUntil: 'domcontentloaded' });
        await page.locator('input[type="email"]').fill('journey-recovery@example.test');
        await page.locator('form.authform').evaluate(form => {
          form.requestSubmit();
          form.requestSubmit();
        });
        await page.getByRole('alert').waitFor();
        if (requests !== 1) throw new Error('recovery_request_replayed');
        if (await page.getByRole('status').count()) throw new Error('missing_recovery_error');
        const message = await page.getByRole('alert').innerText();
        if (!(variant.lang === 'ar' ? message.includes('محاولات كثيرة') : message.includes('Too many recovery requests')))
          throw new Error('recovery_rate_limit_not_explained');
        await layout();
        await page.unroute('**/api/password-recovery/request');
      });
      await step('recovery_200_html_not_confirmed', async () => {
        // Intermediary HTML with 200 must not claim an email was sent.
        await page.route('**/api/password-recovery/request', route => route.fulfill({
          status: 200, contentType: 'text/html', body: '<html><body>Sign in</body></html>',
        }));
        try {
          await page.goto(cfg.origin + '/forgot-password', { waitUntil: 'domcontentloaded' });
          await page.locator('input[type="email"]').fill('journey-recovery@example.test');
          await page.locator('button[type="submit"]').click();
          const alert = page.getByRole('alert');
          await alert.waitFor();
          const message = await alert.innerText();
          if (!(variant.lang === 'ar' ? message.includes('تعذّر تأكيد طلب الاستعادة') :
            message.includes('could not be confirmed')) ||
            await page.getByRole('status').count()) throw new Error('recovery_false_success');
          await layout();
        } finally { await page.unroute('**/api/password-recovery/request'); }
      });
      await step('reset_200_false_ack_not_confirmed', async () => {
        // A reset bearer is disposable; no actual password-recovery endpoint is called.
        await page.route('**/api/password-recovery/reset', route => route.fulfill({
          status: 200, contentType: 'application/json', body: '{"ok":false}',
        }));
        try {
          await page.goto(cfg.origin + '/reset-password#token=' + 'A'.repeat(43), { waitUntil: 'domcontentloaded' });
          await page.locator('input[type="password"]').first().fill('SyntheticOnly123!');
          await page.locator('input[type="password"]').nth(1).fill('SyntheticOnly123!');
          if (new URL(page.url()).hash) throw new Error('fragment_not_scrubbed');
          await page.locator('button[type="submit"]').click();
          const alert = page.getByRole('alert');
          await alert.waitFor();
          const message = await alert.innerText();
          if (!(variant.lang === 'ar' ? message.includes('لم نتمكن من تأكيد') :
            message.includes('could not be confirmed')) ||
            await page.getByRole('status').count()) throw new Error('reset_false_success');
          await layout();
        } finally { await page.unroute('**/api/password-recovery/reset'); }
      });
      await step('reset_401_no_success', async () => {
        await page.route('**/api/password-recovery/reset', route => route.fulfill({
          status: 401, contentType: 'application/json', body: '{"ok":false}',
        }));
        try {
          await page.goto(cfg.origin + '/reset-password#token=' + 'B'.repeat(43), { waitUntil: 'domcontentloaded' });
          await page.locator('input[type="password"]').first().fill('SyntheticOnly123!');
          await page.locator('input[type="password"]').nth(1).fill('SyntheticOnly123!');
          await page.locator('button[type="submit"]').click();
          await page.getByRole('alert').waitFor();
          if (await page.getByRole('status').count()) throw new Error('reset_false_success');
          await layout();
        } finally { await page.unroute('**/api/password-recovery/reset'); }
      });
      await step('invitation_403_no_acceptance', async () => {
        await page.route('**/api/invite/accept', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }));
        await page.goto(cfg.origin + '/accept-invite#token=' + fakeToken, { waitUntil: 'domcontentloaded' });
        await page.locator('button[type="submit"]').waitFor();
        if (new URL(page.url()).hash) throw new Error('fragment_not_scrubbed');
        await page.locator('button[type="submit"]').click();
        await page.getByRole('alert').waitFor();
        await layout();
        await page.unroute('**/api/invite/accept');
      });
      await step('invitation_html_200_rejected', async () => {
        // An intermediary or expired-session redirect can return HTML with 200.
        // Never present this as a successfully consumed single-use invitation.
        await page.route('**/api/invite/accept', route => route.fulfill({
          status: 200, contentType: 'text/html',
          body: '<!doctype html><html><body>Sign in</body></html>',
        }));
        try {
          await page.goto(cfg.origin + '/accept-invite#token=' + fakeToken, { waitUntil: 'domcontentloaded' });
          await page.locator('button[type="submit"]').click();
          const alert = page.getByRole('alert');
          await alert.waitFor();
          const message = await alert.innerText();
          if (!(variant.lang === 'ar' ? message.includes('لم نتمكن من تأكيد') :
            message.includes('could not be confirmed')))
            throw new Error('invitation_false_success');
          if (await page.getByText(variant.lang === 'ar' ?
            'تم قبول الدعوة. يمكنك تسجيل الدخول الآن.' : 'Invitation accepted. You can now sign in.').count())
            throw new Error('invitation_false_success');
          await layout();
        } finally {
          await page.unroute('**/api/invite/accept');
        }
      });
      await step('admin_login_and_onboarding', async () => {
        await login(cfg.admin, process.env.EPMO_JOURNEY_ADMIN_PASSWORD);
        await page.goto(cfg.origin + '/settings', { waitUntil: 'domcontentloaded' });
        await page.locator('form[action="/api/onboarding"] input[name="action"][value="invite"]').waitFor();
        await layout();
      });
      await step('admin_subscription_read', async () => {
        await page.goto(cfg.origin + '/billing', { waitUntil: 'domcontentloaded' });
        if (new URL(page.url()).pathname !== '/billing' ||
            !(await page.getByRole('heading', { level: 1 }).count()))
          throw new Error('missing_billing_screen');
        // A generic Loaded error/401/403 is not a successful billing journey.
        await page.locator('section[aria-label="Current subscription"], section[aria-label="الاشتراك الحالي"]').waitFor({ timeout: 15000 });
        if (await page.getByRole('alert').count()) throw new Error('missing_billing_screen');
        await layout();
      });
      await step('billing_return_not_proof', async () => {
        // Forgeable query flags must never claim an invoice, payment, or cancellation succeeded.
        await page.goto(cfg.origin + '/billing?success=1&updated=1', { waitUntil: 'domcontentloaded' });
        const notices = await page.getByRole('status').allTextContents();
        const marker = variant.lang === 'ar' ? 'لا يؤكد' : 'does not confirm';
        if (notices.filter(message => message.includes(marker)).length < 2 ||
            notices.some(message => /Renewal invoice created or found|Subscription preference updated|تم إنشاء فاتورة التجديد|تم تحديث إعداد الاشتراك/.test(message)))
          throw new Error('billing_return_false_confirmation');
        await layout();
      });
      await step('admin_workspace_switch_round_trip', async () => {
        // Only the disposable admin's active session changes; no project data is written.
        await page.goto(cfg.origin + '/settings', { waitUntil: 'domcontentloaded' });
        const chip = page.locator('button.orgchip');
        const original = (await chip.locator('.who > b').innerText()).trim();
        await chip.click();
        const alternateButton = page.locator('.sheet form[action="/api/session/tenant"] button.ident').first();
        if (!(await alternateButton.count())) throw new Error('workspace_switch_fixture_missing');
        const alternate = (await alternateButton.locator('.nm > b').innerText()).trim();
        if (!original || !alternate || original === alternate)
          throw new Error('workspace_switch_fixture_missing');
        await alternateButton.click();
        await page.waitForFunction(expected =>
          document.querySelector('button.orgchip .who > b')?.textContent?.trim() === expected,
        alternate, { timeout: 15000 });
        if (new URL(page.url()).pathname !== '/settings')
          throw new Error('workspace_switch_not_confirmed');
        await layout();

        await page.locator('button.orgchip').click();
        const returnButton = page.locator('.sheet form[action="/api/session/tenant"] button.ident')
          .filter({ hasText: original }).first();
        if (!(await returnButton.count())) throw new Error('workspace_switch_revert_failed');
        await returnButton.click();
        await page.waitForFunction(expected =>
          document.querySelector('button.orgchip .who > b')?.textContent?.trim() === expected,
        original, { timeout: 15000 });
        if (new URL(page.url()).pathname !== '/settings')
          throw new Error('workspace_switch_revert_failed');
        await layout();
      });
      await step('unauthorized_workspace_switch_rejected', async () => {
        // This UUID is not a member workspace; a rejected POST must never switch tenants.
        const before = (await page.locator('button.orgchip .who > b').innerText()).trim();
        const res = await page.request.post(cfg.origin + '/api/session/tenant', {
          data: new URLSearchParams({
            tenantId: '00000000-0000-4000-8000-000000000000',
            returnTo: '/projects/00000000-0000-4000-8000-000000000000',
          }).toString(),
          headers: { origin: cfg.origin, 'content-type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0, timeout: 15000,
        });
        assertMutationRedirect(res.status(), res.headers()['location'], cfg.origin,
          { path: '/settings', key: 'switch', value: 'forbidden' });
        await page.reload({ waitUntil: 'domcontentloaded' });
        if ((await page.locator('button.orgchip .who > b').innerText()).trim() !== before)
          throw new Error('workspace_switch_not_confirmed');
        await layout();
      });
      await step('expired_onboarding_cookie_rejected', async () => {
        await context.clearCookies();
        const res = await mutation({ action: 'revoke', id: '00000000-0000-4000-8000-000000000000' });
        assertMutationRedirect(res.status(), res.headers()['location'], cfg.origin,
          { path: '/login', key: 'error', value: 'expired' });
      });
      await step('expired_workspace_switch_cookie_rejected', async () => {
        const res = await page.request.post(cfg.origin + '/api/session/tenant', {
          data: new URLSearchParams({ tenantId: '00000000-0000-4000-8000-000000000000',
            returnTo: '/settings' }).toString(),
          headers: { origin: cfg.origin, 'content-type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0, timeout: 15000,
        });
        assertMutationRedirect(res.status(), res.headers()['location'], cfg.origin,
          { path: '/login', key: 'error', value: 'expired' });
      });
      await step('expired_billing_mutations_rejected', async () => {
        // No real invoice or subscription is touched: cookies were cleared above.
        for (const path of ['/api/billing/checkout', '/api/billing/subscription']) {
          const res = await page.request.post(cfg.origin + path, {
            data: new URLSearchParams({ action: 'resume' }).toString(),
            headers: { origin: cfg.origin, 'content-type': 'application/x-www-form-urlencoded' },
            maxRedirects: 0, timeout: 15000,
          });
          assertMutationRedirect(res.status(), res.headers()['location'], cfg.origin,
            { path: '/login', key: 'error', value: 'expired' });
        }
      });
      await step('restricted_login_and_no_invitation_form', async () => {
        await login(cfg.restricted, process.env.EPMO_JOURNEY_RESTRICTED_PASSWORD);
        await page.goto(cfg.origin + '/settings', { waitUntil: 'domcontentloaded' });
        if (await page.locator('form[action="/api/onboarding"] input[name="action"][value="invite"]').count())
          throw new Error('restricted_invitation_access');
        await layout();
      });
      await step('restricted_onboarding_403', async () => {
        // Revoking a non-existent synthetic UUID cannot change a real invitation.
        const res = await mutation({ action: 'revoke', id: '00000000-0000-4000-8000-000000000000' });
        assertMutationRedirect(res.status(), res.headers()['location'], cfg.origin,
          { path: '/settings', key: 'onboarding', value: 'forbidden' });
      });
      await step('restricted_billing_redirect', async () => {
        await page.goto(cfg.origin + '/billing', { waitUntil: 'domcontentloaded' });
        if (new URL(page.url()).pathname !== '/') throw new Error('restricted_billing_access');
        await layout();
      });
    } finally {
      // Never save browser traces, storage state, cookies, credentials, or raw responses.
      await context.close();
    }
  }
} catch {
  report.failed++;
  report.variants.push({ variant: 'browser', checks: [{ name: 'launch', status: 'FAIL', code: 'browser_journey_failed' }] });
} finally {
  if (browser) await browser.close();
  await writeFile(join(cfg.out, 'customer-journey-report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
}
console.log('LOCAL synthetic customer journey: ' + report.passed + ' PASS, ' + report.failed + ' FAIL');
if (report.failed) process.exitCode = 1;
