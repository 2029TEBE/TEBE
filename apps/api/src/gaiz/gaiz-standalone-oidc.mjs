// Standalone ORGAIZ identity: OIDC ID-token validation ONLY.
// For use AFTER a server-to-server authorization-code exchange by an approved broker.
// Never accept this ID token as a direct bearer API credential or an EPMO tenant membership.
import {createPublicKey,verify as verifySignature} from 'node:crypto';

const denied=()=>{throw Error('Untrusted ORGAIZ customer identity')};
const id=x=>typeof x==='string'&&x.length>=1&&x.length<=256&&!/[\x00-\x1f\x7f]/.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function jsonPart(part){
 if(typeof part!=='string'||part.length<2||part.length>16384||!/^[A-Za-z0-9_-]+$/.test(part))denied();
 const bytes=Buffer.from(part,'base64url');
 if(bytes.toString('base64url')!==part)denied();
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{denied()}
 if(!object(value))denied();
 return value;
}
function validateConfig(cfg){
 if(!object(cfg)||!id(cfg.issuer)||!id(cfg.audience)||!id(cfg.expectedNonce)||
 !Array.isArray(cfg.trustedJwks)||cfg.trustedJwks.length<1||cfg.trustedJwks.length>20)denied();
 let origin;try{origin=new URL(cfg.issuer)}catch{denied()}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash)denied();
 if(!Number.isFinite(cfg.nowSeconds)||!Number.isSafeInteger(cfg.nowSeconds)||
 !Number.isSafeInteger(cfg.maxAgeSeconds)||cfg.maxAgeSeconds<60||cfg.maxAgeSeconds>3600)denied();
}
export function verifyStandaloneOidcIdentity(idToken,{
 issuer,audience,expectedNonce,trustedJwks,nowSeconds=Math.floor(Date.now()/1000),maxAgeSeconds=600
}={}){
 validateConfig({issuer,audience,expectedNonce,trustedJwks,nowSeconds,maxAgeSeconds});
 if(typeof idToken!=='string'||idToken.length>32768)denied();
 const pieces=idToken.split('.');
 if(pieces.length!==3||!pieces.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))denied();
 const [h,p,s]=pieces;
 const header=jsonPart(h),claims=jsonPart(p);
 if(!id(header.kid)||!['RS256','EdDSA'].includes(header.alg)||header.typ && header.typ!=='JWT'||
 'jku' in header||'jwk' in header||'x5u' in header||'crit' in header||'b64' in header)denied();
 const matches=trustedJwks.filter(k=>object(k)&&k.kid===header.kid&&k.alg===header.alg&&k.use==='sig'&&
 (header.alg==='RS256'?k.kty==='RSA':k.kty==='OKP'&&k.crv==='Ed25519'));
 if(matches.length!==1)denied();
 let publicKey;
 try{publicKey=createPublicKey({key:matches[0],format:'jwk'})}catch{denied()}
 if(header.alg==='RS256'&&(publicKey.asymmetricKeyType!=='rsa'||publicKey.asymmetricKeyDetails?.modulusLength<2048))denied();
 if(header.alg==='EdDSA'&&publicKey.asymmetricKeyType!=='ed25519')denied();
 const signature=Buffer.from(s,'base64url');
 if(signature.toString('base64url')!==s||signature.length<32)denied();
 let valid=false;
 try{valid=verifySignature(header.alg==='RS256'?'RSA-SHA256':null,
 Buffer.from(h+'.'+p),publicKey,signature)}catch{denied()}
 if(!valid)denied();
 const aud=claims.aud;
 if(claims.iss!==issuer||!(aud===audience||(Array.isArray(aud)&&aud.includes(audience)&&aud.length>0&&aud.every(id)))||
 (Array.isArray(aud)&&aud.length>1&&claims.azp!==audience)||
 !id(claims.sub)||!id(claims.nonce)||claims.nonce!==expectedNonce||
 !Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.iat)||
 !Number.isSafeInteger(claims.auth_time)||
 claims.iat>nowSeconds+60||claims.exp<=nowSeconds||claims.exp>nowSeconds+3600||
 claims.auth_time>nowSeconds+60||nowSeconds-claims.auth_time>maxAgeSeconds||
 claims.exp<=claims.iat)denied();
 // Email is OPTIONAL and untrusted unless email_verified is literally true.
 // Never use an email address as a global account or tenant key.
 const result={identityProvider:'oidc',issuer,subject:claims.sub,authenticatedAt:claims.auth_time,
 emailVerified:claims.email_verified===true};
 if(result.emailVerified&&typeof claims.email==='string'&&claims.email.length<=254)result.email=claims.email;
 return Object.freeze({...result,gaizEntitled:false,gaizDownloadAuthorized:false,gaizImportAuthorized:false,epmoTenantBound:false});
}
