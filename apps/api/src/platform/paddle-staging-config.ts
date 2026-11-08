/** Staging-only Paddle ingress preflight. No database writes or entitlements. */
export type StagingPaddleConfig = {
  environment: 'sandbox';
  webhookSecret: string;
  databaseHost: string;
};

/**
 * Independent staging kill switch. Never reuse the disposable CI writer,
 * and never silently turn a sandbox callback into a production billing event.
 * This is a pure configuration validator, not an enabled webhook adapter.
 */
export function requirePaddleSandboxStagingConfig(env: NodeJS.ProcessEnv): StagingPaddleConfig {
  const refuse = (): never => { throw new Error('Paddle staging ingress disabled or misconfigured'); };
  if (env.DEPLOYMENT_ENV !== 'staging' ||
      env.NODE_ENV !== 'production' ||
      env.PADDLE_ENV !== 'sandbox' ||
      env.PADDLE_ENABLED !== 'false' ||
      env.PADDLE_STAGING_WEBHOOK_ENABLED !== 'true' ||
      env.CI === 'true' || env.GITHUB_ACTIONS === 'true' ||
      env.PADDLE_LEDGER_WRITE_MODE ||
      env.PHASE15_ACCEPT_DISPOSABLE_DB)
    refuse();
  const secret = env.PADDLE_STAGING_WEBHOOK_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 ||
      secret === env.PADDLE_WEBHOOK_SECRET ||
      secret === env.PADDLE_LIVE_WEBHOOK_SECRET)
    refuse();
  let db: URL;
  try { db = new URL(env.DATABASE_URL ?? ''); } catch { return refuse(); }
  if (!['postgres:', 'postgresql:'].includes(db.protocol) ||
      !db.hostname || !db.username || !db.password ||
      !/staging|sandbox/i.test(db.hostname) ||
      !/staging|sandbox/i.test(db.pathname) ||
      db.hostname === 'localhost' || db.hostname === '127.0.0.1' ||
      db.search || db.hash)
    refuse();
  return {environment:'sandbox',webhookSecret:secret!,databaseHost:db.hostname};
}
