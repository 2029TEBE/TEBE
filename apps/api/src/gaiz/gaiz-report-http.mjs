// Unmounted HTTP adapter for standalone ORGAIZ customer reports.
// DO NOT attach this to EPMO AuthController or tenant middleware.
// HTTPS reverse-proxy trust, trusted auth cookies and rate limits are required.
const fail=()=>{throw Error('GIZE AI report service unavailable')};
const sessionCookie='__Host-orgaiz_session';
const csrfCookie='__Host-orgaiz_csrf';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i.test(x);
function origin(x){
 let u;try{u=new URL(x)}catch{fail()}
 if(u.protocol!=='https:'||u.origin!==x||u.port||
    u.username||u.password)fail();
 return x;
}
export function createGaizReportHttpHandlers({
 enabled=false,siteOrigin,service,productResolver
}={}){
 if(enabled!==true||!service||
    ['catalogue','submit','status','download'].some(k=>typeof service[k]!=='function')||
    typeof productResolver!=='function')fail();
 const site=origin(siteOrigin);
 function secure(req){
  if(!req||req.secure!==true||req.get?.('host')!==new URL(site).host)fail();
 }
 function post(req){
  secure(req);
  if(req.get?.('origin')!==site||req.get?.('content-type')!=='application/json')fail();
  const cookie=req.cookies?.[csrfCookie],header=req.get?.('x-orgaiz-csrf');
  if(typeof cookie!=='string'||!/^[-A-Za-z0-9_]{43}$/.test(cookie)||
     cookie!==header)fail();
 }
 const token=req=>req?.cookies?.[sessionCookie];
 const noStore=res=>{
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Vary','Cookie, Origin');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
 };
 return Object.freeze({
  async catalogue(req,res){
   secure(req);noStore(res);
   return res.json(await service.catalogue());
  },
  async submit(req,res){
   post(req);noStore(res);
   const b=req.body;
   if(!b||typeof b!=='object'||Array.isArray(b)||
      Object.keys(b).sort().join(',')!=='idempotencyKey,orderId,request'||
      !uuid(b.orderId))fail();
   // No trusted prices or entitlements are ever accepted from JSON.
   const trusted=await productResolver({orderId:b.orderId,toolId:b.request?.toolId});
   if(!trusted||typeof trusted!=='object'||!trusted.product||
      !trusted.policy)fail();
   const result=await service.submit({
    sessionToken:token(req),orderId:b.orderId,request:b.request,
    idempotencyKey:b.idempotencyKey,
    serverProduct:trusted.product,serverPolicy:trusted.policy
   });
   return res.status(202).json(result);
  },
  async status(req,res){
   secure(req);noStore(res);
   if(!uuid(req.params?.jobId))fail();
   return res.json(await service.status({
    sessionToken:token(req),jobId:req.params.jobId
   }));
  },
  async download(req,res){
   secure(req);noStore(res);
   if(!uuid(req.params?.jobId)||!uuid(req.params?.artifactId))fail();
   const report=await service.download({
    sessionToken:token(req),jobId:req.params.jobId,
    artifactId:req.params.artifactId
   });
   // No inline HTML or public object URLs: always force attachment.
   const filename=report.filename;
   if(!/^gaiz-report\.(pdf|html|gaiz)$/.test(filename))fail();
   res.setHeader('Content-Type',report.contentType);
   res.setHeader('Content-Disposition','attachment; filename="'+filename+'"');
   res.setHeader('Content-Length',String(report.bytes.length));
   return res.end(report.bytes);
  }
 });
}
