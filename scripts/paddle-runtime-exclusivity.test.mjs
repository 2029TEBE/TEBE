import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const forbidden=/stripe/i;
const scanDirs=['apps/api/src','apps/web/src'];
function walk(dir){
 const problems=[];
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isDirectory()){problems.push(...walk(path));continue;}
  if(!entry.isFile() || !/\.(?:ts|tsx|js|mjs)$/.test(entry.name) ||
     /\.(?:test|spec)\./.test(entry.name))continue;
  const content=readFileSync(path,'utf8');
  if(forbidden.test(entry.name)||forbidden.test(content))
   problems.push(path.replace(root+'/',''));
 }
 return problems;
}
test('active web and API runtime have no retired provider implementation references',()=>{
 const problems=scanDirs.flatMap(path=>walk(join(root,path)));
 assert.deepEqual(problems,[]);
});
test('Paddle payment collection remains disabled until signed settlement is integrated',()=>{
 const env=readFileSync(join(root,'apps/api/src/common/env.ts'),'utf8');
 const web=readFileSync(join(root,'apps/web/src/app/api/billing/checkout/route.ts'),'utf8');
 assert.match(env,/Paddle collection is blocked pending signed webhook/);
 assert.match(web,/status: 503/);
});
