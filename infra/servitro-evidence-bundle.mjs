#!/usr/bin/env node
// Offline evidence bundle verifier. No network, credentials, deployment or provider calls.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const hex40 = /^[a-f0-9]{40}$/;
const hex64 = /^[a-f0-9]{64}$/;
const categories = ['image-attestation','https-health','nonprod-isolation','encrypted-backup','isolated-restore','alert-delivery','rollback-drill','independent-review'];
export function verifyBundle(manifest, load) {
 const errors = [];
 if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return {accepted:false,errors:['invalid-manifest'],deploymentAuthorized:false};
 if (Object.keys(manifest).some(k=>!['schemaVersion','releaseSha','artifacts'].includes(k))) errors.push('unknown-field');
 if (manifest.schemaVersion !== 1 || !hex40.test(manifest.releaseSha ?? '')) errors.push('release-identity');
 if (!Array.isArray(manifest.artifacts)) errors.push('artifacts');
 const seen = new Set();
 for (const entry of Array.isArray(manifest.artifacts) ? manifest.artifacts.slice(0,32) : []) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(k=>!['category','path','sha256','releaseSha'].includes(k))) {errors.push('artifact-schema');continue;}
  if (!categories.includes(entry.category) || seen.has(entry.category)) errors.push('category');
  seen.add(entry.category);
  if (entry.releaseSha !== manifest.releaseSha) errors.push('artifact-release');
  if (!hex64.test(entry.sha256 ?? '')) {errors.push('digest');continue;}
  if (typeof entry.path !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,180}$/.test(entry.path) || isAbsolute(entry.path) || entry.path.split('/').includes('..')) {errors.push('path');continue;}
  try {
   const bytes = load(entry.path);
   if (!Buffer.isBuffer(bytes) || bytes.length > 1024*1024) {errors.push('artifact-size');continue;}
   if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) errors.push('digest-mismatch');
  } catch {errors.push('missing-artifact');}
 }
 if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== categories.length || categories.some(c=>!seen.has(c))) errors.push('missing-category');
 // Integrity is not authenticity: even accepted local bytes are NOT provider-verified receipts.
 return {accepted:errors.length===0,errors:[...new Set(errors)],deploymentAuthorized:false,operationallyVerified:false};
}
export function verifyFromDisk(manifestPath) {
 const raw = readFileSync(manifestPath);
 if (raw.length > 32768) throw Error('manifest-size');
 const manifest = JSON.parse(raw.toString('utf8'));
 const root = resolve(manifestPath,'..');
 return verifyBundle(manifest, path=>{
  const target = resolve(root,path);
  if (relative(root,target).startsWith('..'+sep) || target===root) throw Error('path');
  return readFileSync(target,{flag:'r'});
 });
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try { if(process.argv.length!==3) throw Error('usage');const result=verifyFromDisk(process.argv[2]);process.stdout.write(JSON.stringify(result)+'\n');if(!result.accepted)process.exitCode=2; }
 catch {process.stderr.write('Evidence bundle rejected; contents withheld\n');process.exitCode=2;}
}
