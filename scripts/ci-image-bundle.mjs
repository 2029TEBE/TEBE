// Content-bound Docker image bundle. No credentials, arbitrary image names or
// executable artifact metadata. Deployment validates before opening SSH.
import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {spawn,execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const SHA=/^[a-f0-9]{40}$/,ID=/^sha256:[a-f0-9]{64}$/,REPO=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
function fail(){throw Error('Verified CI image bundle unavailable or mismatched');}
function exact(o,keys){if(!o||Object.getPrototypeOf(o)!==Object.prototype||Object.keys(o).sort().join('|')!==keys.sort().join('|'))fail();}
export function validateBundleManifest(m,{revision,runId,repository}={}){
 exact(m,['version','revision','runId','repository','archiveSha256','images']);
 if(m.version!==2||!SHA.test(m.revision)||m.revision!==revision||!/^\d+$/.test(String(m.runId))||String(m.runId)!==String(runId)||!REPO.test(m.repository)||m.repository!==repository||!/^[a-f0-9]{64}$/.test(m.archiveSha256))fail();
 exact(m.images,['api','web']);
 for(const name of ['api','web']){exact(m.images[name],['id','tag','runtimeDigest']);if(!ID.test(m.images[name].runtimeDigest)||!ID.test(m.images[name].id)||m.images[name].tag!==`epmo-${name}:ci`)fail();}
 return {revision:m.revision,runId:String(m.runId),repository:m.repository,
  apiId:m.images.api.id,webId:m.images.web.id,
  apiRuntimeDigest:m.images.api.runtimeDigest,webRuntimeDigest:m.images.web.runtimeDigest,
  apiTag:`epmo-release-api:${m.revision}`,webTag:`epmo-release-web:${m.revision}`};
}

function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==null&&value[k]!==undefined).map(k=>[k,canonical(value[k])]));
 return value;
}
export function imageRuntimeIdentity(image){
 if(!image||!ID.test(image.Id)||image.Os!=='linux'||image.Architecture!=='amd64'||image.Config?.User!=='pmo'||!SHA.test(image.Config?.Labels?.['org.opencontainers.image.revision']??'')||image.RootFS?.Type!=='layers'||!Array.isArray(image.RootFS.Layers)||!image.RootFS.Layers.length||!image.RootFS.Layers.every(x=>ID.test(x)))fail();
 // Portable runtime identity: exact execution configuration plus ordered
 // uncompressed layer content hashes. Daemon-local index IDs are not portable.
 const bytes=JSON.stringify(canonical({os:image.Os,architecture:image.Architecture,variant:image.Variant||'',config:image.Config,layers:image.RootFS.Layers}));
 return {id:image.Id,revision:image.Config.Labels['org.opencontainers.image.revision'],runtimeDigest:'sha256:'+createHash('sha256').update(bytes).digest('hex')};
}
async function readImageIdentity(){
 let input='';for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>1024*1024)fail();}
 const images=JSON.parse(input);if(!Array.isArray(images)||images.length!==1)fail();
 return imageRuntimeIdentity(images[0]);
}

async function hashFile(file){const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');}
export async function verifyBundle(dir,expected){
 const manifestPath=join(dir,'manifest.json'),archive=join(dir,'images.tar.gz');
 const ms=await lstat(manifestPath),as=await lstat(archive);
 if(!ms.isFile()||ms.isSymbolicLink()||ms.size>16384||!as.isFile()||as.isSymbolicLink()||as.size<32||as.size>8*1024**3)fail();
 const m=JSON.parse(await readFile(manifestPath,'utf8')),result=validateBundleManifest(m,expected);
 if(await hashFile(archive)!==m.archiveSha256)fail();return result;
}
async function exportBundle(dir){
 const revision=process.env.GITHUB_SHA,runId=process.env.GITHUB_RUN_ID,repository=process.env.GITHUB_REPOSITORY;
 if(!SHA.test(revision??'')||!/^\d+$/.test(runId??'')||!REPO.test(repository??'')||process.env.GITHUB_REF!=='refs/heads/main'||!['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))fail();
 await mkdir(dir,{recursive:true,mode:0o700});
 const images={};
 for(const name of ['api','web']){
  const tag=`epmo-${name}:ci`,image=JSON.parse(execFileSync('docker',['image','inspect',tag],{encoding:'utf8',maxBuffer:1024*1024}))[0];
  if(!ID.test(image.Id)||image.Config?.Labels?.['org.opencontainers.image.revision']!==revision||image.Config.User!=='pmo')fail();
  images[name]={id:image.Id,tag,runtimeDigest:imageRuntimeIdentity(image).runtimeDigest};
 }
 const child=spawn('docker',['image','save','epmo-api:ci','epmo-web:ci'],{stdio:['ignore','pipe','inherit']});
 const exit=new Promise((res,rej)=>{child.once('error',rej);child.once('exit',code=>code===0?res():rej(Error('Docker image export failed')));});
 await Promise.all([pipeline(child.stdout,createGzip({level:1}),createWriteStream(join(dir,'images.tar.gz'),{mode:0o600})),exit]);
 const m={version:2,revision,runId,repository,archiveSha256:await hashFile(join(dir,'images.tar.gz')),images};
 validateBundleManifest(m,{revision,runId,repository});await writeFile(join(dir,'manifest.json'),JSON.stringify(m,null,2)+'\n',{mode:0o600});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,dir,revision,runId,repository]=process.argv.slice(2);
 try{if(mode==='identity')console.log(JSON.stringify(await readImageIdentity()));else if(mode==='export')await exportBundle(dir);else if(mode==='verify')console.log(JSON.stringify(await verifyBundle(dir,{revision,runId,repository})));else fail();}
 catch{console.error('BLOCKED: verified CI image bundle unavailable or mismatched');process.exitCode=1;}
}
