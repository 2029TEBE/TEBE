import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSyntheticBucket, verifySyntheticBucket } from './staging-offhost-bucket-guard.mjs';

const good = () => ({
  access: { PublicAccessBlockConfiguration: {
    BlockPublicAcls: true, IgnorePublicAcls: true,
    BlockPublicPolicy: true, RestrictPublicBuckets: true,
  } },
  location: { LocationConstraint: 'eu-central-1' },
  encryption: { ServerSideEncryptionConfiguration: { Rules: [
    { ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
  ] } },
});

test('S40 accepts only fully blocked, region-matched and encrypted TEST bucket', () => {
  assert.equal(inspectSyntheticBucket(good(), 'eu-central-1'), true);
  const us = good(); us.location.LocationConstraint = null;
  assert.equal(inspectSyntheticBucket(us, 'us-east-1'), true);
  const eu = good(); eu.location.LocationConstraint = 'EU';
  assert.equal(inspectSyntheticBucket(eu, 'eu-west-1'), true);
});

test('S40 refuses public ACL or policy settings, including missing settings', () => {
  for (const field of ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets']) {
    const v = good(); v.access.PublicAccessBlockConfiguration[field] = false;
    assert.throws(() => inspectSyntheticBucket(v, 'eu-central-1'), /public access/);
  }
  const v = good(); delete v.access.PublicAccessBlockConfiguration;
  assert.throws(() => inspectSyntheticBucket(v, 'eu-central-1'), /public access/);
});

test('S40 refuses mismatched, missing and malformed bucket region', () => {
  for (const region of ['us-east-1', 'EU', 'production', '', undefined])
    assert.throws(() => inspectSyntheticBucket(good(), region));
  const v = good(); delete v.location.LocationConstraint;
  assert.throws(() => inspectSyntheticBucket(v, 'eu-central-1'));
});

test('S40 refuses missing, unsupported or unencrypted bucket configuration', () => {
  const v = good(); v.encryption.ServerSideEncryptionConfiguration.Rules = [];
  assert.throws(() => inspectSyntheticBucket(v, 'eu-central-1'), /encryption/);
  const w = good(); w.encryption.ServerSideEncryptionConfiguration.Rules[0]
    .ApplyServerSideEncryptionByDefault.SSEAlgorithm = 'invalid';
  assert.throws(() => inspectSyntheticBucket(w, 'eu-central-1'), /encryption/);
});

test('S40 verifies bucket only through three bounded read-only AWS commands', () => {
  const fixture = good(), calls = [];
  const results = {
    'get-public-access-block': fixture.access,
    'get-bucket-location': fixture.location,
    'get-bucket-encryption': fixture.encryption,
  };
  const aws = args => {
    calls.push(args);
    assert.deepEqual(args.slice(0, 1), ['s3api']);
    assert.deepEqual(args.slice(2), ['--bucket', 'epmo-test-bucket', '--output', 'json']);
    return Buffer.from(JSON.stringify(results[args[1]]));
  };
  assert.equal(verifySyntheticBucket(aws, { bucket: 'epmo-test-bucket', region: 'eu-central-1' }), true);
  assert.deepEqual(calls.map(x => x[1]), [
    'get-public-access-block', 'get-bucket-location', 'get-bucket-encryption',
  ]);
});

test('S40 refuses denied AWS reads, malformed JSON and oversized output', () => {
  for (const runner of [
    () => { throw new Error('provider secret'); },
    () => Buffer.from('{broken'),
    () => Buffer.alloc(40_000, 32),
  ]) assert.throws(() => verifySyntheticBucket(runner, {
    bucket: 'epmo-test-bucket', region: 'eu-central-1',
  }), /details withheld/);
});

test('S40 off-host guard runs before any Docker container or S3 write', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('./staging-synthetic-recovery.mjs', import.meta.url), 'utf8');
  const guard = source.indexOf('verifySyntheticBucket(aws, { bucket: remote.bucket, region })');
  const docker = source.indexOf("docker(['image', 'inspect', image])");
  const upload = source.indexOf("aws(['s3', 'cp', encrypted, url");
  assert.ok(guard > 0 && docker > guard && upload > guard);
});
