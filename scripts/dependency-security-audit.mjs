import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// The registry can lag GitHub withdrawals. Never maintain an ignore list:
// confirm each blocking GHSA live, and fail closed when confirmation fails.
export async function assessAudit(report, lookup) {
  if (!report || !report.advisories || typeof report.advisories !== 'object' ||
      !report.metadata?.vulnerabilities || report.error) throw new Error('Invalid audit report');
  const results = [];
  for (const advisory of Object.values(report.advisories)) {
    if (!['high', 'critical'].includes(advisory.severity)) continue;
    const id = advisory.github_advisory_id;
    let state = 'blocking';
    let withdrawnAt = null;
    if (/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(id ?? '')) {
      try {
        const current = await lookup(id);
        const timestamp = Date.parse(current.withdrawn_at);
        if (current.ghsa_id === id && typeof current.withdrawn_at === 'string' &&
            Number.isFinite(timestamp) && timestamp <= Date.now()) {
          state = 'withdrawn';
          withdrawnAt = current.withdrawn_at;
        }
      } catch { /* unavailable or malformed upstream evidence remains blocking */ }
    }
    results.push({ id: id ?? null, package: advisory.module_name, severity: advisory.severity,
      state, withdrawnAt, paths: advisory.findings?.flatMap(f => f.paths ?? []) ?? [] });
  }
  const reported = report.metadata.vulnerabilities;
  if ((reported.high > 0 || reported.critical > 0) && results.length === 0)
    throw new Error('Audit counts contain unclassified blocking findings');
  return { checkedAt: new Date().toISOString(), blocking: results.filter(a => a.state === 'blocking').length,
    withdrawn: results.filter(a => a.state === 'withdrawn').length, registryCounts: reported, results };
}

async function lookup(id) {
  const response = await fetch(`https://api.github.com/advisories/${id}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TEBE-dependency-security-audit' },
    signal: AbortSignal.timeout(15000), redirect: 'error'
  });
  if (!response.ok) throw new Error(`Advisory lookup HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const expected = manifest.packageManager.replace(/^pnpm@/, '');
  const version = spawnSync('pnpm', ['--version'], { encoding: 'utf8', timeout: 30000 });
  if (version.status !== 0 || version.stdout.trim() !== expected)
    throw new Error(`Use the repository package manager: pnpm ${expected}`);
  const audit = spawnSync('pnpm', ['audit', '--json'], { encoding: 'utf8', timeout: 120000,
    maxBuffer: 16 * 1024 * 1024 });
  if (audit.error || ![0, 1].includes(audit.status)) throw new Error('Registry audit could not complete');
  const report = JSON.parse(audit.stdout);
  const result = await assessAudit(report, lookup);
  const directory = resolve(process.env.DEPENDENCY_AUDIT_DIR ?? join(process.env.RUNNER_TEMP ?? '/tmp', 'tebe-dependency-audit'));
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'registry.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(directory, 'assessment.json'), JSON.stringify(result, null, 2));
  const summary = `Dependency audit: ${result.blocking} active/unverified high or critical advisories; ${result.withdrawn} confirmed withdrawn. Lower-severity findings remain in registry.json.\n`;
  console.log(summary);
  console.log(JSON.stringify(result.results, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (result.blocking) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => { console.error(`Dependency audit BLOCKED: ${error.message}`); process.exitCode = 1; });
