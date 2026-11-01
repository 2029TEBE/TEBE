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
import { validInvitationToken } from '../apps/web/src/lib/invitation-feedback.mjs';

const cfg = journeyConfiguration(process.env);
await mkdir(cfg.out, { recursive: true, mode: 0o700 });
const report = { scope: 'LOCAL_DISPOSABLE_SYNTHETIC_ONLY_NOT_STAGING_ACCEPTANCE', variants: [], passed: 0, failed: 0 };
const known = new Set([
  'locale_direction_failed', 'missing_heading', 'horizontal_overflow',
  'missing_invitation_error', 'missing_recovery_error', 'fragment_not_scrubbed',
  'authentication_failed', 'missing_admin_invitation_form', 'missing_billing_screen',
  'restricted_billing_access', 'restricted_invitation_access', 'keyboard_focus_failed', 'logout_session_still_valid', 'mutation_not_rejected',
  'unsafe_mutation_redirect', 'unexpected_mutation_feedback', 'unexpected_auth_redirect',
  'workspace_switch_fixture_missing', 'workspace_switch_not_confirmed',
  'workspace_switch_revert_failed', 'invitation_false_success',
  'recovery_request_replayed', 'recovery_rate_limit_not_explained',
  'billing_return_false_confirmation', 'onboarding_return_false_confirmation', 'recovery_false_success', 'reset_false_success',
]);
const fakeToken = '00000000-0000-4000-8000-000000000000.' + 'A'.repeat(43);
// Use a syntactically valid, deliberately nonexistent tenant UUID. A version-0
// UUID made both invitation negatives fail before any request was exercised.
if (!validInvitationToken(fakeToken)) throw new Error('Invalid synthetic invitation fixture');
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
    // Fixed, allowlisted response diagnostics only. Never store URLs, bodies,
    // headers, tokens, user IDs or credentials in acceptance artifacts.
    const responsePaths = new Set([
      '/api/session', '/api/password-recovery/request',
      '/api/password-recovery/reset', '/api/invite/accept',
      '/api/onboarding', '/api/session/tenant', '/api/session/logout',
    ]);
    let recentResponses = [];
    let clientExceptionCount = 0;
    page.on('response', response => {
      let path;
      try { path = new URL(response.url()).pathname; } catch { return; }
      if (!responsePaths.has(path)) return;
      recentResponses.push({ path, status: response.status() });
      recentResponses = recentResponses.slice(-8);
    });
    page.on('pageerror', () => { clientExceptionCount = Math.min(20, clientExceptionCount + 1); });
    page.on('dialog', dialog => { void dialog.dismiss(); });
    const result = { variant: variant.name, checks: [] };
    report.variants.push(result);
    // Only fixed proof-phase labels are recorded; no URLs, credentials or DOM text.
    let proofPhase = 'none';
    async function step(name, run) {
      proofPhase = 'none';
      recentResponses = [];
      const exceptionsBefore = clientExceptionCount;
      try {
        await run();
        // Fixed-name screenshots only; never record authenticated traces or secrets.
        const capture = new Set([
          'expired_login_bilingual', 'recovery_503_no_success',
          'recovery_429_singleflight_no_success',
          'invitation_403_no_acceptance', 'invitation_html_200_rejected', 'admin_login_and_onboarding',
          'admin_subscription_read', 'billing_return_not_proof', 'admin_workspace_switch_round_trip',
          'restricted_login_and_no_invitation_form',
          'restricted_billing_redirect', 'onboarding_return_not_proof', 'logout_revokes_session',
        ]);
        const screenshot = capture.has(name) ? variant.name + '-' + name + '.png' : undefined;
        if (screenshot) await page.screenshot({
          path: join(cfg.out, screenshot), fullPage: true, animations: 'disabled',
          // The accounts are disposable .test fixtures, but still mask visible
          // identifiers and any form values. Never record storage state/traces.
          mask: [page.locator('input[type="email"], input[type="password"], td:has-text("@"), .sheet header, .who em')],
          maskColor: '#808080',
        });
        result.checks.push({ name, status: 'PASS', ...(screenshot ? { screenshot } : {}) });
        report.passed++;
      } catch (error) {
        // Sanitize Playwright errors: raw messages can contain URLs, selectors,
        // tokens or request payloads. Record only a fixed diagnostic category.
        const detail = typeof error?.message === 'string' ? error.message : '';
        const code = known.has(detail) ? detail
          : /screenshot/i.test(detail) ? 'screenshot_failed'
          : /Timeout|waiting for/i.test(detail) ? 'browser_timeout'
          : /net::ERR_|ERR_CONNECTION/i.test(detail) ? 'browser_network_failed'
          : /locator|selector|strict mode/i.test(detail) ? 'browser_locator_failed'
          : 'browser_journey_failed';
        // Sanitized route path and bounded layout geometry make a failed
        // synthetic run actionable without exposing tokens or account data.
        let routePath = '/unknown';
        try { routePath = new URL(page.url()).pathname; } catch { /* no URL */ }
        // A failed browser scenario without a sanitized DOM/API diagnostic
        // cannot distinguish a missing form, a 401, a hydration crash or a
        // wrong redirect. Record only counts, booleans and allowlisted paths.
        let ui = null;
        try {
          ui = await page.evaluate(() => ({
            readyState: ['loading', 'interactive', 'complete'].includes(document.readyState)
              ? document.readyState : 'unknown',
            alertCount: document.querySelectorAll('[role="alert"]').length,
            statusCount: document.querySelectorAll('[role="status"]').length,
            formCount: document.querySelectorAll('form').length,
            submitCount: document.querySelectorAll('button[type="submit"]').length,
            hasLoginForm: !!document.querySelector('form[action="/api/session"]'),
            hasAppShell: !!document.querySelector('.shell'),
          }));
        } catch { /* browser may already be closed */ }
        let sessionCookiePresent = null;
        try {
          sessionCookiePresent = (await context.cookies(cfg.origin))
            .some(cookie => cookie.name === 'pmo_session');
        } catch { /* browser may already be closed */ }
        let screenshot;
        // Failure screenshots are limited to PUBLIC routes, and all editable
        // values are masked. No authenticated page or bearer trace is saved.
        if (new Set(['/login', '/forgot-password', '/reset-password', '/accept-invite']).has(routePath)) {
          try {
            screenshot = variant.name + '-' + name + '-failed.png';
            await page.screenshot({
              path: join(cfg.out, screenshot), fullPage: true,
              animations: 'disabled',
              mask: [page.locator('input, textarea, select, [contenteditable="true"]')],
              maskColor: '#808080',
            });
          } catch { screenshot = undefined; }
        }
        result.checks.push({ name, status: 'FAIL', code, routePath,
          diagnostic: { errorType: ['Error', 'TimeoutError', 'TypeError'].includes(error?.name)
            ? error.name : 'other', ui, sessionCookiePresent,
            clientExceptions: clientExceptionCount - exceptionsBefore,
            phase: proofPhase,
            responses: recentResponses.slice(-8) },
          ...(screenshot ? { screenshot } : {}),
          ...(code === 'horizontal_overflow' && overflowEvidence
            ? { layout: overflowEvidence } : {}) });
        overflowEvidence = null;
        report.failed++;
      } finally {
        // A failed scenario must not leak interception into the next one.
        // Wait for outstanding handlers and suppress their late abort errors;
        // the scenario itself still records FAIL if its response was missing.
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      }
    }
    let overflowEvidence = null;
    async function layout() {
      const state = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        // Allowlisted CSS classes only: no DOM text, identifiers, hrefs, input
        // values, cookies, request bodies or credential-bearing traces.
        const allowed = new Set(['shell', 'topbar', 'page', 'panel', 'modgrid',
          'tiles', 'rail', 'drawer', 'sheet', 'scrollx', 'authwrap',
          'authpanel', 'switcher', 'brand', 'who']);
        const elements = Array.from(document.body.querySelectorAll('*'))
          .map(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0 ||
                (rect.right <= viewport + 2 && rect.left >= -2)) return null;
            return {
              tag: el.tagName.toLowerCase(),
              classes: Array.from(el.classList).filter(name => allowed.has(name)).slice(0, 2),
              excessPx: Math.ceil(Math.max(0, rect.right - viewport, -rect.left)),
            };
          }).filter(Boolean).sort((a, b) => b.excessPx - a.excessPx).slice(0, 6);
        return {
          lang: document.documentElement.lang, dir: document.documentElement.dir,
          heading: !!document.querySelector('h1'),
          scrollWidth: document.documentElement.scrollWidth,
          viewport, elements,
        };
      });
      overflowEvidence = state.scrollWidth > variant.width + 2
        ? { scrollWidth: state.scrollWidth, viewport: state.viewport, elements: state.elements }
        : null;
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
      // A 303 alone is not an authenticated browser session. The production
      // standalone server must issue a Secure, HttpOnly cookie even in this
      // disposable localhost-only browser proof. Never log the cookie value.
      const sessionCookies = await context.cookies(cfg.origin);
      if (!sessionCookies.some(cookie => cookie.name === 'pmo_session' &&
        cookie.secure && cookie.httpOnly)) throw new Error('authentication_failed');
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
      await step('login_invalid_credentials_401_rejected', async () => {
        // Disposable, deliberately nonexistent identity; no customer or provider account.
        // A 401 must produce a local invalid-credentials redirect, never an authenticated session.
        const res = await page.request.post(cfg.origin + '/api/session', {
          data: new URLSearchParams({
            identifier: 'nonexistent-f52-login@example.test',
            password: 'F52SyntheticInvalidOnly!',
          }).toString(),
          headers: { origin: cfg.origin, 'content-type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0, timeout: 15000,
        });
        assertMutationRedirect(res.status(), res.headers()['location'], cfg.origin,
          { path: '/login', key: 'error', value: 'invalid' });
        await page.goto(cfg.origin + '/login?error=invalid', { waitUntil: 'commit' });
        const alert = page.getByRole('alert').filter({ hasText: variant.lang === 'ar' ? 'غير صحيح' : 'not recognised' });
        await alert.waitFor({ state: 'visible', timeout: 15000 });
        const message = await alert.innerText();
        if (!(variant.lang === 'ar' ? message.includes('غير صحيح') :
          message.includes('not recognised'))) throw new Error('authentication_failed');
        if (await page.locator('button.orgchip').count()) throw new Error('authentication_failed');
        await layout();
      });
      await step('recovery_503_no_success', async () => {
        // Prove the intercepted 503 and its exact localized failure feedback.
        // A generic unrelated alert or a late screenshot is not acceptance.
        await page.route('**/api/password-recovery/request', route => route.fulfill({
          status: 503, contentType: 'application/json', body: '{}',
        }));
        try {
          proofPhase = 'recovery_503_navigation';
          await page.goto(cfg.origin + '/forgot-password', { waitUntil: 'networkidle' });
          await page.locator('input[type="email"]').fill('journey-recovery@example.test');
          const response503 = page.waitForResponse(response => {
            try {
              return new URL(response.url()).pathname === '/api/password-recovery/request' &&
                response.status() === 503;
            } catch { return false; }
          }, { timeout: 20000 });
          proofPhase = 'recovery_503_submit';
          await page.locator('button[type="submit"]').click();
          await response503;
          proofPhase = 'recovery_503_feedback';
          await page.getByRole('alert').filter({
            hasText: variant.lang === 'ar'
              ? 'تعذّر تأكيد طلب الاستعادة بسبب عدم توفر الخدمة'
              : 'could not be confirmed because the service is unavailable',
          }).waitFor({ state: 'visible', timeout: 20000 });
          if (await page.getByRole('status').count()) throw new Error('missing_recovery_error');
          proofPhase = 'recovery_503_layout';
          await layout();
        } finally { await page.unroute('**/api/password-recovery/request'); }
      });
      await step('recovery_429_singleflight_no_success', async () => {
        // Synthetic rate limit: rapid repeated submits must create one request,
        // show localized guidance, and never claim a recovery email was sent.
        let requests = 0;
        let interceptionFailed = false;
        await page.route('**/api/password-recovery/request', async route => {
          requests++;
          await new Promise(resolve => setTimeout(resolve, 200));
          try {
            await route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
          } catch {
            // Navigations may cancel a pending route. Do not crash Node with
            // an unhandled Playwright rejection or count a canceled 429 as PASS.
            interceptionFailed = true;
          }
        });
        proofPhase = 'recovery_navigation';
        await page.goto(cfg.origin + '/forgot-password', { waitUntil: 'networkidle' });
        proofPhase = 'recovery_fill';
        await page.locator('input[type="email"]').fill('journey-recovery@example.test');
        proofPhase = 'recovery_double_submit';
        await page.locator('form.authform').evaluate(form => {
          form.requestSubmit();
          form.requestSubmit();
        });
        // A real 429 alert is observable in the masked browser evidence. Use
        // Playwright's visible text locator rather than an independent polling
        // expression, while retaining the one-request and no-success checks.
        proofPhase = 'recovery_alert_visible';
        await page.getByRole('alert').filter({
          hasText: variant.lang === 'ar' ? 'محاولات كثيرة' : 'Too many recovery requests',
        }).waitFor({ state: 'visible', timeout: 20000 });
        proofPhase = 'recovery_singleflight';
        if (requests !== 1 || interceptionFailed) throw new Error('recovery_request_replayed');
        if (await page.getByRole('status').count()) throw new Error('missing_recovery_error');
        // The visible localized alert above already proves the exact guidance.
        // Re-reading it through an unfiltered locator races React rerenders.
        proofPhase = 'recovery_layout';
        await layout();
        proofPhase = 'recovery_unroute';
        await page.unroute('**/api/password-recovery/request');
      });
      await step('recovery_200_html_not_confirmed', async () => {
        // Intermediary HTML with 200 must not claim an email was sent.
        await page.route('**/api/password-recovery/request', route => route.fulfill({
          status: 200, contentType: 'text/html', body: '<html><body>Sign in</body></html>',
        }));
        try {
          await page.goto(cfg.origin + '/forgot-password', { waitUntil: 'networkidle' });
          await page.locator('input[type="email"]').fill('journey-recovery@example.test');
          await page.locator('button[type="submit"]').click();
          const alert = page.getByRole('alert').filter({ hasText: variant.lang === 'ar' ? 'تعذّر تأكيد طلب الاستعادة' : 'could not be confirmed' });
          await alert.waitFor({ state: 'visible', timeout: 15000 });
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
          await page.goto(cfg.origin + '/reset-password#token=' + 'A'.repeat(43), { waitUntil: 'networkidle' });
          await page.locator('input[type="password"]').first().fill('SyntheticOnly123!');
          await page.locator('input[type="password"]').nth(1).fill('SyntheticOnly123!');
          if (new URL(page.url()).hash) throw new Error('fragment_not_scrubbed');
          await page.locator('button[type="submit"]').click();
          const alert = page.getByRole('alert').filter({ hasText: variant.lang === 'ar' ? 'لم نتمكن من تأكيد' : 'could not be confirmed' });
          await alert.waitFor({ state: 'visible', timeout: 15000 });
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
          await page.goto(cfg.origin + '/reset-password#token=' + 'B'.repeat(43), { waitUntil: 'networkidle' });
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
        await page.goto(cfg.origin + '/accept-invite#token=' + fakeToken, { waitUntil: 'networkidle' });
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
          await page.goto(cfg.origin + '/accept-invite#token=' + fakeToken, { waitUntil: 'networkidle' });
          await page.locator('button[type="submit"]').click();
          const alert = page.getByRole('alert').filter({ hasText: variant.lang === 'ar' ? 'لم نتمكن من تأكيد' : 'could not be confirmed' });
          await alert.waitFor({ state: 'visible', timeout: 15000 });
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
        // The invitation action is a type="hidden" input. Playwright's default
        // visible wait always times out even when the real admin form exists.
        await page.locator('form[action="/api/onboarding"] input[name="action"][value="invite"]')
          .waitFor({ state: 'attached', timeout: 15000 });
        await page.locator('form[action="/api/onboarding"] button[type="submit"]').first()
          .waitFor({ state: 'visible', timeout: 15000 });
        await layout();
      });
      await step('keyboard_navigation_focus_and_escape', async () => {
        // Verify real keyboard focus management in both responsive layouts.
        // No mutations, no credentials, and no synthetic provider shortcuts.
        const mobile = variant.width === 375;
        const trigger = page.locator(mobile ? 'button.burger' : 'button.orgchip');
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.locator(mobile ? '#mobile-navigation' : '.sheet[role="dialog"]');
        await dialog.waitFor({ state: 'visible' });
        await page.keyboard.press('Tab');
        const trapped = await page.evaluate(mobile => {
          const active = document.activeElement;
          return !!active?.closest(mobile ? '#mobile-navigation' : '.sheet[role="dialog"]');
        }, mobile);
        if (!trapped) throw new Error('keyboard_focus_failed');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        if (!(await trigger.evaluate(el => document.activeElement === el)))
          throw new Error('keyboard_focus_failed');
        await layout();
      });
      await step('onboarding_return_not_proof', async () => {
        // A forged ?done=invite URL must never claim that an email was sent.
        // This check is read-only and cannot create or revoke an invitation.
        await page.goto(cfg.origin + '/settings?done=invite', { waitUntil: 'domcontentloaded' });
        const notices = await page.getByRole('status').allTextContents();
        if (!notices.some(message => message.includes(variant.lang === 'ar' ?
          'لا يؤكد هذا الرابط' : 'this URL does not confirm')) ||
          notices.some(message => /Created:|تم الإنشاء/.test(message)))
          throw new Error('onboarding_return_false_confirmation');
        await layout();
      });
      await step('admin_subscription_read', async () => {
        // Next.js streams the authenticated subscription loader. DOMContentLoaded
        // can precede the actual billing panel; wait for the settled navigation
        // and prove that a real subscription card rendered (not merely a heading).
        proofPhase = 'billing_navigation';
        await page.goto(cfg.origin + '/billing', { waitUntil: 'networkidle' });
        proofPhase = 'billing_heading';
        await page.getByRole('heading', { level: 1, name: variant.lang === 'ar' ? 'الاشتراك والفوترة' : 'Subscription and billing' })
          .waitFor({ state: 'visible', timeout: 30000 });
        proofPhase = 'billing_route';
        if (new URL(page.url()).pathname !== '/billing') throw new Error('missing_billing_screen');
        proofPhase = 'billing_panel';
        const subscriptionPanel = page.locator('section[aria-label="Current subscription"], section[aria-label="الاشتراك الحالي"]');
        await subscriptionPanel.waitFor({ state: 'visible', timeout: 30000 });
        // Do not accept a generic heading, empty/loading panel, or 401/403
        // failure as proof of subscription visibility.
        proofPhase = 'billing_card';
        await subscriptionPanel.locator('.modcard strong').first().waitFor({ state: 'visible', timeout: 30000 });
        proofPhase = 'billing_panels_complete';
        // The billing screen has four independent server-loaded sections.
        // Prove plans, invoices and exceptions have *settled successfully*,
        // not merely that the subscription card rendered. A persistent 401,
        // 403, service error or missing section must fail the journey.
        // A global notification unrelated to these panels is not a billing
        // loader failure; scope checks to the actual billing data surfaces.
        await page.waitForFunction(() => {
          const names = new Set([
            'Available plans', 'الخطط المتاحة',
            'Renewal invoices', 'فواتير التجديد',
            'Payment exceptions', 'استثناءات المدفوعات',
          ]);
          const sections = Array.from(document.querySelectorAll('section[aria-label]'))
            .filter(section => names.has(section.getAttribute('aria-label')));
          return sections.length === 3 && sections.every(section =>
            !section.querySelector('[role="alert"], .locked') &&
            !!section.querySelector('.modcard, .panel'));
        }, undefined, { timeout: 30000 });
        if (await page.locator('p.err[role="alert"]').count())
          throw new Error('missing_billing_screen');
        proofPhase = 'billing_layout';
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
        proofPhase = 'workspace_first_layout';
        await page.waitForLoadState('load');
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
        proofPhase = 'workspace_return_layout';
        await page.waitForLoadState('load');
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
        await page.waitForURL(url => url.origin === cfg.origin && url.pathname === '/', { timeout: 15000 });
        if (new URL(page.url()).pathname !== '/') throw new Error('restricted_billing_access');
        await layout();
      });
      await step('logout_revokes_session', async () => {
        // Use the real logout POST and then revisit a private route. A local
        // redirect alone is not proof that the authenticated cookie was revoked.
        await page.locator('button.orgchip').click();
        await page.locator('form[action="/api/session/logout"] button').click();
        await page.waitForURL(url => url.origin === cfg.origin && url.pathname === '/login', { timeout: 15000 });
        await page.goto(cfg.origin + '/settings', { waitUntil: 'domcontentloaded' });
        if (new URL(page.url()).pathname !== '/login' ||
            !(await page.locator('form[action="/api/session"] input[name="password"]').count()) ||
            await page.locator('button.orgchip').count())
          throw new Error('logout_session_still_valid');
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
