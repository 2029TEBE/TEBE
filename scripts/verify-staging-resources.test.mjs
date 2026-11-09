import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyStagingResources } from './verify-staging-resources.mjs';

const env = { DEPLOYMENT_ENV:'staging', WEB_BIND:'127.0.0.1', WEB_PORT:'3001' };
const plan = () => ({
 name:'pmo-staging',
 volumes: { pgdata: { name:'pmo-staging_pgdata' } },
 services: {
  postgres: { volumes:[{type:'volume',source:'pgdata',target:'/var/lib/postgresql/data'}] },
  redis: {},
  api: {},
  web: { ports:[{host_ip:'127.0.0.1',published:'3001',target:3000,protocol:'tcp'}] },
 },
});
const container = (project,mounts=[],ports={})=>({
 Config:{ Labels:{'com.docker.compose.project':project} },
 Mounts:mounts, NetworkSettings:{Ports:ports},
});
const clone = v => structuredClone(v);
const reject = (e,p,c=[]) => assert.throws(()=>verifyStagingResources(e,p,c),/required|private|volume|port|project|network|privileges|overlap|collision|published|inventory|missing|matches|unexpected|service/i);

test('accepts isolated staging Compose plan and foreign containers without overlap', () => {
 const prod=container('pmo-prod',[{Type:'volume',Name:'pmo-prod_pgdata',Destination:'/var/lib/postgresql/data'}],{'3000/tcp':[{HostIp:'127.0.0.1',HostPort:'3000'}]});
 assert.equal(verifyStagingResources(env,plan(),[prod]).ok,true);
});
test('fails closed for missing/incorrect project and deployment mode',()=>{
 reject({...env,DEPLOYMENT_ENV:'production'},plan());
 reject(env,{...plan(),name:'pmo-prod'});
 reject(env,{...plan(),services:{postgres:{}}});
});
test('rejects shared or external database volumes and bind mounts',()=>{
 for(const v of [{name:'pmo-prod_pgdata'},{name:'pmo-staging_pgdata',external:true}]) {
  const p=plan();p.volumes.pgdata=v;reject(env,p);
 }
 const p=plan();p.services.postgres.volumes[0].type='bind';reject(env,p);
});
test('rejects published database/API ports and host network',()=>{
 for(const service of ['postgres','redis','api']){
  const p=plan();p.services[service].ports=[{published:'5432'}];reject(env,p);
 }
 const p=plan();p.services.web.network_mode='host';reject(env,p);
});
test('web must use explicit dedicated loopback port',()=>{
 for(const port of ['3000','80','0','65536','3001;sh','']) reject({...env,WEB_PORT:port},plan());
 const p=plan();p.services.web.ports[0].host_ip='0.0.0.0';reject(env,p);
});
test('rejects another container owning staging volume or published port',()=>{
 reject(env,plan(),[container('pmo-prod',[{Type:'volume',Name:'pmo-staging_pgdata'}])]);
 reject(env,plan(),[container('another-project',[],{'3000/tcp':[{HostIp:'0.0.0.0',HostPort:'3001'}]})]);
 reject(env,plan(),[container('pmo-staging',[{Type:'volume',Name:'pmo-prod_pgdata',Destination:'/var/lib/postgresql/data'}])]);
});
test('deploy invokes read-only Docker isolation check before rsync',()=>{
 const s=readFileSync(new URL('../infra/deploy.sh',import.meta.url),'utf8');
 const a=s.indexOf('node scripts/verify-staging-config.mjs --env-file');
 const b=s.indexOf('node scripts/verify-staging-resources.mjs --env-file');
 const c=s.indexOf('rsync -az --delete');
 assert.ok(a>0 && b>a && c>b);
 assert.match(s,/BLOCKED: staging Docker resources are not isolated\. No files copied/);
});
