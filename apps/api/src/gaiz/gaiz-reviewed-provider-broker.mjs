// The only bridge from reviewed provider metadata to the existing
// authorization-code/PKCE core. Still NO HTTP route, login session or key store.
import {validateOrgaizProviderOnboarding} from './gaiz-oidc-provider-policy.mjs';
import {createStandaloneLoginBroker} from './gaiz-standalone-login-broker.mjs';

export function createReviewedStandaloneBroker({
 approval,metadata,store,exchangeCode,issuerKeyProvider,clock
}={}){
 const reviewed=validateOrgaizProviderOnboarding({approval,metadata});
 // No default discovery, token exchange or in-memory state store.
 // Production implementations must pin TLS, verify broker client credentials
 // and fetch JWKS using only reviewed.jwksUri with safe rotation and caching.
 if(typeof store?.put!=='function'||typeof store?.take!=='function'||
    typeof exchangeCode!=='function'||typeof issuerKeyProvider!=='function')
   throw Error('Approved OIDC broker dependencies are not configured');
 const broker=createStandaloneLoginBroker({
   issuer:reviewed.issuer,
   authorizationEndpoint:reviewed.authorizationEndpoint,
   redirectUri:reviewed.redirectUri,
   clientId:reviewed.clientId,
   store,exchangeCode,issuerKeyProvider,clock
 });
 return Object.freeze({
   providerStatus:reviewed.status,
   reviewId:reviewed.reviewId,
   begin:broker.begin,
   finish:broker.finish
 });
}
