import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { accountDirectoryQuery } from '../apps/api/src/platform/account-directory-policy.ts';

const source = readFileSync(new URL('../apps/api/src/platform/super-admin.service.ts', import.meta.url), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function harness({ userId = id(1), vendor = true, capability = true, found = [] } = {}) {
  const calls = [];
  const scopes = [];
  const sql = (strings, ...values) => ({ text: strings.join('?'), values });
  sql.join = values => ({ values });
  const db = {
    select(shape) {
      return { from() { return {
        where() { return { limit: async () => [{ isPlatformAdmin: vendor }] }; },
        orderBy: async () => [{ id: id(90), name: 'Workspace', slug: 'workspace' }],
      }; } };
    },
    execute: async query => { calls.push(query); return found; },
  };
  const bindings = {
    db, sql, eq: () => null, users: { id: 'id', isPlatformAdmin: 'admin' },
    tenants: { id: 'id', name: 'name', slug: 'slug' },
    currentContext: () => ({ userId }),
    requireCapability: () => { if (!capability) throw new Error('Forbidden'); },
    withTenant: async (tenantId, fn) => {
      scopes.push(tenantId);
      return fn({ execute: async () => [{ userId: id(1), role: 'owner', isActive: false }] });
    },
    accountDirectoryQuery,
    BadRequestException: Error, ForbiddenException: Error, ConflictException: Error, NotFoundException: Error,
    module: { exports: {} },
  };
  const executable = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, '')
    .replace('@Injectable()', '').replace('export class', 'class'));
  vm.runInNewContext(`${executable}\nmodule.exports = SuperAdminService;`, bindings);
  return { service: new bindings.module.exports(), calls, scopes };
}

test('directory bounds input and validates cursors without a maximum account offset', () => {
  assert.deepEqual(accountDirectoryQuery(), { limit: 25, cursor: null, q: '' });
  assert.equal(accountDirectoryQuery('50', id(10), ' name ').q, 'name');
  for (const limit of ['0', '-1', '51', 'NaN', '1.5', 'Infinity'])
    assert.throws(() => accountDirectoryQuery(limit));
  assert.throws(() => accountDirectoryQuery('25', "' OR true --"));
  assert.throws(() => accountDirectoryQuery('25', undefined, 'a'.repeat(101)));
  assert.throws(() => accountDirectoryQuery('25', undefined, 'hello\u0000world'));
});

test('ordinary users, missing identity and revoked platform admins cannot read accounts', async () => {
  for (const options of [{ capability: false }, { userId: null }, { vendor: false }]) {
    const h = harness(options);
    await assert.rejects(() => h.service.accounts());
    assert.equal(h.calls.length, 0);
    assert.equal(h.scopes.length, 0);
  }
});

test('directory paginates accounts and reads memberships inside their tenant scope', async () => {
  const h = harness({ found: [1, 2, 3].map(n => ({ id: id(n), email: `user${n}@example.test`, isActive: n !== 2 })) });
  const result = await h.service.accounts('2', undefined, "%_' OR true --");
  assert.equal(result.items.length, 2);
  assert.equal(result.nextCursor, id(2));
  assert.equal(result.items[1].isActive, false);
  assert.equal(result.items[0].workspaces[0].role, 'owner');
  assert.equal(result.items[0].workspaces[0].isActive, false);
  assert.equal(result.items[1].workspaces.length, 0);
  assert.deepEqual(h.scopes, [id(90)]);
  assert.equal(h.calls[0].values.includes("%_' OR true --"), true);
  assert.equal(h.calls[0].text.includes('OR true --'), false);
  assert.doesNotMatch(h.calls[0].text, /password|token|SELECT\s+\*/i);
});

test('empty and final pages terminate pagination; invalid input never queries directory', async () => {
  const h = harness();
  const empty = await h.service.accounts();
  assert.equal(empty.items.length, 0);
  assert.equal(empty.nextCursor, null);
  assert.equal(h.scopes.length, 0);
  const invalid = harness();
  await assert.rejects(() => invalid.service.accounts('10000'));
  assert.equal(invalid.calls.length, 0);
  const final = await harness({ found: [{ id: id(8) }] }).service.accounts('25', id(7));
  assert.equal(final.nextCursor, null);
});

test('the directory page and navigation require the platform capability', () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const page = read('apps/web/src/app/(app)/super-admin/users/page.tsx');
  assert.match(page, /if \(!session.authenticated\) redirect\('\/login'\)/);
  assert.match(page, /if \(!session.capabilities.includes\('pmoa_platform'\)\) redirect/);
  assert.match(read('apps/api/src/platform/super-admin.controller.ts'), /@Get\('users'\)/);
  assert.match(read('apps/web/src/lib/nav.ts'), /href: '\/super-admin\/users', cap: 'pmoa_platform'/);
});
