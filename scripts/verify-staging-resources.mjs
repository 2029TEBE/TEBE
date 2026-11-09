#!/usr/bin/env node
/**
 * Read-only, staging-only Docker resource preflight before any rsync --delete.
 * Uses Docker Compose's effective configuration and actual container mounts.
 * Never mutates Docker, databases, files, DNS, TLS, or production services.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseSimpleEnvFile } from './rc1-release-gate.mjs';

const PROJECT = 'pmo-staging';
const PROD_PROJECT = 'pmo-prod';
const SERVICES = ['postgres', 'redis', 'api', 'web'];

function block(message) { throw new Error(message); }
function simplePort(value) {
  return typeof value === 'string' && /^[1-9][0-9]{3,4}$/.test(value) &&
    Number(value) >= 1024 && Number(value) <= 65535 && value !== '3000';
}
function containerProject(container) {
  return container?.Config?.Labels?.['com.docker.compose.project'] ?? '';
}
function publishedBindings(container) {
  return Object.values(container?.NetworkSettings?.Ports ?? {}).flatMap(v =>
    Array.isArray(v) ? v : []).map(v => ({
      address: v.HostIp, port: String(v.HostPort),
    }));
}
function portOf(binding) {
  return String(binding?.published ?? '');
}

/**
 * Assert resource separation by examining the effective Compose service plan
 * plus every currently running Docker container (including unrelated stacks).
 */
export function verifyStagingResources(env, config, runningContainers) {
  if (env?.DEPLOYMENT_ENV !== 'staging') block('Staging deployment environment required');
  if (env.WEB_BIND !== '127.0.0.1' || !simplePort(env.WEB_PORT))
    block('Dedicated staging loopback port required');
  if (config?.name !== PROJECT) block('Unexpected effective Compose project');
  if (!config.services || SERVICES.some(name => !config.services[name]))
    block('Incomplete staging Compose service plan');

  const volumes = config.volumes ?? {};
  const pgVolume = volumes.pgdata;
  const volumeName = pgVolume?.name;
  if (pgVolume?.external === true || volumeName !== 'pmo-staging_pgdata')
    block('PostgreSQL volume must be private to staging');
  const pgMounts = config.services.postgres.volumes ?? [];
  if (pgMounts.length !== 1 || pgMounts[0].type !== 'volume' ||
      pgMounts[0].source !== 'pgdata' ||
      pgMounts[0].target !== '/var/lib/postgresql/data')
    block('Staging PostgreSQL must have an isolated named data volume');

  for (const name of ['postgres', 'redis', 'api']) {
    const service = config.services[name];
    if ((service.ports ?? []).length || service.network_mode === 'host' ||
        service.privileged === true)
      block(`${name} must not publish host ports or use host network/privileges`);
  }
  const web = config.services.web;
  if (web.network_mode === 'host' || web.privileged === true ||
      !Array.isArray(web.ports) || web.ports.length !== 1)
    block('Web must publish exactly one protected staging port');
  const binding = web.ports[0];
  if (binding.host_ip !== '127.0.0.1' || portOf(binding) !== env.WEB_PORT ||
      Number(binding.target) !== 3000 || binding.protocol !== 'tcp')
    block('Effective staging web port does not match loopback-only env');

  if (!Array.isArray(runningContainers)) block('Actual Docker container inventory required');
  for (const container of runningContainers) {
    const project = containerProject(container);
    const mounts = container.Mounts ?? [];
    if (project !== PROJECT && mounts.some(m => m.Name === volumeName))
      block('Staging data volume already mounted by another project');
    if (project === PROJECT && mounts.some(m =>
      m.Type === 'volume' && m.Destination === '/var/lib/postgresql/data' &&
      m.Name !== volumeName))
      block('Existing staging container uses unexpected PostgreSQL data volume');
    if (project !== PROJECT && publishedBindings(container).some(p => p.port === env.WEB_PORT))
      block('Staging host port already belongs to another container');
    if (project === PROD_PROJECT && mounts.some(m => m.Name === volumeName))
      block('Production and staging data volume collision');
  }
  return { ok: true, checks: 6, project: PROJECT, volume: volumeName, webPort: env.WEB_PORT };
}

function docker(args) {
  // Never interpolate or print env secrets or container JSON on failure.
  return execFileSync('docker', args, {
    encoding: 'utf8', timeout: 20000, maxBuffer: 5 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function remoteCheck() {
  if (process.argv.length !== 4 || process.argv[2] !== '--env-file' ||
      process.argv[3] !== '.env.staging')
    block('Usage: node scripts/verify-staging-resources.mjs --env-file .env.staging');
  const env = parseSimpleEnvFile(readFileSync('.env.staging', 'utf8'));
  const config = JSON.parse(docker(['compose', '-f', 'docker-compose.prod.yml', '-p',
    PROJECT, '--env-file', '.env.staging', 'config', '--format', 'json']));
  const ids = docker(['ps','-q']).split(/\s+/).filter(Boolean);
  const containers = ids.length ? JSON.parse(docker(['inspect', ...ids])) : [];
  const result = verifyStagingResources(env, config, containers);
  console.log(`PASS staging Docker resource plan: ${result.project}, isolated volume, loopback port ${result.webPort}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { remoteCheck(); }
  catch { console.error('BLOCKED: staging Docker resources are unverified or overlap another service; no files copied.'); process.exitCode = 1; }
}
