import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {imageRuntimeIdentity} from './ci-image-bundle.mjs';
const archive=process.argv[2],service=process.argv[3];
if(!['api','web'].includes(service))throw Error('service');
const saved=JSON.parse(execFileSync('tar',['-xOzf',archive,'manifest.json'],{maxBuffer:1024*1024}));
const entry=saved.find(x=>x.RepoTags?.includes('epmo-'+service+':ci'));
if(!entry||!/^[-a-zA-Z0-9_./]+$/.test(entry.Config)||entry.Config.includes('..'))throw Error('config path');
const bytes=execFileSync('tar',['-xOzf',archive,entry.Config],{maxBuffer:1024*1024});
const config=JSON.parse(bytes);
const actual=JSON.parse(readFileSync(0,'utf8'))[0];
const source={Id:'sha256:'+createHash('sha256').update(bytes).digest('hex'),Os:config.os,Architecture:config.architecture,Variant:config.variant,Config:config.config,RootFS:{Type:'layers',Layers:config.rootfs.diff_ids}};
const shape=v=>v===undefined?'absent':v===null?'null':Array.isArray(v)?'array('+v.length+')':typeof v;
const hash=v=>v===undefined?'absent':createHash('sha256').update(JSON.stringify(v)).digest('hex');
const differences=[];
for(const key of new Set([...Object.keys(source.Config),...Object.keys(actual.Config)])){
 const a=source.Config[key],b=actual.Config[key];if(hash(a)!==hash(b))differences.push({key,archiveShape:shape(a),loadedShape:shape(b),archiveHash:hash(a),loadedHash:hash(b)});
}
console.log(JSON.stringify({service,archiveIdentity:imageRuntimeIdentity(source),loadedIdentity:imageRuntimeIdentity(actual),osEqual:source.Os===actual.Os,archEqual:source.Architecture===actual.Architecture,variantEqual:(source.Variant||'')===(actual.Variant||''),layersEqual:hash(source.RootFS.Layers)===hash(actual.RootFS.Layers),differences},null,2));
