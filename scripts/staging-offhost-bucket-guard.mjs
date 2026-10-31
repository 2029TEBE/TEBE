/**
 * S40: read-only, fail-closed S3 destination preflight for synthetic encrypted
 * PostgreSQL recovery. No AWS calls occur unless verifySyntheticBucket() is
 * invoked with an explicitly isolated AWS CLI runner from S37.
 * Passing this guard is NOT proof of off-host restore or Saudi residency.
 */
const safeRegion = /^[a-z]{2}(?:-gov)?-[a-z0-9-]+-\d$/;
const allPublicBlocks = [
  'BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets',
];

export function inspectSyntheticBucket({ access, location, encryption }, expectedRegion) {
  if (typeof expectedRegion !== 'string' || !safeRegion.test(expectedRegion))
    throw new Error('Explicit valid TEST bucket region required');
  const block = access?.PublicAccessBlockConfiguration;
  if (!block || !allPublicBlocks.every(name => block[name] === true))
    throw new Error('Synthetic recovery bucket must block all public access');
  const actualRegion = location?.LocationConstraint === null ? 'us-east-1'
    : location?.LocationConstraint === 'EU' ? 'eu-west-1'
    : location?.LocationConstraint;
  if (actualRegion !== expectedRegion)
    throw new Error('Synthetic recovery bucket region mismatch');
  const rules = encryption?.ServerSideEncryptionConfiguration?.Rules;
  if (!Array.isArray(rules) || rules.length === 0 ||
      !rules.every(rule => ['AES256', 'aws:kms'].includes(
        rule?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm)))
    throw new Error('Synthetic recovery bucket default encryption unverified');
  return true;
}

export function verifySyntheticBucket(aws, { bucket, region }) {
  if (typeof aws !== 'function' || typeof bucket !== 'string' ||
      !/^[a-z0-9][a-z0-9.-]{2,62}$/.test(bucket) || bucket.includes('..'))
    throw new Error('Invalid synthetic bucket verification input');
  const read = action => {
    let response;
    try {
      response = aws(['s3api', action, '--bucket', bucket, '--output', 'json']);
      if (!Buffer.isBuffer(response) && typeof response !== 'string') throw new Error('invalid output');
      if (response.length > 32_768) throw new Error('unbounded output');
      return JSON.parse(response.toString('utf8'));
    } catch {
      throw new Error('Synthetic bucket read-only verification failed; details withheld');
    }
  };
  return inspectSyntheticBucket({
    access: read('get-public-access-block'),
    location: read('get-bucket-location'),
    encryption: read('get-bucket-encryption'),
  }, region);
}
