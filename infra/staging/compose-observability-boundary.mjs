/**
 * S47: fail closed on executable healthcheck overrides and remote log drivers.
 * A Compose healthcheck runs inside the container with its environment, and a
 * remote logging driver can ship sensitive output off the approved staging host.
 * This pure check does not execute commands or inspect/print secret values.
 */
const names = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (a, b) => Array.isArray(a) && a.length === b.length &&
  a.every((value, index) => value === b[index]);
const knownHealthcheckKeys = new Set(['test', 'interval', 'timeout', 'start_period', 'retries']);

function reviewedHealthcheck(name, service) {
  const check = service.healthcheck;
  if (check === undefined) return true;
  if (!isObject(check) || Object.keys(check).some(key => !knownHealthcheckKeys.has(key))) return false;
  if (name === 'api' || name === 'web') return false;
  const tests = {
    postgres: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}'],
    'staging-edge': ['CMD-SHELL', 'wget -q -O /dev/null http://127.0.0.1:8080/edge-health'],
  };
  if (name === 'redis') {
    const password = service.command?.[2];
    return typeof password === 'string' && password.length > 0 &&
      exact(check.test, ['CMD', 'redis-cli', '--pass', password, 'ping']) &&
      check.interval === '10s' && check.retries === 12 &&
      check.timeout === undefined && check.start_period === undefined;
  }
  // Docker Compose's JSON config preserves escaped dollar signs in the
  // PostgreSQL probe on some versions. Both forms are fixed, reviewed argv;
  // do not accept arbitrary shell commands or substitutions.
  if (name === 'postgres') {
    const approved = [tests.postgres[1],
      'pg_isready -U ' + '$' + '{POSTGRES_USER} -d ' + '$' + '{POSTGRES_DB}'];
    if (!Array.isArray(check.test) || check.test.length !== 2 ||
        check.test[0] !== 'CMD-SHELL' || !approved.includes(check.test[1])) return false;
  } else if (!exact(check.test, tests[name])) return false;
  if (name === 'postgres') return check.interval === '10s' && check.retries === 12 &&
    check.timeout === undefined && check.start_period === undefined;
  return check.interval === '20s' && check.timeout === '4s' &&
    check.start_period === '15s' && check.retries === 3;
}

export function safeStagingObservabilityBoundary(services) {
  if (!isObject(services)) return false;
  return names.every(name => {
    const service = services[name];
    return isObject(service) && service.logging === undefined &&
      service.label_file === undefined && reviewedHealthcheck(name, service);
  });
}
