// REVIEW-ONLY ORGAIZ first-party HTTP authentication boundary.
// Framework-neutral and NOT mounted in NestJS. EPMO auth is deliberately untouched.
// Trusted OIDC broker and DB session service must be injected server-side.
import {randomBytes,timingSafeEqual} from 'node:crypto';

const deny=()=>{throw Error('ORGAIZ authentication unavailable')};
const SESSION='__Host-orgaiz_session';
const LOGIN='__Host-orgaiz_login';
const CSRF='__Host-orgaiz_csrf';
const opaque=/^[A-Za-z0-9_-]{43}$/;
const session=/^ogs1\.[A-Za-z0-9_-]{43}$/;
const equal=(x,y)=>typeof x==='string'&&typeof y==='string'&&
 x.length===y.length&&timingSafeEqual(Buffer.from(x),Buffer.from(y));
function exactOrigin(url) {
 if(typeof url!=='string')deny();
 let o;try{o=new URL(url)}catch{deny()}
 if(o.protocol!=='https:'||o.username||o.password||o.pathname!=='/'||
  o.search||o.hash||url!==o.origin)deny();
 return o.origin;
}
function cookies(req) {
 if(!req||!req.cookies||typeof req.cookies!=='object')deny();
 return req.cookies;
}
function setNoStore(res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Pragma','no-cache');
 res.setHeader('Vary','Cookie, Origin');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
}
function secureOptions(extra={}) {
 return {httpOnly:true,secure:true,sameSite:'lax',path:'/',...extra};
}
function security(req,siteOrigin) {
 if(req?.secure!==true)deny();
 const host=req.get?.('host');
 const expectedHost=new URL(siteOrigin).host;
 if(host!==expectedHost)deny();
}
function sameOrigin(req,siteOrigin) {
 security(req,siteOrigin);
 if(req.get?.('origin')!==siteOrigin)deny();
 // CSRF double-submit token alone is not enough; require the Origin check
 // and a non-simple custom header. Actual gateway must block CORS elsewhere.
 const c=cookies(req);
 if(!opaque.test(c[CSRF]||'')||!equal(req.get?.('x-orgaiz-csrf'),c[CSRF]))deny();
}
function json(res,body) {res.json(body)}
/**
 * Returned handlers are NOT Express route registrations. Operator must mount
 * them only on a reviewed first-party HTTPS host after authenticating broker
 * configuration, durable DB adapter, privacy and session-cookie policy.
 */
export function createGaizStandaloneHttpBoundary({
 enabled=false,siteOrigin,broker,callback,sessionService
}={}){
 if(enabled!==true||!broker||typeof broker.begin!=='function'||
 !callback||typeof callback.finishAndIssueCookieMaterial!=='function'||
 !sessionService||typeof sessionService.requireCustomer!=='function'||
 typeof sessionService.revoke!=='function'||typeof sessionService.revokeAll!=='function')deny();
 const origin=exactOrigin(siteOrigin);
 return Object.freeze({
  async begin(req,res) {
   setNoStore(res);
   // Login initiation is a POST, bound to first-party Origin, and cannot use
   // an existing session cookie to skip state/PKCE verification.
   security(req,origin);
   if(req.get?.('origin')!==origin)deny();
   const binding=randomBytes(32).toString('base64url');
   const started=await broker.begin({sessionBinding:binding});
   if(!started||typeof started.authorizationUrl!=='string'||
    !Number.isSafeInteger(started.expiresAt))deny();
   res.cookie(LOGIN,binding,secureOptions({maxAge:600000}));
   res.redirect(303,started.authorizationUrl);
  },
  async oidcCallback(req,res) {
   setNoStore(res);
   security(req,origin);
   // Third-party OIDC redirects do not carry an Origin header; state/nonce,
   // issuer and browser-bound transaction are checked by the trusted broker.
   const query=req.query;
   const c=cookies(req);
   const binding=c[LOGIN];
   // Always clear the pre-login cookie regardless of success/failure.
   res.clearCookie(LOGIN,secureOptions());
   if(!query||typeof query!=='object'||Object.keys(query).sort().join(',')!=='code,state'||
      !opaque.test(binding||'')||typeof query.state!=='string'||
      !opaque.test(query.state)||typeof query.code!=='string'||
      query.code.length<16||query.code.length>2048)deny();
   const minted=await callback.finishAndIssueCookieMaterial({
     state:query.state,code:query.code,sessionBinding:binding
   });
   if(!minted||!session.test(minted.token)||
    !Number.isSafeInteger(minted.expiresAt))deny();
   const seconds=Math.floor(Date.now()/1000);
   const maxAge=Math.min(86400000,(minted.expiresAt-seconds)*1000);
   if(maxAge<=0)deny();
   res.cookie(SESSION,minted.token,secureOptions({maxAge}));
   // Client-readable CSRF nonce is safe only in conjunction with strict
   // same-origin request checks and HttpOnly protected session cookie.
   res.cookie(CSRF,randomBytes(32).toString('base64url'),{
      httpOnly:false,secure:true,sameSite:'lax',path:'/',maxAge
   });
   res.redirect(303,origin+'/account');
  },
  async current(req,res) {
   setNoStore(res);security(req,origin);
   const token=cookies(req)[SESSION];
   if(!session.test(token||''))return json(res,{authenticated:false});
   try {
    const p=await sessionService.requireCustomer(token);
    return json(res,{authenticated:true,identityProvider:'oidc',
     customerId:p.customerId,gaizEntitled:false,
     gaizDownloadAuthorized:false,gaizImportAuthorized:false});
   }catch {return json(res,{authenticated:false})}
  },
  async logout(req,res) {
   setNoStore(res);sameOrigin(req,origin);
   const token=cookies(req)[SESSION];
   if(session.test(token||''))await sessionService.revoke(token);
   res.clearCookie(SESSION,secureOptions());
   res.clearCookie(CSRF,{secure:true,sameSite:'lax',path:'/'});
   return json(res,{ok:true});
  },
  async logoutAll(req,res) {
   setNoStore(res);sameOrigin(req,origin);
   const token=cookies(req)[SESSION];
   if(!session.test(token||''))deny();
   await sessionService.revokeAll(token);
   res.clearCookie(SESSION,secureOptions());
   res.clearCookie(CSRF,{secure:true,sameSite:'lax',path:'/'});
   return json(res,{ok:true});
  }
 });
}
