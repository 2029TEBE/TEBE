/**
 * S50: fail closed on unreviewed staging container environment injection.
 * A resolved Compose model can inject runtime flags, proxies or production
 * credentials without changing ports, networks, mounts or image tags.
 * This pure offline predicate inspects keys and fixed internal endpoints only;
 * it never logs or returns any environment value.
 */
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const allowed = {
  postgres: ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'],
  redis: [],
  api: [
    'NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'WEB_ORIGIN',
    'ALLOW_HEADER_AUTH', 'API_PORT', 'DEPLOYMENT_ENV',
    'BILLING_PROVIDER', 'PADDLE_ENABLED', 'PADDLE_ENV',
    'PADDLE_API_KEY', 'PADDLE_WEBHOOK_SECRET', 'PADDLE_WEBHOOK_PUBLIC_URL',
        'MAIL_TRANSPORT', 'MAIL_FROM', 'MAIL_REGION',
    'BILLING_REFERENCE_WEBHOOK_ENABLED', 'WEB_INTERNAL_URL',
    'BEDROCK_REGION', 'BEDROCK_MODEL_ID',
    'MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'MS_REDIRECT_URI',
    'MS_TOKEN_KEY', 'MS_AUTHORITY',
  ],
  web: ['NODE_ENV', 'API_URL', 'NEXT_PUBLIC_API_URL', 'WEB_ORIGIN', 'BILLING_PROVIDER'],
  'staging-edge': [],
};

function reviewedEnvironment(service, names) {
  if (!record(service)) return false;
  if (service.environment === undefined) return true;
  if (!record(service.environment)) return false;
  const permitted = new Set(names);
  return Object.entries(service.environment).every(([name, value]) =>
    permitted.has(name) && typeof value === 'string');
}

export function safeStagingEnvironmentBoundary(services) {
  if (!record(services)) return false;
  if (!Object.entries(allowed).every(([name, names]) =>
    reviewedEnvironment(services[name], names))) return false;
  const api = services.api.environment || {};
  const web = services.web.environment || {};
  // Do not let a syntactically valid external URL replace the private
  // app-to-app route while the public origins remain canonical.
  return (api.API_PORT === undefined || api.API_PORT === '4000') &&
    (api.WEB_INTERNAL_URL === undefined || api.WEB_INTERNAL_URL === 'http://web:3000') &&
    (web.API_URL === undefined || web.API_URL === 'http://api:4000') &&
    api.BILLING_PROVIDER === 'paddle' && api.PADDLE_ENABLED === 'false' &&
    api.PADDLE_ENV === 'sandbox' && web.BILLING_PROVIDER === 'paddle';
}
