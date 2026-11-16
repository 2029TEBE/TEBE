// Explicit ORGAIZ OIDC provider onboarding contract. No discovery fetch, dynamic
// redirects, client credentials, API routes, or activation from environment defaults.
// Metadata must be obtained out-of-band and approved by an operator.
const reject = reason => { throw new Error('Unapproved ORGAIZ identity provider: ' + reason); };
const allowedKeys = (obj, keys) => obj && typeof obj==='object' && !Array.isArray(obj) &&
  Object.keys(obj).every(k=>keys.includes(k));
function httpsUrl(value, {allowPath=true}={}) {
  if(typeof value!=='string'||value.length>2048)reject('URL');
  let url;try { url=new URL(value); } catch { reject('URL'); }
  if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||
     !url.hostname||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||
     url.hostname.endsWith('.local')||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)||
     url.hostname.includes(':')||url.port||(url.toString()!==value && !(url.pathname==='/'&&url.toString()===value+'/'))||
     (!allowPath&&url.pathname!=='/'))reject('HTTPS endpoint');
  return url;
}
function oidcString(s,max=256) {
  return typeof s==='string'&&s.length>0&&s.length<=max&&!/[\x00-\x1f\x7f]/.test(s);
}
export function validateOrgaizProviderOnboarding({approval,metadata}={}){
  if(!allowedKeys(approval,['status','issuer','clientId','redirectUri','reviewId','approvedBy','allowedJwksUri'])||
     approval.status!=='approved'||!oidcString(approval.reviewId,128)||
     !oidcString(approval.approvedBy,128)||!oidcString(approval.clientId,160))reject('operator approval');
  const issuer=httpsUrl(approval.issuer);
  const redirect=httpsUrl(approval.redirectUri);
  const jwks=httpsUrl(approval.allowedJwksUri);
  // Never allow an unreviewed endpoint to be fetched from token/header contents.
  if(!allowedKeys(metadata,[
    'issuer','authorization_endpoint','token_endpoint','jwks_uri',
    'response_types_supported','grant_types_supported','code_challenge_methods_supported',
    'id_token_signing_alg_values_supported','token_endpoint_auth_methods_supported'
  ]))reject('metadata shape');
  if(metadata.issuer!==approval.issuer||metadata.jwks_uri!==approval.allowedJwksUri)reject('issuer or JWKS mismatch');
  const auth=httpsUrl(metadata.authorization_endpoint);
  const token=httpsUrl(metadata.token_endpoint);
  if(auth.origin!==issuer.origin||token.origin!==issuer.origin)reject('issuer origin mismatch');
  // JWKS may use a provider-managed host, but only the exact explicitly approved URI.
  if(!jwks||metadata.jwks_uri!==jwks.toString())reject('unapproved trust source');
  if(!Array.isArray(metadata.response_types_supported)||!metadata.response_types_supported.includes('code')||
     !Array.isArray(metadata.code_challenge_methods_supported)||!metadata.code_challenge_methods_supported.includes('S256')||
     !Array.isArray(metadata.id_token_signing_alg_values_supported)||
     !metadata.id_token_signing_alg_values_supported.some(x=>x==='RS256'||x==='EdDSA')||
     (metadata.grant_types_supported!==undefined&&(!Array.isArray(metadata.grant_types_supported)||
       !metadata.grant_types_supported.includes('authorization_code'))))reject('unsupported OIDC capability');
  if(metadata.token_endpoint_auth_methods_supported!==undefined &&
     (!Array.isArray(metadata.token_endpoint_auth_methods_supported)||
      !metadata.token_endpoint_auth_methods_supported.some(x=>['client_secret_basic','private_key_jwt','none'].includes(x))))reject('token authentication');
  return Object.freeze({
    status:'reviewed-not-active',
    reviewId:approval.reviewId,
    issuer:approval.issuer,
    clientId:approval.clientId,
    redirectUri:redirect.toString(),
    authorizationEndpoint:auth.toString(),
    tokenEndpoint:token.toString(),
    jwksUri:jwks.toString(),
    responseType:'code',
    pkceMethod:'S256',
    acceptedIdTokenAlgorithms:Object.freeze(metadata.id_token_signing_alg_values_supported.filter(x=>x==='RS256'||x==='EdDSA'))
  });
}
