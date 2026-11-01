/**
 * S45: fail-closed, offline staging Compose secret/config injection boundary.
 * Compose secrets/configs can mount host files (including production keys) into
 * otherwise isolated containers without using the volumes field. Lifecycle
 * hooks and credential_spec likewise bypass the reviewed startup contract.
 * This is a pure predicate; it never reads or prints secret values.
 */
const requiredServices = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const absentOrEmpty = value => value === undefined ||
  (isObject(value) && Object.keys(value).length === 0);
const forbiddenServiceFields = [
  'secrets', 'configs', 'credential_spec', 'develop', 'extends',
  'post_start', 'pre_stop',
];

export function safeStagingSecretBoundary(config) {
  if (!isObject(config) || !isObject(config.services) ||
      !absentOrEmpty(config.secrets) || !absentOrEmpty(config.configs)) return false;
  return requiredServices.every(name => {
    const service = config.services[name];
    return isObject(service) && forbiddenServiceFields.every(field => service[field] === undefined);
  });
}
