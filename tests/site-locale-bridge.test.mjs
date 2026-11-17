import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../apps/web/src/components/UniversalLocaleSwitch.tsx', import.meta.url), 'utf8');
const server = readFileSync(new URL('../apps/web/src/lib/i18n.ts', import.meta.url), 'utf8');

test('server prioritizes site-wide language preference over legacy application cookie', () => {
  const shared = server.indexOf("jar.get('epmo_site_locale')");
  const appOnly = server.indexOf("jar.get('pmo_locale')");
  assert.ok(shared > -1 && appOnly > shared);
  assert.ok(server.slice(shared,appOnly).includes('normalizeFrontendLocale(shared)'));
});

test('new selections update both shared and legacy display-only locale cookies', () => {
  assert.ok(app.includes('persistSharedLocale(detected)'));
  assert.ok(app.includes('persistSharedLocale(next)'));
  assert.ok(app.includes('pmo_locale='));
  assert.ok(app.includes('pmo_lang='));
  assert.ok(app.includes('epmo_site_locale='));
});

test('production cross-subdomain preference is secure and restricted', () => {
  assert.ok(app.includes("window.location.hostname.toLowerCase() === 'app.theepmo.com'"));
  assert.ok(app.includes("window.location.protocol === 'https:'"));
  assert.ok(app.includes('; domain=theepmo.com; secure'));
  assert.ok(app.includes('samesite=lax'));
  assert.doesNotMatch(app,/document\.cookie\s*=\s*[`'"]pmo_session/);
});

test('the first dashboard visit respects a locale selected on the public site', () => {
  assert.match(app, /const hasPreference = document\.cookie\.split\(';\'\)\.some/);
  assert.match(app, /epmo_site_locale\|pmo_locale\|pmo_lang/);
  assert.match(app, /if \(hasPreference\) return;/);
  assert.ok(app.indexOf('if (hasPreference) return;') < app.indexOf('chooseFrontendLocale({ browserLanguages: languages })'));
});

test('all locale option names have screen-reader language and fallback English is tagged', () => {
  assert.match(app, /<option key=\{item.code\} value=\{item.code\} lang=\{item.code\}>/);
  assert.match(app, /<select id="epmo-header-locale" aria-label=\{label\} lang=\{locale === 'ar' \? 'ar' : 'en'\}/);
  assert.match(app, /className="dim" lang="en" aria-live="polite"/);
  assert.match(app, /className="sr-only" lang=\{locale === 'ar' \? 'ar' : 'en'\}/);
});
