// Standalone ORGAIZ OIDC authorization-code redemption.
// DISABLED by default. Requires independently approved provider configuration,
// injected server-only credentials and transport. NEVER a browser call.
const fail=()=>{throw Error('ORGAIZ OIDC code exchange unavailable')};
const safe=x=>typeof x==='string'&&x.length>0&&x.length<=256&&!/[\x00-\x1f\x7f]/.test(x);
const opaque=x=>typeof x==='string'&&x.length>=16&&x.length<=2048&&/^[A-Za-z0-9_.~-]+$/.test(x);
const verifier=x=>typeof x==='string'&&x.length>=43&&x.length<=128&&/^[A-Za-z0-9_.~-]+$/.test(x);
const exactHttps=value=>{
 if(typeof value!=='string')fail();
 let u;try{u=new URL(value)}catch{fail()}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||u.port||
    u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.localhost')||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.hostname)||u.hostname.includes(':'))fail();
 return u.toString();
};
async function boundedBody(response,maxBytes) {
 const header=response.headers?.get?.('content-length');
 if(header!=null&&(!/^\d+$/.test(header)||Number(header)>maxBytes))fail();
 // Do not use response.text() before limiting bytes: it can buffer arbitrarily.
 if(!response.body?.getReader)fail();
 const reader=response.body.getReader(),pieces=[];
 let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))fail();
   total+=value.byteLength;
   if(total>maxBytes)fail();
   pieces.push(value);
  }
 }finally{try{await reader.cancel()}catch{}}
 const all=new Uint8Array(total);
 let offset=0;for(const p of pieces){all.set(p,offset);offset+=p.byteLength}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all))}catch{fail()}
}
export function createGaizOidcCodeExchange({
 enabled=false,provider,clientSecret,fetchImpl,maxResponseBytes=32768
}={}){
 if(enabled!==true||!provider||provider.status!=='candidate-reviewed-not-active'&&
    provider.status!=='reviewed-not-active'||!safe(provider.clientId)||
    !safe(clientSecret)||clientSecret.length<24||clientSecret.length>2048||
    typeof fetchImpl!=='function'||!Number.isSafeInteger(maxResponseBytes)||
    maxResponseBytes<1024||maxResponseBytes>65536)fail();
 const endpoint=exactHttps(provider.tokenEndpoint);
 const issuer=exactHttps(provider.issuer);
 const redirect=exactHttps(provider.redirectUri);
 if(new URL(endpoint).origin!==new URL(issuer).origin)fail();
 // client_secret_basic is the only supported auth method in this adapter;
 // other modes (private_key_jwt etc.) need their own independently reviewed code.
 const authorization='Basic '+Buffer.from(
   encodeURIComponent(provider.clientId)+':'+encodeURIComponent(clientSecret)
 ).toString('base64');
 return async function exchangeCode({code,codeVerifier,clientId,redirectUri}={}){
  if(!opaque(code)||!verifier(codeVerifier)||clientId!==provider.clientId||
     redirectUri!==provider.redirectUri)fail();
  const body=new URLSearchParams({
   grant_type:'authorization_code',code,redirect_uri:redirectUri,
   client_id:clientId,code_verifier:codeVerifier
  }).toString();
  let response;
  try{
   response=await fetchImpl(endpoint,{
    method:'POST',
    redirect:'error',
    cache:'no-store',
    credentials:'omit',
    referrerPolicy:'no-referrer',
    headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded',
      Authorization:authorization},
    body,
    signal:AbortSignal.timeout(10000)
   });
  }catch{fail()}
  if(!response||response.status!==200||response.ok!==true)fail();
  if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')||''))fail();
  const data=await boundedBody(response,maxResponseBytes);
  if(!data||typeof data!=='object'||Array.isArray(data)||
     typeof data.id_token!=='string'||data.id_token.length<50||
     data.id_token.length>16384||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(data.id_token)||
     data.token_type!=='Bearer')fail();
  // Access/refresh tokens are never returned to browser or caller.
  return Object.freeze({idToken:data.id_token});
 };
}
