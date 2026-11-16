// Standalone ORGAIZ OIDC authorization-code + S256 PKCE transaction core.
// Integration-only: no HTTP controller, session cookie, provider connection, DB or billing.
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {verifyStandaloneOidcIdentity} from './gaiz-standalone-oidc.mjs';
const deny=()=>{throw Error('Invalid or expired standalone login transaction')};
const id=x=>typeof x==='string'&&x.length>=16&&x.length<=256&&/^[A-Za-z0-9_-]+$/.test(x);
const b64=x=>Buffer.from(x).toString('base64url');
const sha=x=>createHash('sha256').update(x).digest();
const exactHttps=x=>{
 if(typeof x!=='string')deny();
 let u;try{u=new URL(x)}catch{deny()}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search)deny();
 return u.toString();
};
const opaqueMatch=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(sha(a),sha(b));
export function createStandaloneLoginBroker({
 issuer,authorizationEndpoint,redirectUri,clientId,
 store,exchangeCode,issuerKeyProvider,clock=()=>Math.floor(Date.now()/1000)
}={}){
 const issuerUrl=exactHttps(issuer),authorization=exactHttps(authorizationEndpoint),redirect=exactHttps(redirectUri);
 if(typeof clientId!=='string'||clientId.length<1||clientId.length>160||
 !store||typeof store.put!=='function'||typeof store.take!=='function'||
 typeof exchangeCode!=='function'||typeof issuerKeyProvider!=='function'||typeof clock!=='function')deny();
 if(new URL(authorization).origin!==new URL(issuerUrl).origin)deny();
 // Real deployment must validate provider metadata and exact redirect URI out-of-band.
 return Object.freeze({
  async begin({sessionBinding}={}){
   if(!id(sessionBinding))deny();
   const state=b64(randomBytes(32)),nonce=b64(randomBytes(32)),verifier=b64(randomBytes(32));
   const challenge=b64(sha(verifier)),now=clock();
   if(!Number.isSafeInteger(now))deny();
   // A durable atomic single-use store is required in production.
   await store.put(b64(sha(state)),{
    sessionDigest:b64(sha(sessionBinding)),nonce,verifier,issuedAt:now,expiresAt:now+600
   },600);
   const url=new URL(authorization);
   url.searchParams.set('response_type','code');
   url.searchParams.set('client_id',clientId);
   url.searchParams.set('redirect_uri',redirect);
   url.searchParams.set('scope','openid');
   url.searchParams.set('state',state);
   url.searchParams.set('nonce',nonce);
   url.searchParams.set('code_challenge',challenge);
   url.searchParams.set('code_challenge_method','S256');
   return Object.freeze({authorizationUrl:url.toString(),expiresAt:now+600});
  },
  async finish({state,code,sessionBinding}={}){
   if(!id(state)||!id(sessionBinding)||!id(code)||code.length>2048)deny();
   // take() MUST atomically delete state even when the callback is invalid.
   const tx=await store.take(b64(sha(state)));
   if(!tx||typeof tx!=='object'||!opaqueMatch(tx.sessionDigest,b64(sha(sessionBinding)))||
      !Number.isSafeInteger(tx.issuedAt)||!Number.isSafeInteger(tx.expiresAt)||
      clock()<tx.issuedAt-60||clock()>=tx.expiresAt||
      !id(tx.nonce)||!id(tx.verifier))deny();
   const tokens=await exchangeCode({code,codeVerifier:tx.verifier,redirectUri:redirect,clientId});
   if(!tokens||typeof tokens.idToken!=='string')deny();
   // JWKS is server-managed; no artifact/browser token can define its own trust anchor.
   const trustedJwks=await issuerKeyProvider();
   const identity=verifyStandaloneOidcIdentity(tokens.idToken,{
    issuer:issuer,audience:clientId,expectedNonce:tx.nonce,
    trustedJwks,nowSeconds:clock(),maxAgeSeconds:600
   });
   // A separate server-side session and customer record MUST be created only
   // after verified consent, security policy and account mapping.
   return identity;
  }
 });
}
