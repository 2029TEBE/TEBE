#!/usr/bin/env node
/**
 * F63: staging-only operator replay. NEVER run against production or customer data.
 * Real HTTPS browser/network; no intercepted responses, no mocked provider calls,
 * no authenticated screenshots, no trace/storage-state/cookie/token artifacts.
 * Positive invitation, delivered recovery/reset and deployed-SHA attestation
 * remain explicit BLOCKED items until independently executed and reviewed.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stagingReplayConfiguration, assertStagingBrowserRequest, REPLAY_VARIANTS } from './frontend-staging-replay-policy.mjs';
import { assertJourneyLayout, assertMutationRedirect } from './frontend-customer-journey-policy.mjs';

// Fail before any network request or browser launch if authorization is absent.
const cfg = stagingReplayConfiguration(process.env);
await mkdir(cfg.out, { recursive: true, mode: 0o700 });
const report = {
  scope: 'AUTHORIZED_STAGING_REAL_HTTPS_NOT_PROVIDER_OR_RELEASE_ACCEPTANCE',
  exactSourceSha: cfg.sha, deploymentShaIndependentlyVerified: false,
  responseInterception: false, credentialArtifacts: false,
  accepted: false, variants: [], passed: 0, failed: 0, blocked: 0,
  externalRequirements: [
    'BLOCKED_EXTERNAL_INPUT: independent deployed-image SHA attestation',
    'BLOCKED_EXTERNAL_INPUT: disposable invitation and mailbox delivery receipt',
    'BLOCKED_EXTERNAL_INPUT: disposable password-recovery delivery and reset receipt',
    'BLOCKED_EXTERNAL_INPUT: actual expired-session fixture and reviewer receipt',
  ],
};
const blocked = (name, reason) => {
  report.blocked++;
  report.variants.push({ variant: 'external-prerequisites', checks: [{ name, status: 'BLOCKED', code: reason }] });
};
let browser;
try {
  // Node's fetch verifies certificate chains; redirects cannot silently change origin.
  for (const [name, url] of [['web', cfg.web + '/login'], ['api', cfg.api + '/health']]) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    if (response.status !== 200) throw new Error('staging_https_preflight_failed');
    if (!assertStagingBrowserRequest(response.url)) throw new Error('staging_origin_escape');
    console.log('Staging ' + name + ' TLS/HTTP preflight: PASS');
  }
  browser = await chromium.launch({ headless: true });
  for (const variant of REPLAY_VARIANTS) {
    const context = await browser.newContext({
      viewport: { width: variant.width, height: variant.height },
      locale: variant.lang === 'ar' ? 'ar-SA' : 'en-GB',
      reducedMotion: 'reduce', deviceScaleFactor: 1,
      ignoreHTTPSErrors: false,
    });
    // Block external origins rather than following OAuth, payment, telemetry,
    // or attacker-controlled redirects. This suite never initiates provider consent.
    await context.route('**/*', route => assertStagingBrowserRequest(route.request().url())
      ? route.continue() : route.abort());
    await context.addCookies([{ name: 'pmo_lang', value: variant.lang, url: cfg.web, secure: true }]);
    const page = await context.newPage();
    const result = { variant: variant.name, checks: [] };
    report.variants.push(result);
    const step = async (name, fn) => {
      try {
        await fn();
        result.checks.push({ name, status: 'PASS' });
        report.passed++;
      } catch {
        // Do not serialize raw Playwright errors, page URLs, user IDs, tokens,
        // response bodies, request headers, or credential-bearing traces.
        result.checks.push({ name, status: 'FAIL', code: 'assertion_or_network_failed' });
        report.failed++;
      }
    };
    const layout = async () => {
      const state = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        heading: !!document.querySelector('h1'),
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assertJourneyLayout(state, variant);
    };
    const login = async (user, password) => {
      await context.clearCookies();
      await context.addCookies([{ name: 'pmo_lang', value: variant.lang, url: cfg.web, secure: true }]);
      await page.goto(cfg.web + '/login', { waitUntil: 'domcontentloaded' });
      await page.locator('input[name="identifier"]').fill(user);
      await page.locator('input[name="password"]').fill(password);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(url => url.origin === cfg.web && url.pathname === '/', { timeout: 20000 });
      const cookies = await context.cookies(cfg.web);
      if (!cookies.some(c => c.name === 'pmo_session' && c.secure && c.httpOnly))
        throw new Error('no_secure_session');
    };
    const post = async (path, fields) => page.request.post(cfg.web + path, {
      data: new URLSearchParams(fields).toString(),
      headers: { origin: cfg.web, 'content-type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0, timeout: 15000,
    });
    try {
      await step('public_login_and_locale', async () => {
        await page.goto(cfg.web + '/login', { waitUntil: 'domcontentloaded' });
        await page.locator('form[action="/api/session"]').waitFor();
        await layout();
        // Only the public, unfilled login page is captured. Mask every editable
        // element; authenticated pages are never screenshot or traced.
        await page.screenshot({
          path: join(cfg.out, variant.name + '-public-login-masked.png'),
          animations: 'disabled', fullPage: true,
          mask: [page.locator('input,textarea,select,[contenteditable="true"]')],
          maskColor: '#808080',
        });
      });
      await step('public_recovery_form', async () => {
        await page.goto(cfg.web + '/forgot-password', { waitUntil: 'domcontentloaded' });
        await page.locator('input[type="email"]').waitFor();
        await layout();
      });
      await step('public_invitation_form', async () => {
        await page.goto(cfg.web + '/accept-invite', { waitUntil: 'domcontentloaded' });
        await layout();
      });
      await step('invalid_login_denied', async () => {
        const res = await post('/api/session', {
          identifier: 'nonexistent-f63-login@disposable.test', password: 'F63InvalidSyntheticOnly!',
        });
        assertMutationRedirect(res.status(), res.headers()['location'], cfg.web,
          { path: '/login', key: 'error', value: 'invalid' });
      });
      await step('admin_login_and_onboarding', async () => {
        await login(cfg.admin, process.env.EPMO_STAGING_ADMIN_PASSWORD);
        await page.goto(cfg.web + '/settings', { waitUntil: 'domcontentloaded' });
        await page.locator('form[action="/api/onboarding"] input[name="action"][value="invite"]')
          .waitFor({ state: 'attached' });
        await page.locator('form[action="/api/onboarding"] button[type="submit"]')
          .first().waitFor({ state: 'visible' });
        await layout();
      });
      await step('keyboard_navigation_and_escape', async () => {
        const mobile = variant.width === 375;
        const trigger = page.locator(mobile ? 'button.burger' : 'button.orgchip');
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.locator(mobile ? '#mobile-navigation' : '.sheet[role="dialog"]');
        await dialog.waitFor({ state: 'visible' });
        await page.keyboard.press('Tab');
        if (!await page.evaluate(mobile => !!document.activeElement?.closest(
          mobile ? '#mobile-navigation' : '.sheet[role="dialog"]'), mobile))
          throw new Error('focus_escape');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        if (!await trigger.evaluate(el => document.activeElement === el))
          throw new Error('focus_return');
        await layout();
      });
      await step('admin_subscription_visibility', async () => {
        await page.goto(cfg.web + '/billing', { waitUntil: 'networkidle' });
        if (new URL(page.url()).pathname !== '/billing') throw new Error('billing_redirect');
        const panel = page.locator('section[aria-label="Current subscription"], section[aria-label="الاشتراك الحالي"]');
        await panel.locator('.modcard strong').first().waitFor({ state: 'visible', timeout: 30000 });
        await page.waitForFunction(() => {
          const names = new Set(['Available plans', 'الخطط المتاحة', 'Renewal invoices', 'فواتير التجديد', 'Payment exceptions', 'استثناءات المدفوعات']);
          const sections = Array.from(document.querySelectorAll('section[aria-label]'))
            .filter(section => names.has(section.getAttribute('aria-label')));
          return sections.length === 3 && sections.every(section =>
            !section.querySelector('[role="alert"], .locked') &&
            !!section.querySelector('.modcard, .panel'));
        }, undefined, { timeout: 30000 });
        await layout();
      });
      await step('workspace_round_trip', async () => {
        await page.goto(cfg.web + '/settings', { waitUntil: 'domcontentloaded' });
        const chip = page.locator('button.orgchip');
        const original = (await chip.locator('.who > b').innerText()).trim();
        await chip.click();
        const alternate = page.locator('.sheet form[action="/api/session/tenant"] button.ident').first();
        const other = (await alternate.locator('.nm > b').innerText()).trim();
        if (!original || !other || original === other) throw new Error('missing_second_workspace');
        await alternate.click();
        await page.waitForFunction(expected => document.querySelector('button.orgchip .who > b')?.textContent?.trim() === expected, other);
        await page.locator('button.orgchip').click();
        await page.locator('.sheet form[action="/api/session/tenant"] button.ident')
          .filter({ hasText: original }).first().click();
        await page.waitForFunction(expected => document.querySelector('button.orgchip .who > b')?.textContent?.trim() === expected, original);
        await layout();
      });
      await step('cross_workspace_denied', async () => {
        const res = await post('/api/session/tenant', {
          tenantId: '00000000-0000-4000-8000-000000000000', returnTo: '/settings',
        });
        assertMutationRedirect(res.status(), res.headers()['location'], cfg.web,
          { path: '/settings', key: 'switch', value: 'forbidden' });
      });
      await step('missing_session_denied', async () => {
        await context.clearCookies();
        await page.goto(cfg.web + '/settings', { waitUntil: 'domcontentloaded' });
        if (new URL(page.url()).pathname !== '/login') throw new Error('session_not_denied');
        const res = await post('/api/session/tenant', {
          tenantId: '00000000-0000-4000-8000-000000000000', returnTo: '/settings',
        });
        assertMutationRedirect(res.status(), res.headers()['location'], cfg.web,
          { path: '/login', key: 'error', value: 'expired' });
      });
      await step('restricted_login_and_invitation_denial', async () => {
        await login(cfg.restricted, process.env.EPMO_STAGING_RESTRICTED_PASSWORD);
        await page.goto(cfg.web + '/settings', { waitUntil: 'domcontentloaded' });
        if (await page.locator('form[action="/api/onboarding"] input[name="action"][value="invite"]').count())
          throw new Error('restricted_invite_visible');
        await layout();
      });
      await step('restricted_onboarding_403', async () => {
        const res = await post('/api/onboarding', {
          action: 'revoke', id: '00000000-0000-4000-8000-000000000000',
        });
        assertMutationRedirect(res.status(), res.headers()['location'], cfg.web,
          { path: '/settings', key: 'onboarding', value: 'forbidden' });
      });
      await step('restricted_billing_denial', async () => {
        await page.goto(cfg.web + '/billing', { waitUntil: 'domcontentloaded' });
        await page.waitForURL(url => url.origin === cfg.web && url.pathname === '/', { timeout: 15000 });
        await layout();
      });
      await step('logout_revokes_session', async () => {
        await page.locator('button.orgchip').click();
        await page.locator('form[action="/api/session/logout"] button').click();
        await page.waitForURL(url => url.origin === cfg.web && url.pathname === '/login', { timeout: 15000 });
        await page.goto(cfg.web + '/settings', { waitUntil: 'domcontentloaded' });
        if (new URL(page.url()).pathname !== '/login') throw new Error('logout_not_revoked');
        await layout();
      });
    } finally {
      await context.close();
    }
  }
} catch {
  report.failed++;
  report.variants.push({ variant: 'preflight_or_browser', checks: [{ name: 'staging_preflight', status: 'FAIL', code: 'assertion_or_network_failed' }] });
} finally {
  if (browser) await browser.close();
  for (const name of ['deployed_sha_attestation', 'invitation_mailbox_acceptance', 'recovery_mailbox_reset', 'actual_expired_session'])
    blocked(name, 'BLOCKED_EXTERNAL_INPUT');
  await writeFile(join(cfg.out, 'staging-frontend-replay.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
}
console.log('STAGING REAL HTTPS (not release acceptance): ' + report.passed + ' PASS, ' + report.failed + ' FAIL, ' + report.blocked + ' BLOCKED');
if (report.failed) process.exitCode = 1;
else if (report.blocked) process.exitCode = 2;
