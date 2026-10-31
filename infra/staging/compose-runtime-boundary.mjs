/**
 * S44: pure, offline guard against container privilege and namespace escape
 * in the final resolved synthetic staging Compose model. Never starts Docker.
 */
const names = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const forbiddenOverrides = [
  'pid', 'ipc', 'uts', 'cgroup', 'cgroupns_mode', 'userns_mode',
  'runtime', 'sysctls', 'group_add',
];
const exact = (values, expected) => Array.isArray(values) &&
  values.length === expected.length &&
  expected.every(value => values.filter(item => item === value).length === 1);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function safeStagingContainerRuntime(services) {
  if (!isObject(services)) return false;
  return names.every(name => {
    const service = services[name];
    if (!isObject(service) || forbiddenOverrides.some(field => service[field] !== undefined))
      return false;
    // The staging TLS edge needs only SETUID/SETGID to drop worker identity.
    // Any other added capability, including SYS_ADMIN or NET_ADMIN, is forbidden.
    if (service.cap_add !== undefined) {
      if (name !== 'staging-edge' || !exact(service.cap_add, ['SETUID', 'SETGID']) ||
          !exact(service.cap_drop, ['ALL']) ||
          !exact(service.security_opt, ['no-new-privileges:true']) ||
          service.read_only !== true) return false;
    }
    if (service.cap_drop !== undefined && !exact(service.cap_drop, ['ALL']))
      return false;
    if (service.security_opt !== undefined &&
        !exact(service.security_opt, ['no-new-privileges:true'])) return false;
    return true;
  });
}
