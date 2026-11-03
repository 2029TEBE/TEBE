import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readMailEvidenceFile} from './servitro-mail-evidence.mjs';

test('S27 CLI reader accepts bounded regular JSON file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'epmo-mail-'));
 try {const path=join(dir,'receipt.json');await writeFile(path,'{"releaseSha":"example"}');assert.deepEqual(await readMailEvidenceFile(path),{releaseSha:'example'});}
 finally {await rm(dir,{recursive:true,force:true});}
});
test('S27 CLI reader rejects symlink rather than following it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'epmo-mail-'));
 try {const target=join(dir,'real.json');const link=join(dir,'link.json');await writeFile(target,'{}');await symlink(target,link);await assert.rejects(readMailEvidenceFile(link));}
 finally {await rm(dir,{recursive:true,force:true});}
});
test('S27 CLI reader rejects directories and empty evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'epmo-mail-'));
 try {await assert.rejects(readMailEvidenceFile(dir));const empty=join(dir,'empty.json');await writeFile(empty,'');await assert.rejects(readMailEvidenceFile(empty));}
 finally {await rm(dir,{recursive:true,force:true});}
});
test('S27 CLI reader rejects >1 MiB files and invalid JSON',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'epmo-mail-'));
 try {const large=join(dir,'large.json');await writeFile(large,'x'.repeat(1048577));await assert.rejects(readMailEvidenceFile(large));const bad=join(dir,'bad.json');await writeFile(bad,'{');await assert.rejects(readMailEvidenceFile(bad));}
 finally {await rm(dir,{recursive:true,force:true});}
});
