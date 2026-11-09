#!/usr/bin/env node
/**
 * Public, read-only staging reachability preflight.
 * Never accepts an arbitrary URL, credentials, deployment target or write method.
 * Passing checks are NOT proof that a staging host is isolated from production:
 * the authenticated Docker identity and database checks are separate release gates.
 */
import { resolve4, resolve6 } from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const TARGETS = Object.freeze({
  web: Object.freeze({ host: 'staging.theepmo.com', url: 'https://staging.theepmo.com/' }),
  api: Object.freeze({ host: 'api-staging.theepmo.com', url: 'https://api-staging.theepmo.com/health' }),
});

async function defaultDns(host) {
  const responses = await Promise.allSettled([resolve4(host), resolve6(host)]);
  const addresses = responses.filter(result => result.status === 'fulfilled')
    .flatMap(result => result.value);
  if (addresses.length === 0) throw new Error('no public A/AAAA address resolved');
  return addresses.length;
}

export async function checkPublicStaging({ dns = defaultDns, request = fetch } = {}) {
  const results = [];
  for (const [service, target] of Object.entries(TARGETS)) {
    try {
      const addresses = await dns(target.host);
      if (!addresses || (typeof addresses === 'number' && addresses < 1) ||
          (Array.isArray(addresses) && addresses.length < 1)) {
        throw new Error('no public address returned');
      }
      results.push({ service, gate: 'public DNS', passed: true });
    } catch {
      results.push({ service, gate: 'public DNS', passed: false });
      results.push({ service, gate: 'HTTPS identity', passed: false });
      continue;
    }
    try {
      const response = await request(target.url, {
        method: 'GET',
        redirect: 'manual',
        headers: { Accept: service === 'api' ? 'application/json' : 'text/html' },
        signal: AbortSignal.timeout(8000),
      });
      if (response.status !== 200) throw new Error('non-200 HTTPS response');
      if (service === 'api') {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().includes('application/json'))
          throw new Error('API health did not return JSON');
        const body = await response.json();
        if (body?.ok !== true || body?.service !== 'pmo-api')
          throw new Error('API health identity mismatch');
      } else {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().includes('text/html'))
          throw new Error('staging web did not return HTML');
      }
      results.push({ service, gate: 'HTTPS identity', passed: true });
    } catch {
      results.push({ service, gate: 'HTTPS identity', passed: false });
    }
  }
  return { passed: results.every(result => result.passed), results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Ignore unsupported arguments: never allow the caller to switch to production.
  if (process.argv.length !== 2) {
    console.error('Usage: node scripts/check-public-staging.mjs');
    process.exitCode = 2;
  } else {
    checkPublicStaging().then(report => {
      for (const item of report.results)
        console.log(`${item.passed ? 'PASS' : 'BLOCKED'} ${item.service} ${item.gate}`);
      console.log(report.passed
        ? 'Public staging reachability only; Docker, database and tenant isolation remain unverified.'
        : 'BLOCKED: staging endpoints not publicly verified; do not deploy or change production.');
      if (!report.passed) process.exitCode = 1;
    }).catch(() => {
      console.error('BLOCKED: public staging reachability preflight failed');
      process.exitCode = 1;
    });
  }
}
