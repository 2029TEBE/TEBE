// Server-side ONLY: connect independently verified authorization-code callback
// with the ORGAIZ session service. No public HTTP route is registered.
export function createGaizOidcSessionCallback({broker,sessionService}={}){
 if(!broker||typeof broker.finish!=='function'||!sessionService||
    typeof sessionService.issueFromTrustedCallback!=='function')
   throw Error('Verified ORGAIZ callback dependencies unavailable');
 return Object.freeze({
  async finishAndIssueCookieMaterial({state,code,sessionBinding}={}){
   // The approved broker MUST perform atomic state take, PKCE exchange and
   // independently trusted signature/issuer/audience/nonce verification.
   const identity=await broker.finish({state,code,sessionBinding});
   if(!identity||identity.identityProvider!=='oidc'||identity.epmoTenantBound!==false||
      identity.gaizEntitled!==false||identity.gaizDownloadAuthorized!==false||
      identity.gaizImportAuthorized!==false)
     throw Error('Untrusted ORGAIZ callback result');
   // Issue ONLY from a trusted server callback; never expose the returned
   // token via JSON, URL, log, localStorage or a frontend script.
   return sessionService.issueFromTrustedCallback({identity,callbackVerified:true});
  }
 });
}
