import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {verifyGaizSignedWorkloadCredential} from './gaiz-signed-workload-credential.mjs';
const issuer=generateKeyPairSync('ed25519');
const workerId='33333333-3333-4333-8333-333333333333';
const nowMs=1800000000050;
const challenge=randomBytes(32).toString('base64url');
const claims=()=>({
 version:1,issuerId:'trusted-synthetic-credential-issuer',
 workerId,role:'gaiz_verify_worker',challenge,
 issuedAtMs:1800000000000,expiresAtMs:1800000030000,
});
const canon=x=>'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+JSON.stringify(x[k])).join(',')+'}';
const encode=x=>Buffer.from(x).toString('base64url');
const token=(c=claims(),privateKey=issuer.privateKey)=>{
 const signature=sign(null,Buffer.from('GAIZ_WORKLOAD_CREDENTIAL_V1\n'+canon(c)),privateKey).toString('base64url');
 return encode(JSON.stringify({claims:c,signature}));
};
const options=()=>({
 trustedCredentialIssuerPublicKey:issuer.publicKey,
 expectedIssuerId:'trusted-synthetic-credential-issuer',
 expectedWorkerId:workerId,expectedPurpose:'gaiz_verify_worker',
 expectedChallenge:challenge,nowMs,
});
const inDev=fn=>{const node=process.env.NODE_ENV,flag=process.env.GAIZ_DEV_ONLY;try{
 process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='true';return fn();
}finally{
 if(node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=node;
 if(flag===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=flag;
}};
test('short-lived independently signed challenge-bound credential is inert',()=>inDev(()=>{
 const r=verifyGaizSignedWorkloadCredential(token(),options());
 assert.equal(r.workerId,workerId);
 assert.equal(r.role,'gaiz_verify_worker');
 assert.equal(r.atomicChallengeClaimRequired,true);
 assert.equal(r.independentTransportAuthenticationRequired,true);
 assert.equal(r.importAllowed,false);assert.equal(Object.isFrozen(r),true);
}));
test('wrong challenge, worker, issuer, signing key, purpose, expiry fail closed',()=>inDev(()=>{
 const bad=[
  {...options(),expectedChallenge:randomBytes(32).toString('base64url')},
  {...options(),expectedWorkerId:'22222222-2222-4222-8222-222222222222'},
  {...options(),expectedIssuerId:'untrusted-issuer'},
  {...options(),expectedPurpose:'gaiz_execute_worker'},
  {...options(),trustedCredentialIssuerPublicKey:generateKeyPairSync('ed25519').publicKey},
  {...options(),nowMs:1800000030000},
 ];
 for(const o of bad)assert.throws(()=>verifyGaizSignedWorkloadCredential(token(),o));
 assert.throws(()=>verifyGaizSignedWorkloadCredential(token({...claims(),role:'gaiz_execute_worker'}),options()));
 assert.throws(()=>verifyGaizSignedWorkloadCredential(token({...claims(),expiresAtMs:1800000200000}),options()));
 assert.throws(()=>verifyGaizSignedWorkloadCredential(token({...claims(),workerId:'22222222-2222-4222-8222-222222222222'}),options()));
}));
test('noncanonical envelope, extras and a modified signature are rejected',()=>inDev(()=>{
 const raw=Buffer.from(token(),'base64url').toString('utf8');
 assert.throws(()=>verifyGaizSignedWorkloadCredential(encode(' '+raw),options()));
 assert.throws(()=>verifyGaizSignedWorkloadCredential(encode(raw.replace('"version":1','"version":1,"version":1')),options()));
 assert.throws(()=>verifyGaizSignedWorkloadCredential(token({...claims(),admin:true}),options()));
 assert.throws(()=>verifyGaizSignedWorkloadCredential('invalid!',options()));
 const other=generateKeyPairSync('ed25519');
 assert.throws(()=>verifyGaizSignedWorkloadCredential(token(claims(),other.privateKey),options()));
}));
test('production and disabled modes forbid credential verification',()=>{
 const node=process.env.NODE_ENV,flag=process.env.GAIZ_DEV_ONLY;
 try{
 process.env.NODE_ENV='production';process.env.GAIZ_DEV_ONLY='true';
 assert.throws(()=>verifyGaizSignedWorkloadCredential(token(),options()));
 process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='false';
 assert.throws(()=>verifyGaizSignedWorkloadCredential(token(),options()));
 }finally{
 if(node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=node;
 if(flag===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=flag;
 }
});
