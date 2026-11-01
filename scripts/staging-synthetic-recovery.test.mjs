import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRemote, validateDrillEnvironment, encryptArchive, decryptArchive, runSyntheticDrill } from './staging-synthetic-recovery.mjs';

const key = randomBytes(32);
test('S34 AES-256-GCM encrypted backup round trip is authenticated and not plaintext', () => {
  const original = Buffer.from('synthetic PGDMP recovery payload');
  const sealed = encryptArchive(original, key);
  assert.equal(sealed.includes(original), false);
  assert.deepEqual(decryptArchive(sealed, key), original);
  assert.notDeepEqual(encryptArchive(original, key), sealed);
});
test('S34 tampering, wrong key, truncated header and wrong format fail closed', () => {
  const sealed = encryptArchive(Buffer.from('PGDMP synthetic only'), key);
  const tampered = Buffer.from(sealed); tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptArchive(tampered, key));
  assert.throws(() => decryptArchive(sealed, randomBytes(32)));
  assert.throws(() => decryptArchive(sealed.subarray(0, 8), key));
  assert.throws(() => decryptArchive(Buffer.from('plaintext PGDMP'), key));
});
test('S34 off-host destination rejects local, generic, production and traversal paths', () => {
  for (const url of ['/tmp/backup', 'file:///tmp/backup', 'https://example.org/a',
    's3://bucket/production/', 's3://bucket/epmo-synthetic-drills/../production',
    's3://bucket/epmo-synthetic-drills//oops']) assert.throws(() => parseRemote(url), url);
  assert.deepEqual(parseRemote('s3://epmo-test-bucket/epmo-synthetic-drills/staging'),
    { bucket: 'epmo-test-bucket', prefix: 'epmo-synthetic-drills/staging' });
});
test('S34 environment refuses production secrets, missing approvals and non-pinned images', () => {
  const dir = mkdtempSync(join(tmpdir(), 'epmo-s34-test-'));
  try {
    const path = join(dir, 'key'); writeFileSync(path, key); chmodSync(path, 0o600);
    const valid = { DEPLOYMENT_ENV: 'staging', EPMO_SYNTHETIC_ONLY: 'YES',
      EPMO_REMOTE_IO_APPROVED: 'YES', EPMO_RECOVERY_S3_PREFIX: 's3://epmo-test-bucket/epmo-synthetic-drills/staging',
      EPMO_RECOVERY_KEY_FILE: path, EPMO_PG_IMAGE: 'postgres:16-alpine@sha256:' + 'a'.repeat(64) };
    assert.deepEqual(validateDrillEnvironment(valid).key, key);
    for (const delta of [{ DATABASE_URL: 'postgres://production' }, { PGHOST: 'production' },
      { STRIPE_SECRET_KEY: 'sk_live_fake' }, { EPMO_REMOTE_IO_APPROVED: 'NO' },
      { DEPLOYMENT_ENV: 'production' }, { EPMO_PG_IMAGE: 'postgres:16-alpine' },
      { AWS_ENDPOINT_URL: 'http://localhost:9000' }]) {
      assert.throws(() => validateDrillEnvironment({ ...valid, ...delta }));
    }
    chmodSync(path, 0o644);
    assert.throws(() => validateDrillEnvironment(valid));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


// S54 exercises the off-host control flow with isolated fake clients.
// This is NOT an actual Docker restore, S3 receipt, or off-host acceptance.
function offhostFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'epmo-s54-test-'));
  const keyFile = join(dir, 'key');
  writeFileSync(keyFile, randomBytes(32), { mode: 0o600 });
  const env = {
    DEPLOYMENT_ENV: 'staging', EPMO_SYNTHETIC_ONLY: 'YES',
    EPMO_REMOTE_IO_APPROVED: 'YES',
    EPMO_RECOVERY_S3_PREFIX: 's3://epmo-test-bucket/epmo-synthetic-drills/staging',
    EPMO_RECOVERY_KEY_FILE: keyFile,
    EPMO_PG_IMAGE: 'postgres:16-alpine@sha256:' + 'a'.repeat(64),
    AWS_ACCESS_KEY_ID: 'S54_SYNTHETIC_ONLY',
    AWS_SECRET_ACCESS_KEY: 'S54_SYNTHETIC_ONLY',
    AWS_DEFAULT_REGION: 'us-east-1',
  };
  return { env, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function fakeOffhostClients({ failRollback = false } = {}) {
  const events = [], states = new Map();
  const original = '1|S34_SYNTHETIC_A\n2|S34_SYNTHETIC_B';
  let uploaded;
  const docker = (args, opts = {}) => {
    events.push({ kind: 'docker', args: [...args] });
    if (args[0] === 'image') return Buffer.from('[]');
    if (args[0] === 'run') {
      assert.equal(args[args.indexOf('--network') + 1], 'none');
      assert.equal(args[args.indexOf('--pull') + 1], 'never');
      const name = args[args.indexOf('--name') + 1];
      states.set(name, 'new');
      return Buffer.from(name);
    }
    if (args[0] === 'rm') {
      states.delete(args.at(-1));
      return Buffer.alloc(0);
    }
    if (args[0] === 'exec') {
      const name = args[1] === '-i' ? args[2] : args[1];
      const action = args.find(x => ['pg_isready', 'psql', 'pg_dump', 'pg_restore'].includes(x));
      if (action === 'pg_isready') return Buffer.alloc(0);
      if (action === 'pg_dump')
        return Buffer.from('PGDMP' + 'synthetic-fixture'.repeat(20));
      if (action === 'pg_restore') {
        assert.ok(Buffer.isBuffer(opts.input));
        if (args.includes('--list')) return Buffer.from('valid synthetic TOC');
        if (failRollback && args.includes('--clean'))
          throw new Error('simulated in-place rollback failed');
        states.set(name, 'restored');
        return Buffer.alloc(0);
      }
      if (action === 'psql') {
        const sql = args[args.indexOf('-c') + 1] || '';
        if (sql.startsWith('SELECT'))
          return Buffer.from(states.get(name) === 'corrupted'
            ? '1|S34_SYNTHETIC_CORRUPTED\n2|S34_SYNTHETIC_B\n'
            : original + '\n');
        if (sql.startsWith('UPDATE')) states.set(name, 'corrupted');
        else states.set(name, 'seeded');
        return Buffer.alloc(0);
      }
    }
    throw new Error('Unexpected simulated Docker operation');
  };
  const aws = args => {
    events.push({ kind: 'aws', args: [...args] });
    if (args[0] === 's3api') {
      if (args[1] === 'get-public-access-block') return Buffer.from(JSON.stringify({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true, IgnorePublicAcls: true,
          BlockPublicPolicy: true, RestrictPublicBuckets: true,
        },
      }));
      if (args[1] === 'get-bucket-location')
        return Buffer.from('{"LocationConstraint":null}');
      if (args[1] === 'get-bucket-encryption') return Buffer.from(JSON.stringify({
        ServerSideEncryptionConfiguration: { Rules: [
          { ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ] },
      }));
      if (args[1] === 'head-object') return Buffer.from('{}');
    }
    if (args[0] === 's3' && args[1] === 'cp') {
      if (args[2].startsWith('s3://')) {
        assert.ok(uploaded);
        writeFileSync(args[3], uploaded);
      } else {
        uploaded = readFileSync(args[2]);
        assert.equal(uploaded.includes(Buffer.from('S34_SYNTHETIC_A')), false);
      }
      return Buffer.alloc(0);
    }
    throw new Error('Unexpected simulated AWS operation');
  };
  return { clients: { docker, aws }, events, states };
}

test('S54 simulated off-host round-trip rolls back the SAME corrupted target', async () => {
  const f = offhostFixture(), d = fakeOffhostClients();
  const originalLog = console.log;
  console.log = () => {};
  try {
    const result = await runSyntheticDrill(f.env, {
      socketCheck: () => true, clients: d.clients,
    });
    assert.equal(result.result, 'synthetic-drill-only');
    const docker = d.events.filter(e => e.kind === 'docker').map(e => e.args);
    const restores = docker.filter(x => x.includes('pg_restore') && !x.includes('--list'));
    assert.equal(docker.filter(x => x[0] === 'run').length, 2,
      'remote rehearsal must not claim rollback by creating a third clean database');
    assert.equal(restores.length, 2);
    assert.equal(restores[0][2], restores[1][2],
      'rollback must restore the previously mutated target');
    assert.equal(restores[0].includes('--clean'), false);
    assert.equal(restores[1].includes('--clean'), true);
    assert.equal(restores[1].includes('--if-exists'), true);
    assert.equal(restores[1].includes('--single-transaction'), true);
    assert.equal(docker.filter(x => x[0] === 'rm').length, 2);
    assert.equal(d.states.size, 0);
    assert.equal(d.events.filter(x => x.kind === 'aws' &&
      x.args[0] === 's3' && x.args[1] === 'cp').length, 2);
  } finally {
    console.log = originalLog;
    f.cleanup();
  }
});

test('S54 simulated off-host rollback failure prevents PASS and cleans disposable targets', async () => {
  const f = offhostFixture(), d = fakeOffhostClients({ failRollback: true });
  const originalLog = console.log, messages = [];
  console.log = (...args) => messages.push(args.join(' '));
  try {
    await assert.rejects(runSyntheticDrill(f.env, {
      socketCheck: () => true, clients: d.clients,
    }), /simulated in-place rollback failed/);
    const docker = d.events.filter(e => e.kind === 'docker').map(e => e.args);
    assert.equal(docker.filter(x => x[0] === 'run').length, 2);
    assert.equal(docker.filter(x => x[0] === 'rm').length, 2);
    assert.equal(d.states.size, 0);
    assert.equal(messages.some(x => x.startsWith('PASS:')), false);
  } finally {
    console.log = originalLog;
    f.cleanup();
  }
});
