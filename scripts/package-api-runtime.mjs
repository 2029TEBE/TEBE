// Copy owned ESM runtime assets into the compiled API; never ship tests or PEMs.
import {readdir,mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
const root=new URL('../apps/api/',import.meta.url);
async function copy(dir=''){
 for(const entry of await readdir(new URL('src/'+dir,root),{withFileTypes:true})){
  const rel=join(dir,entry.name);
  if(entry.isDirectory()){await copy(rel);continue;}
  if(!entry.isFile()||!entry.name.endsWith('.mjs')||entry.name.endsWith('.test.mjs'))continue;
  await mkdir(new URL('dist/'+dir+'/',root),{recursive:true});
  await copyFile(new URL('src/'+rel,root),new URL('dist/'+rel,root));
 }
}
await copy();
