/**
 * S48: reject named-volume and network driver options that can silently bind
 * synthetic staging resources to production host paths or external networks.
 * Pure offline check; never starts Docker, reads secrets or changes DNS.
 */
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const noOptions = value => value === undefined || value === null ||
  (record(value) && Object.keys(value).length === 0);
const onlyKeys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));

export function safeStagingResourceBoundary(config) {
  if (!record(config?.volumes) || !record(config?.networks)) return false;
  if (Object.keys(config.volumes).length !== 1 || !record(config.volumes.pgdata)) return false;
  const volume = config.volumes.pgdata;
  if (!onlyKeys(volume, ['name', 'driver', 'external', 'driver_opts']) ||
      volume.name !== 'pmo-staging_pgdata' ||
      (volume.driver !== undefined && volume.driver !== 'local') ||
      (volume.external !== undefined && volume.external !== false) ||
      !noOptions(volume.driver_opts)) return false;

  const networkNames = ['staging-app', 'staging-data'];
  if (Object.keys(config.networks).length !== networkNames.length ||
      !networkNames.every(name => record(config.networks[name]))) return false;
  return networkNames.every(name => {
    const network = config.networks[name];
    return onlyKeys(network, ['name', 'internal', 'external', 'driver', 'driver_opts',
      'attachable', 'enable_ipv6', 'ipam']) &&
      (network.name === undefined || network.name === 'pmo-staging_' + name) &&
      (network.external === undefined || network.external === false) &&
      (network.driver === undefined || network.driver === 'bridge') &&
      noOptions(network.driver_opts) && noOptions(network.ipam) &&
      (network.attachable === undefined || network.attachable === false) &&
      (network.enable_ipv6 === undefined || network.enable_ipv6 === false) &&
      (name === 'staging-data' ? network.internal === true :
        network.internal === undefined || network.internal === false);
  });
}
