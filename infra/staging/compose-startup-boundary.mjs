/**
 * S46: reject unreviewed executable startup and base-image substitutions in
 * the final synthetic staging Compose model. Offline, no secrets printed.
 */
const names = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const fixedImages = {
  postgres: 'postgres:16-alpine',
  redis: 'redis:7-alpine',
  'staging-edge': 'nginx:1.28-alpine',
};
const forbidden = ['entrypoint', 'pull_policy', 'init', 'user', 'working_dir',
  'stdin_open', 'tty', 'profiles', 'isolation'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function safeStagingStartupBoundary(services) {
  if (!isObject(services)) return false;
  return names.every(name => {
    const service = services[name];
    if (!isObject(service) || forbidden.some(field => service[field] !== undefined)) return false;
    if (fixedImages[name] && service.image !== fixedImages[name]) return false;
    if (name !== 'api' && name !== 'web' && service.build !== undefined) return false;
    if (name !== 'redis') return service.command === undefined;
    // Production Compose uses argv form; shell commands and extra Redis
    // arguments could disable authentication or execute arbitrary startup code.
    const cmd = service.command;
    return Array.isArray(cmd) && cmd.length === 3 &&
      cmd[0] === 'redis-server' && cmd[1] === '--requirepass' &&
      typeof cmd[2] === 'string' && cmd[2].length > 0;
  });
}
