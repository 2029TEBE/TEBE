/**
 * S49: reject alternate build contexts, Dockerfiles and build-time injection
 * in the final resolved synthetic staging Compose model. Offline only.
 * A matching image tag does not authenticate the build context behind it.
 */
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const names = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const dockerfiles = { api: 'apps/api/Dockerfile', web: 'apps/web/Dockerfile' };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function approvedBuild(build, dockerfile) {
  if (build === undefined) return true;
  if (!record(build) || Object.keys(build).length !== 2 ||
      !Object.hasOwn(build, 'context') || !Object.hasOwn(build, 'dockerfile')) return false;
  // `docker compose config --format json` resolves the build context to an
  // absolute checkout path. No parent, external, or secondary build context.
  if (typeof build.context !== 'string' || !isAbsolute(build.context) ||
      resolve(build.context) !== repositoryRoot) return false;
  return build.dockerfile === dockerfile ||
    build.dockerfile === resolve(repositoryRoot, dockerfile);
}

export function safeStagingBuildBoundary(services) {
  if (!record(services)) return false;
  return names.every(name => {
    const service = services[name];
    if (!record(service) ||
        (service.pull_policy !== undefined && service.pull_policy !== 'never')) return false;
    if (!Object.hasOwn(dockerfiles, name)) return service.build === undefined;
    return approvedBuild(service.build, dockerfiles[name]);
  });
}
