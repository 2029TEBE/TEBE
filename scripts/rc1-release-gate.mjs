/** Paddle-only offline release preflight. No provider or database calls. */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseSimpleEnvFile(source) {
  if (typeof source !== 'string') throw Error('Invalid environment file');
  const values = {};
  for (const [index,line] of source.split(/\r?\n/).entries()) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(text);
    if (!match) throw Error('Invalid env syntax at line '+(index+1));
    if (Object.hasOwn(values,match[1])) throw Error('Duplicate env key '+match[1]);
    let value = match[2].trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const q = value[0], end = value.indexOf(q,1);
      if (end<0 || (value.slice(end+1).trim() && !value.slice(end+1).trim().startsWith('#')))
        throw Error('Invalid quoted env value');
      value = value.slice(1,end);
    } else value = value.split(/\s+#/)[0].trim();
    if (value.includes('$'+'{') || value.includes('$('))
      throw Error('Env interpolation prohibited');
    values[match[1]] = value;
  }
  return values;
}
const httpsOrigin = v => {
 try { const u=new URL(v); return u.protocol==='https:' && u.origin===v &&
  u.hostname!=='localhost' && !u.username && !u.password && !u.search && !u.hash; }
 catch {return false;}
};
const webhookValid=(api,url)=>{
 try { const u=new URL(url);return httpsOrigin(api) && u.origin===api &&
 u.protocol==='https:' && u.pathname==='/api/v1/billing/paddle-webhook' &&
 !u.search && !u.hash && !u.username && !u.password; }
 catch {return false;}
};
const strong=v=>typeof v==='string' && v.length>=16 &&
 !/^(CHANGE_ME|password|postgres|pmo_app|secret)$/i.test(v);
const databaseValid=(v,db)=>{
 try {const u=new URL(v);return ['postgres:','postgresql:'].includes(u.protocol) &&
 u.username==='pmo_app' && strong(decodeURIComponent(u.password)) &&
 u.hostname==='postgres' && ['','5432'].includes(u.port) &&
 u.pathname==='/'+db && !u.search && !u.hash;}
 catch {return false;}
};
const redisValid=(v,password)=>{
 try {const u=new URL(v);return u.protocol==='redis:' && u.hostname==='redis' &&
 decodeURIComponent(u.password)===password && ['','6379'].includes(u.port);}
 catch{return false;}
};

export function validateRc1Configuration(env,mode) {
 if(!['staging','production'].includes(mode))throw Error('Unknown release environment');
 const web=mode==='staging'?'https://staging.theepmo.com':'https://theepmo.com';
 const api=mode==='staging'?'https://api-staging.theepmo.com':'https://api.theepmo.com';
 return [
 ['Deployment matches target',env.DEPLOYMENT_ENV===mode],
 ['Web origin is HTTPS',httpsOrigin(env.WEB_ORIGIN)],
 ['API origin is HTTPS',httpsOrigin(env.PUBLIC_API_URL)],
 ['Canonical web origin',env.WEB_ORIGIN===web],
 ['Canonical API origin',env.PUBLIC_API_URL===api],
 ['Web port is private',!env.WEB_BIND || env.WEB_BIND==='127.0.0.1'],
 ['Paddle-only provider',env.BILLING_PROVIDER==='paddle'],
 ['Paddle collection disabled until acceptance',env.PADDLE_ENABLED==='false'],
 ['Provider environment matches target',env.PADDLE_ENV===(mode==='staging'?'sandbox':'production')],
 ['Paddle callback matches API origin',!env.PADDLE_WEBHOOK_PUBLIC_URL ||
   webhookValid(env.PUBLIC_API_URL,env.PADDLE_WEBHOOK_PUBLIC_URL)],
 ['Reference payment adapter disabled',env.BILLING_REFERENCE_WEBHOOK_ENABLED!=='true'],
 ['Database admin role is restricted',!!env.PG_USER && !['postgres','pmo_app'].includes(env.PG_USER)],
 ['Database admin password is strong',strong(env.PG_PASSWORD)],
 ['Application uses restricted DB login',databaseValid(env.DATABASE_URL,env.PG_DB||'pmo')],
 ['Redis password is strong',strong(env.REDIS_PASSWORD)],
 ['Redis URL uses same password',redisValid(env.REDIS_URL,env.REDIS_PASSWORD)],
 ['No test/demo origins',!/\.example\b|\.test\b/.test((env.WEB_ORIGIN||'')+' '+(env.PUBLIC_API_URL||''))]
 ].map(([name,passed])=>({name,passed:Boolean(passed)}));
}
function composeSection(src,service,next) {
 const start=src.indexOf('\n  '+service+':');
 const end=next?src.indexOf('\n  '+next+':',start+1):src.indexOf('\nvolumes:',start+1);
 return start>=0 && end>start?src.slice(start,end):'';
}
export function validateRc1Repository(src) {
 const api=composeSection(src.compose,'api','web'), web=composeSection(src.compose,'web');
 return [
 ['API has Paddle-only settings',['BILLING_PROVIDER','PADDLE_ENABLED','PADDLE_ENV'].every(x=>api.includes(x+':'))],
 ['Legacy provider settings absent from active config',!/STRIPE_/i.test(src.compose+src.apiEnv)],
 ['Secret keys not supplied to web',!/PADDLE_(API_KEY|WEBHOOK_SECRET)\s*:/.test(web)],
 ['Reference webhook disabled',/BILLING_REFERENCE_WEBHOOK_ENABLED:\s*['"]?false/.test(api)],
 ['Header auth disabled',/ALLOW_HEADER_AUTH:\s*['"]false['"]/.test(api)],
 ['API private network only',/expose:\s*\['4000'\]/.test(api) && !/\n\s+ports:/.test(api)],
 ['API blocks premature collection',src.apiEnv.includes('Paddle collection is blocked pending signed webhook')],
 ['Paddle signed event verifier present',src.paddleSignature.includes('verifyPaddleSignature')],
 ['CI runs migrations and RLS',src.ci.includes('bash scripts/apply-sql-migrations.sh') && src.ci.includes('assert-financial-rls.sql')],
 ['CI runs typecheck and web build',src.ci.includes('pnpm typecheck') && src.ci.includes('pnpm --filter @pmo/web build')]
 ].map(([name,passed])=>({name,passed:Boolean(passed)}));
}
export function checkRepository(rootDir=root) {
 return validateRc1Repository({
  compose:readFileSync(resolve(rootDir,'docker-compose.prod.yml'),'utf8'),
  apiEnv:readFileSync(resolve(rootDir,'apps/api/src/common/env.ts'),'utf8'),
  paddleSignature:readFileSync(resolve(rootDir,'scripts/paddle-webhook-signature.mjs'),'utf8'),
  ci:readFileSync(resolve(rootDir,'.github/workflows/ci.yml'),'utf8')
 });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);let result=checkRepository();
 if(args.length){
  if(args.length!==4 || args[0]!=='--mode' || args[2]!=='--env-file' ||
   !['staging','production'].includes(args[1])){
    console.error('Usage: node scripts/rc1-release-gate.mjs [--mode staging|production --env-file PATH]');
    process.exit(2);
  }
  try{result=result.concat(validateRc1Configuration(
    parseSimpleEnvFile(readFileSync(resolve(args[3]),'utf8')),args[1]));}
  catch{console.error('BLOCKED invalid release configuration');process.exit(1);}
 }
 for(const c of result)console.log((c.passed?'PASS ':'BLOCKED ')+c.name);
 console.log('Paddle-only offline preflight: '+result.filter(x=>x.passed).length+'/'+result.length);
 console.log('This does not prove live provider acceptance, host TLS, or database recovery.');
 if(result.some(x=>!x.passed))process.exitCode=1;
}
