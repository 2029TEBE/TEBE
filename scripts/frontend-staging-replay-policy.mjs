/** Fail-closed operator preflight for an authorized, synthetic-only HTTPS replay. */
import { assertSyntheticUser, assertUatOutputDir } from './frontend-browser-uat-policy.mjs';

export const STAGING_WEB = 'https://staging.theepmo.com';
export const STAGING_API = 'https://api-staging.theepmo.com';
export const REPLAY_VARIANTS = Object.freeze([
  Object.freeze({ name: 'mobile-ar', width: 375, height: 812, lang: 'ar', dir: 'rtl' }),
  Object.freeze({ name: 'desktop-en', width: 1440, height: 900, lang: 'en', dir: 'ltr' }),
]);
const SHA = /^[a-f0-9]{40}$/;

export function stagingReplayConfiguration(env) {
  if (env.EPMO_STAGING_REPLAY_CONFIRM !== 'YES_AUTHORIZED_SYNTHETIC_HTTPS_STAGING')
    throw new Error('BLOCKED: explicit staging replay confirmation required');
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
    throw new Error('BLOCKED: TLS certificate verification must remain enabled');
  if (env.EPMO_STAGING_WEB_ORIGIN !== STAGING_WEB || env.EPMO_STAGING_API_ORIGIN !== STAGING_API)
    throw new Error('BLOCKED: only the two exact approved staging HTTPS origins are permitted');
  if (!SHA.test(env.EPMO_STAGING_EXACT_SHA || ''))
    throw new Error('BLOCKED: exact immutable integration SHA required');
  const admin = assertSyntheticUser(env.EPMO_STAGING_ADMIN_USER);
  const restricted = assertSyntheticUser(env.EPMO_STAGING_RESTRICTED_USER);
  if (admin.toLowerCase() === restricted.toLowerCase())
    throw new Error('BLOCKED: two distinct disposable identities required');
  if (!env.EPMO_STAGING_ADMIN_PASSWORD || !env.EPMO_STAGING_RESTRICTED_PASSWORD)
    throw new Error('BLOCKED: disposable identity passwords required');
  return {
    web: STAGING_WEB, api: STAGING_API, sha: env.EPMO_STAGING_EXACT_SHA,
    out: assertUatOutputDir(env.EPMO_STAGING_UAT_OUT || '/tmp/epmo-staging-frontend-replay'),
    admin, restricted,
  };
}

export function assertStagingBrowserRequest(input) {
  let url;
  try { url = new URL(input); } catch { return false; }
  // blob: inherits its creator origin. Never permit blob:https://other-host.
  if (url.protocol === 'blob:') return url.origin === STAGING_WEB || url.origin === STAGING_API;
  if (url.protocol === 'data:') return true;
  return [STAGING_WEB, STAGING_API].includes(url.origin) && url.protocol === 'https:';
}

export function sanitizedStagingCheck(name, passed, code = 'assertion_failed') {
  if (!/^[a-z][a-z0-9_]{2,75}$/.test(name)) throw new Error('Invalid fixed check label');
  return { name, status: passed ? 'PASS' : 'FAIL', ...(!passed ? { code } : {}) };
}
