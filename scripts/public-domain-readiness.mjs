#!/usr/bin/env node
/**
 * Non-mutating public reachability observation for The EPMO. No secrets,
 * credentials, private endpoints, customer data, payments, or DNS changes.
 * Success confirms only DNS and public HTTPS responses -- NOT deployment SHA,
 * authenticated service health, inbox delivery or commercial launch approval.
 */
import { resolve4, resolve6, resolveMx, resolveNs } from 'node:dns/promises';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const TARGETS = Object.freeze([
  { host: 'theepmo.com', path: '/' },
  { host: 'app.theepmo.com', path: '/login' },
  { host: 'app.theepmo.com', path: '/signup' },
]);

async function resolveSafe(method, host) {
  try {
    const results = await method(host);
    return Array.isArray(results) ? results : [];
  } catch { return []; }
}
const acceptedHttpStatus = status => Number.isInteger(status) && status >= 200 && status < 400;

/** Read-only probes; input targets are fixed in source and cannot become SSRF. */
export async function observePublicReadiness({
  dns4 = resolve4, dns6 = resolve6, dnsNs = resolveNs, dnsMx = resolveMx,
  request = fetch, now = () => new Date().toISOString(),
} = {}) {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
    throw new Error('TLS verification has been disabled; refuse public readiness');
  const [nameservers, mx] = await Promise.all([
    resolveSafe(dnsNs, 'theepmo.com'), resolveSafe(dnsMx, 'theepmo.com'),
  ]);
  const hosts = [...new Set(TARGETS.map(t => t.host))];
  const resolved = new Map(await Promise.all(hosts.map(async host => {
    const [ipv4, ipv6] = await Promise.all([
      resolveSafe(dns4, host), resolveSafe(dns6, host),
    ]);
    return [host, { addressRecords: ipv4.length + ipv6.length, resolves: ipv4.length + ipv6.length > 0 }];
  })));
  const targets = [];
  for (const target of TARGETS) {
    const dns = resolved.get(target.host);
    let httpStatus = null;
    let httpsAvailable = false;
    const url = 'https://' + target.host + target.path;
    if (dns?.resolves) {
      try {
        const response = await request(url, {
          method: 'GET', redirect: 'manual',
          signal: AbortSignal.timeout(10000),
          headers: { 'user-agent': 'EPMO-ReadOnly-Domain-Observation/1.0' },
        });
        httpStatus = Number.isInteger(response?.status) ? response.status : null;
        httpsAvailable = acceptedHttpStatus(httpStatus);
        // Never retain or print HTML, response headers, cookies or body content.
        await response.body?.cancel?.().catch?.(() => {});
      } catch { /* Remain fail-closed, without printing raw error details. */ }
    }
    targets.push({
      host: target.host, path: target.path,
      dnsResolves: !!dns?.resolves, addressRecordCount: dns?.addressRecords ?? 0,
      httpsStatus: httpStatus, httpsAvailable,
    });
  }
  return {
    observation: 'public-dns-and-https-only',
    observedAt: now(),
    authoritativeNsLookupPresent: nameservers.length > 0,
    mxLookupPresent: mx.length > 0,
    targets,
    reachable: nameservers.length > 0 && targets.every(t => t.dnsResolves && t.httpsAvailable),
    mailDeliveryVerified: false,
    deployedShaVerified: false,
    paidCustomerLaunchAccepted: false,
  };
}

export function renderSummary(result) {
  const lines = [
    '## The EPMO — public read-only reachability',
    '',
    '| Target | DNS | HTTPS status | Reachable |',
    '| --- | --- | --- | --- |',
    ...result.targets.map(t => [
      '| ' + t.host + t.path,
      t.dnsResolves ? 'resolved' : 'unresolved',
      t.httpsStatus ?? 'unavailable',
      t.httpsAvailable ? 'yes' : 'no', '|',
    ].join(' | ')),
    '',
    'NS records observable: ' + (result.authoritativeNsLookupPresent ? 'yes' : 'no'),
    'MX records observable: ' + (result.mxLookupPresent ? 'yes' : 'no'),
    '',
    '**Scope:** Read-only public DNS and HTTPS checks. No authentication, deployed SHA attestation,',
    'inbox delivery, Stripe provider payments, tenant isolation or operational recovery tested.',
    '**Paid-customer launch accepted: NO**, regardless of connectivity result.',
  ];
  return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const outcome = await observePublicReadiness();
    const summary = renderSummary(outcome);
    process.stdout.write(summary);
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    if (!outcome.reachable) process.exitCode = 2;
  } catch {
    process.stderr.write('Public reachability observation blocked; no secrets or response bodies emitted.\n');
    process.exitCode = 2;
  }
}
