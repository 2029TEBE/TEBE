#!/usr/bin/env node
// S21: join integrity and freshness contracts; offline-only, never operational acceptance.
import { verifyBundle } from './servitro-evidence-bundle.mjs';
import { checkEvidenceFreshness } from './servitro-evidence-freshness.mjs';
const sha=/^[a-f0-9]{40}$/;
const digest=/^sha256:[a-f0-9]{64}$/;
export function checkReleaseBinding({manifest,metadata,load,expectedSha,expectedImageDigest,now}={}) {
 const errors=[];
 if(typeof expectedSha!=='string'||!sha.test(expectedSha)) errors.push('expected-sha');
 if(typeof expectedImageDigest!=='string'||!digest.test(expectedImageDigest)) errors.push('expected-image-digest');
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||manifest.releaseSha!==expectedSha) errors.push('manifest-sha-mismatch');
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata)||metadata.releaseSha!==expectedSha) errors.push('metadata-sha-mismatch');
 if(metadata?.imageDigest!==expectedImageDigest) errors.push('image-digest-mismatch');
 // Caller-provided file bytes are untrusted. Never treat passing checks as provider attestation.
 let integrity={accepted:false,errors:['not-run']};
 try { integrity=verifyBundle(manifest,load); } catch { errors.push('integrity-error'); }
 let freshness={accepted:false,errors:['not-run']};
 try { freshness=checkEvidenceFreshness(metadata,now); } catch { errors.push('freshness-error'); }
 if(!integrity.accepted) errors.push('integrity-rejected');
 if(!freshness.accepted) errors.push('freshness-rejected');
 return {accepted:errors.length===0,errors,integrityErrors:integrity.errors??[],freshnessErrors:freshness.errors??[],operationallyVerified:false,deploymentAuthorized:false};
}
