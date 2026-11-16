// Auth0-specific candidate adapter for ORGAIZ standalone login.
// Inert: receives already-fetched, independently reviewed discovery metadata.
// Does NOT create tenants/clients, query the internet, store tokens, or grant permissions.
import {validateOrgaizProviderOnboarding} from './gaiz-oidc-provider-policy.mjs';
function deny(){throw Error('Unapproved Auth0 OIDC candidate')}
const knownMetadata=[
 'issuer','authorization_endpoint','token_endpoint','jwks_uri',
 'response_types_supported','grant_types_supported',
 'code_challenge_methods_supported','id_token_signing_alg_values_supported',
 'token_endpoint_auth_methods_supported'
];
export function validateAuth0Candidate({approval,discovery}={}){
 if(!approval||approval.provider!=='auth0'||approval.activation!=='disabled'||
    typeof approval.issuer!=='string'||!discovery||typeof discovery!=='object'||
    Array.isArray(discovery))deny();
 let issuer;
 try{issuer=new URL(approval.issuer)}catch{deny()}
 // Default Auth0 tenant host only; custom domains require separate independent review.
 if(issuer.protocol!=='https:'||!issuer.hostname.endsWith('.auth0.com')||
    issuer.hostname.split('.').length<3||issuer.pathname!=='/'||
    issuer.search||issuer.hash||issuer.username||issuer.password||issuer.port)deny();
 if(discovery.issuer!==approval.issuer)deny();
 const origin=issuer.origin;
 if(discovery.authorization_endpoint!==origin+'/authorize'||
    discovery.token_endpoint!==origin+'/oauth/token'||
    discovery.jwks_uri!==origin+'/.well-known/jwks.json')deny();
 // Discovery documents include vendor-specific fields. Project ONLY standard
 // allowlisted fields into our strict, provider-neutral approval validator.
 const metadata=Object.fromEntries(knownMetadata.filter(k=>Object.hasOwn(discovery,k)).map(k=>[k,discovery[k]]));
 const reviewed=validateOrgaizProviderOnboarding({
  approval:{
   status:'approved',reviewId:approval.reviewId,approvedBy:approval.approvedBy,
   issuer:approval.issuer,clientId:approval.clientId,
   redirectUri:approval.redirectUri,allowedJwksUri:approval.allowedJwksUri
  },metadata
 });
 if(!reviewed.acceptedIdTokenAlgorithms.includes('RS256'))deny();
 return Object.freeze({...reviewed,provider:'auth0',status:'candidate-reviewed-not-active',
   activation:'disabled'});
}
