/**
 * Local disposable seed companion: only rewrites web development identity when
 * the exact admin URL matches the workspace root .env. Never call before
 * assertDisposableSeedSafety passes in the seed entrypoint.
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

function workspaceRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = dirname(dir); if (up === dir) return null; dir = up;
  }
  return null;
}

/**
 * Reseeding generates new UUIDs, which would leave apps/web/.env.local pointing
 * at a tenant that no longer exists. Rewrite it here so that cannot happen.
 *
 * Only when the seed is pointed at THIS machine's database, though. Seeding a
 * deployed environment — over an SSH tunnel, say, which also arrives on
 * 127.0.0.1 — must not repoint the local dev server at rows it cannot see.
 * The test is exact: the URL in use must be the one the repository's own .env
 * names.
 */
export function writeDevEnv(tenantId: string, userId: string, adminUrl: string) {
  const dir = workspaceRoot();
  if (!dir) return;

  const envFile = resolve(dir, '.env');
  const localUrl = existsSync(envFile)
    ? /^DATABASE_URL_ADMIN=(.*)$/m.exec(readFileSync(envFile, 'utf8'))?.[1]?.trim()
    : undefined;
  if (!localUrl || localUrl !== adminUrl) {
    console.log('\nLeft apps/web/.env.local alone — this seed was not pointed at the local database.');
    return;
  }

  const target = resolve(dir, 'apps/web/.env.local');
  writeFileSync(target,
    `NEXT_PUBLIC_API_URL=http://localhost:4000\n` +
    `# Written by \`pnpm db:seed\` — dev identity only, replaced by real auth at G4.\n` +
    `NEXT_PUBLIC_DEV_TENANT_ID=${tenantId}\n` +
    `NEXT_PUBLIC_DEV_USER_ID=${userId}\n`);
  console.log(`\nWrote apps/web/.env.local  (tenant ${tenantId.slice(0, 8)}, user ${userId.slice(0, 8)})`);
  console.log('If the web dev server is already running, restart it to pick this up.');
}


