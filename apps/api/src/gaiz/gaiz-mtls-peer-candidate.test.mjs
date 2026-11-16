import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash,generateKeyPairSync,randomBytes,sign,X509Certificate} from 'node:crypto';
import {createServer,connect,TLSSocket} from 'node:tls';
import {verifyGaizMtlsPeerCandidate} from './gaiz-mtls-peer-candidate.mjs';
import {bindGaizMtlsSignedCredentialCandidate} from './gaiz-mtls-signed-credential-candidate.mjs';

const workerId='33333333-3333-4333-8333-333333333333';
const expectedRole='gaiz_verify_worker';
const priorDev=()=>[process.env.NODE_ENV,process.env.GAIZ_DEV_ONLY];
const restore=([node,flag])=>{
 if(node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=node;
 if(flag===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=flag;
};
const canonical=o=>'{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+JSON.stringify(o[k])).join(',')+'}';
const b64=b=>Buffer.from(b).toString('base64url');
const signedCredential=(issuer,challenge,nowMs,change={})=>{
 const claims={version:1,issuerId:'independent-issuer',workerId,
  role:expectedRole,challenge,issuedAtMs:nowMs-1000,expiresAtMs:nowMs+15000,...change};
 return b64(JSON.stringify({claims,signature:b64(sign(null,
  Buffer.from('GAIZ_WORKLOAD_CREDENTIAL_V1\n'+canonical(claims)),issuer.privateKey))}));
};

/** All certs and private keys are ephemeral and stored only in an OS temp dir. */
async function withLocalMtls(run){
 const dir=mkdtempSync(join(tmpdir(),'gaiz-mtls-'));
 let server,client;
 try{
  const issue=(name,cn)=>{
   const key=join(dir,name+'.key'),cert=join(dir,name+'.crt');
   execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes',
    '-keyout',key,'-out',cert,'-days','2','-subj','/CN='+cn,
    '-addext','subjectAltName=DNS:'+cn],{stdio:'ignore',timeout:15000});
   return {key:readFileSync(key),cert:readFileSync(cert)};
  };
  const serverIdentity=issue('server','localhost');
  const workerIdentity=issue('worker','worker.local');
  const peerCert=new X509Certificate(workerIdentity.cert);
  const fingerprint=createHash('sha256').update(peerCert.raw).digest('hex');
  const nowMs=Date.now();
  const entry={workerId,role:expectedRole,credentialIssuer:'synthetic-mtls-CA',
   notBeforeMs:nowMs-30000,expiresAtMs:nowMs+60000,revoked:false};
  const registry=new Map([[fingerprint,entry]]);
  server=createServer({key:serverIdentity.key,cert:serverIdentity.cert,
   ca:[workerIdentity.cert],requestCert:true,rejectUnauthorized:true,
   minVersion:'TLSv1.3',maxVersion:'TLSv1.3'});
  await new Promise((resolve,reject)=>{
   server.once('error',reject);
   server.listen(0,'127.0.0.1',resolve);
  });
  const result=new Promise((resolve,reject)=>{
   server.once('secureConnection',socket=>{
    try{resolve(run({socket,nowMs,registry,fingerprint,entry}));}
    catch(error){reject(error);}
    finally{socket.destroy();}
   });
   server.once('tlsClientError',reject);
  });
  client=connect({host:'127.0.0.1',port:server.address().port,
   key:workerIdentity.key,cert:workerIdentity.cert,
   ca:[serverIdentity.cert],servername:'localhost',
   rejectUnauthorized:true,minVersion:'TLSv1.3',maxVersion:'TLSv1.3'});
  client.on('error',()=>{}); // result listener handles the handshake failures
  return await result;
 }finally{
  client?.destroy();
  if(server)await new Promise(resolve=>server.close(()=>resolve()));
  rmSync(dir,{recursive:true,force:true});
 }
}

test('real Node TLS 1.3 mTLS handshake identifies pinned verifier certificate',async()=>{
 const prior=priorDev();
 process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='true';
 try{
  await withLocalMtls(({socket,nowMs,registry,fingerprint})=>{
   assert.equal(socket instanceof TLSSocket,true);
   assert.equal(socket.authorized,true);
   const result=verifyGaizMtlsPeerCandidate(socket,{trustedPeers:registry,nowMs});
   assert.equal(result.workerId,workerId);
   assert.equal(result.role,expectedRole);
   assert.equal(result.certificateSha256,fingerprint);
   assert.equal(result.authorizationGranted,false);
   assert.equal(result.importAllowed,false);
  });
 }finally{restore(prior)}
});

test('real mTLS plus independently signed challenge credential yields inert evidence',async()=>{
 const prior=priorDev();
 process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='true';
 try{
  await withLocalMtls(({socket,nowMs,registry})=>{
   const issuer=generateKeyPairSync('ed25519');
   const challenge=randomBytes(32).toString('base64url');
   const result=bindGaizMtlsSignedCredentialCandidate(socket,{
    trustedPeers:registry,nowMs,
    trustedCredentialIssuerPublicKey:issuer.publicKey,
    expectedCredentialIssuerId:'independent-issuer',
    expectedChallenge:challenge,
    signedWorkloadCredential:signedCredential(issuer,challenge,nowMs),
   });
   assert.equal(result.workerId,workerId);
   assert.equal(result.authenticatedTransportEvidence,true);
   assert.equal(result.challengeClaimRequired,true);
   assert.equal(result.assignmentClaimRequired,true);
   assert.equal(result.importAllowed,false);
   assert.equal(Object.hasOwn(result,'key'),false);
  });
 }finally{restore(prior)}
});

test('wrong worker registry, revoked and expired certificates fail closed',async()=>{
 const prior=priorDev();
 process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='true';
 try{
  await withLocalMtls(({socket,nowMs,registry,entry})=>{
   assert.throws(()=>verifyGaizMtlsPeerCandidate(socket,{trustedPeers:new Map(),nowMs}));
   assert.throws(()=>verifyGaizMtlsPeerCandidate(socket,{
    trustedPeers:new Map([...registry].map(([k])=>[k,{...entry,revoked:true}])),nowMs,
   }));
   assert.throws(()=>verifyGaizMtlsPeerCandidate(socket,{
    trustedPeers:new Map([...registry].map(([k])=>[k,{...entry,expiresAtMs:nowMs}])),nowMs,
   }));
   assert.throws(()=>verifyGaizMtlsPeerCandidate({
    authorized:true,encrypted:true,getPeerCertificate:()=>({raw:Buffer.alloc(1000)}),
   },{trustedPeers:registry,nowMs}));
  });
 }finally{restore(prior)}
});

test('signed credential mismatches fail after independently authorized TLS peer',async()=>{
 const prior=priorDev();
 process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='true';
 try{
  await withLocalMtls(({socket,nowMs,registry})=>{
   const issuer=generateKeyPairSync('ed25519'),challenge=randomBytes(32).toString('base64url');
   const base={trustedPeers:registry,nowMs,
    trustedCredentialIssuerPublicKey:issuer.publicKey,
    expectedCredentialIssuerId:'independent-issuer',
    expectedChallenge:challenge,
    signedWorkloadCredential:signedCredential(issuer,challenge,nowMs)};
   for(const diff of [
    {expectedChallenge:randomBytes(32).toString('base64url')},
    {signedWorkloadCredential:signedCredential(issuer,challenge,nowMs,{role:'gaiz_execute_worker'})},
    {signedWorkloadCredential:signedCredential(issuer,challenge,nowMs,{workerId:'22222222-2222-4222-8222-222222222222'})},
    {trustedCredentialIssuerPublicKey:generateKeyPairSync('ed25519').publicKey},
   ])assert.throws(()=>bindGaizMtlsSignedCredentialCandidate(socket,{...base,...diff}));
  });
 }finally{restore(prior)}
});

test('production cannot authorize TLS peer even when registry and handshake are valid',async()=>{
 const prior=priorDev();
 process.env.NODE_ENV='production';process.env.GAIZ_DEV_ONLY='true';
 try{await withLocalMtls(({socket,nowMs,registry})=>{
  assert.throws(()=>verifyGaizMtlsPeerCandidate(socket,{trustedPeers:registry,nowMs}));
 });}finally{restore(prior)}
});
