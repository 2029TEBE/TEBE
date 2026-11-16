// GAIZ2 custodian mTLS transport — development-only, NO DECRYPTION.
// Caller injects a trusted server-side identity and fixed endpoint. Private
// client TLS identity key must be service-specific, never an RSA GAIZ content
// decryption key. This module sends ONLY metadata; no artifacts or plaintext.
import https from 'node:https';
import tls from 'node:tls';
import {createHash,X509Certificate} from 'node:crypto';
import {URL} from 'node:url';
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS=['tenantId','reviewId','artifactSha256','recipientKeyId','actorId','operation','custodianId','attemptId'];
function deny(){throw Error('Custodian mTLS transport refused');}
function checkClaim(claim){
 if(!claim||Object.getPrototypeOf(claim)!==Object.prototype||
   Object.keys(claim).sort().join('|')!==FIELDS.slice().sort().join('|'))deny();
 for(const field of ['tenantId','reviewId','attemptId','actorId'])
  if(typeof claim[field]!=='string'||!UUID.test(claim[field]))deny();
 if(typeof claim.artifactSha256!=='string'||!SHA.test(claim.artifactSha256))deny();
 for(const field of ['recipientKeyId','custodianId'])
  if(typeof claim[field]!=='string'||!ID.test(claim[field]))deny();
 if(claim.operation!=='validate-only-no-import')deny();
 return Object.freeze({...claim});
}
function pinOf(peer){
 if(!peer?.raw)deny();
 const cert=new X509Certificate(peer.raw);
 return createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('hex');
}
/**
 * Explicitly provisioned mTLS client configuration, never taken from HTTP,
 * environment URLs, or a browser. TLS PKI validation AND SPKI pin required.
 * No fallback to unauthenticated TLS or arbitrary DNS/IP addresses.
 */
export function makeCustodianMtlsTransport(config){
 if(process.env.NODE_ENV!=='development'||process.env.GAIZ_REMOTE_CUSTODY_TEST!=='true')deny();
 const {endpoint,ca,clientCert,clientKey,serverSpkiSha256,custodianId}=config??{};
 if(typeof endpoint!=='string'||!ca||!clientCert||!clientKey||
    typeof serverSpkiSha256!=='string'||!SHA.test(serverSpkiSha256)||
    typeof custodianId!=='string'||!ID.test(custodianId))deny();
 let url;
 try{url=new URL(endpoint);}catch{deny();}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
    url.pathname!=='/v1/gaiz/validate'||url.port&&url.port!=='443'||
    !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)||
    url.hostname.endsWith('.local')||url.hostname.endsWith('.internal'))deny();
 // Configured only by a privileged server-side process. No HTTP redirects.
 return Object.freeze({
  async requestAttestation(claim){
   const input=checkClaim(claim);
   if(input.custodianId!==custodianId)deny();
   const body=Buffer.from(JSON.stringify(input));
   if(body.length>4096)deny();
   return await new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(err,value)=>{
     if(settled)return;settled=true;
     if(err)reject(Error('Custodian mTLS validation unavailable'));
     else resolve(value);
    };
    const req=https.request(url,{
     method:'POST',
     ca,cert:clientCert,key:clientKey,
     minVersion:'TLSv1.3',rejectUnauthorized:true,
     headers:{'content-type':'application/json','content-length':String(body.length),
       'accept':'application/json','cache-control':'no-store'},
     timeout:5000,agent:false,
     checkServerIdentity(host,cert){
      const err=tls.checkServerIdentity(host,cert);
      if(err)return err;
      try{
       if(pinOf(cert)!==serverSpkiSha256)throw Error('SPKI mismatch');
      }catch{return Error('Custodian pin mismatch');}
      return undefined;
     },
    },res=>{
      if(res.statusCode!==200||!/^application\/json(?:;|$)/i.test(String(res.headers['content-type']??''))) {
       res.resume();finish(Error('Provider response denied'));return;
      }
      let received=0,chunks=[];
      res.on('data',chunk=>{
       received+=chunk.length;
       if(received>8192){req.destroy(Error('Oversized custody response'));return;}
       chunks.push(chunk);
      });
      res.on('error',()=>finish(Error('Custody response error')));
      res.on('end',()=>{
       try{
        const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        // Transport only: independently verify the signed response with
        // tenant trust directory in gaiz-custody-bridge.mjs.
        if(!payload||Object.getPrototypeOf(payload)!==Object.prototype||
           !payload.payload||typeof payload.signature!=='string')throw Error('Invalid response');
        finish(null,payload);
       }catch{finish(Error('Malformed provider response'));}
      });
    });
    req.on('timeout',()=>req.destroy(Error('Custodian timeout')));
    req.on('error',()=>finish(Error('Custodian connection error')));
    req.end(body);
   });
  },
 });
}
