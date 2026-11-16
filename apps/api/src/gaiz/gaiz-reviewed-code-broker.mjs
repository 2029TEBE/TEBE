// Connect independently reviewed OIDC provider policy, fixed HTTPS token
// redemption and single-use PKCE broker. Unregistered, disabled by default.
import {validateOrgaizProviderOnboarding} from './gaiz-oidc-provider-policy.mjs';
import {createReviewedStandaloneBroker} from './gaiz-reviewed-provider-broker.mjs';
import {createGaizOidcCodeExchange} from './gaiz-oidc-code-exchange.mjs';

export function createGaizReviewedCodeBroker({
 enabled=false,approval,metadata,clientSecret,fetchImpl,
 store,issuerKeyProvider,clock
}={}){
 if(enabled!==true)throw Error('ORGAIZ OIDC broker is disabled');
 // Approval MUST originate from reviewed server configuration only, never
 // from an HTTP body, arbitrary browser issuer or token supplied JWKS URL.
 const reviewed=validateOrgaizProviderOnboarding({approval,metadata});
 const exchangeCode=createGaizOidcCodeExchange({
  enabled:true,provider:reviewed,clientSecret,fetchImpl
 });
 const broker=createReviewedStandaloneBroker({
  approval,metadata,store,exchangeCode,issuerKeyProvider,clock
 });
 return Object.freeze({
  providerStatus:'reviewed-not-active',
  reviewId:reviewed.reviewId,
  begin:broker.begin,
  finish:broker.finish
 });
}
