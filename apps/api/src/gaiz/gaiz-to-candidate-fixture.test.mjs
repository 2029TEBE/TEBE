import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash, createPublicKey, randomBytes } from 'node:crypto';
import { verifyGaizForPreview } from './gaiz-verifier.mjs';
import { previewGaizCandidateSynthetic } from './gaiz-synthetic-preview.mjs';
import { planSyntheticGaizGovernanceDraft } from './gaiz-draft-mapping.mjs';

const dir=dirname(fileURLToPath(import.meta.url));
const fixture=JSON.parse(readFileSync(resolve(dir,'fixtures/to-producer-synthetic-v1.json'),'utf8'));
const bytes=Buffer.from(fixture.envelopeBase64,'base64');
const publicKey=createPublicKey(fixture.publicKeyPem);
const dataEncryptionKey=Buffer.from(fixture.dekHex,'hex');
const tenant='tenant-interoperability';
const context={
  authenticated:true,entitled:true,workspaceMember:true,
  tenantId:tenant,userId:'synthetic-actor',capabilities:['read'],
};
const opts=()=>({
  trustedIssuerPublicKey:publicKey,
  expectedTenantScope:tenant,
  dataEncryptionKey,
  context,
});

test('fixture created with TO candidate producer is authenticated by TEBE',()=>{
  assert.equal(fixture.testOnly,true);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.sha256);
  const signed=verifyGaizForPreview(bytes,{
    trustedIssuerPublicKey:publicKey,expectedTenantScope:tenant,
  });
  assert.equal(signed.verified,true);
  assert.equal(signed.importAllowed,false);
  assert.equal(signed.manifest.artifactId,'to-generated-synthetic-v1');
  const preview=previewGaizCandidateSynthetic(bytes,opts());
  assert.deepEqual(preview.preview,{
    title:'Synthetic governance report',
    summary:'Conformance test only',
  });
  assert.equal(preview.authorizedToImport,false);
});

test('TO candidate fixture never bypasses tenant, key or signature verification',()=>{
  assert.throws(()=>previewGaizCandidateSynthetic(bytes,{
    ...opts(),dataEncryptionKey:randomBytes(32),
  }));
  assert.throws(()=>previewGaizCandidateSynthetic(bytes,{
    ...opts(),expectedTenantScope:'different-tenant',
  }));
  const tampered=Buffer.from(bytes);
  tampered[tampered.length-4]^=1;
  assert.throws(()=>verifyGaizForPreview(tampered,{
    trustedIssuerPublicKey:publicKey,expectedTenantScope:tenant,
  }));
});

test('preview remains distinct from approval and persistent import rights',()=>{
  const preview=previewGaizCandidateSynthetic(bytes,opts());
  const proposed=planSyntheticGaizGovernanceDraft(
    {schemaVersion:1,...preview.preview},
    {
      tenantId:'00000000-0000-4000-8000-000000000001',
      workspaceId:'00000000-0000-4000-8000-000000000001',
      quarantineId:'00000000-0000-4000-8000-000000000002',
      envelopeSha256:fixture.sha256,
      artifactId:'to-generated-synthetic-v1',
      issuerKeyId:'to-candidate-synthetic-key',
      signatureValid:true,aeadValid:true,schemaMapped:true,entitled:true,
    },
  );
  assert.equal(proposed.executable,false);
  assert.equal(proposed.requiresHumanApproval,true);
});
