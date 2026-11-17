import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../../../web/src/app/(app)/gaiz/page.tsx',import.meta.url),'utf8');
test('GIZE AI is the user-visible English and Arabic intelligence brand',()=>{
 assert.match(page,/GIZE AI — Verification preview/);
 assert.match(page,/GIZE AI — معاينة التحقق/);
 assert.doesNotMatch(page,/GAIZ Shield — Verification preview/);
});
test('legacy GAIZ wire names remain identified without claiming new GIZE format support',()=>{
 assert.match(page,/Experimental GAIZ1\/GAIZ2 wire identifiers remain for legacy compatibility/);
 assert.match(page,/final GIZE AI protected-file format is not yet ratified/);
 assert.match(page,/final GIZE AI protected-file format is not yet ratified/);
});
test('verification preview retains authenticated read-only boundary',()=>{
 assert.match(page,/!session\.authenticated/);
 assert.match(page,/GaizVerificationPanel ar=\{ar\}/);
 assert.match(page,/No data is imported/);
});

test('GIZE AI labels the verification and staging interfaces while legacy routes remain unchanged',()=>{
 const verify=readFileSync(new URL('../../../web/src/components/GaizVerificationPanel.tsx',import.meta.url),'utf8');
 const stage=readFileSync(new URL('../../../web/src/components/GaizStagingPanel.tsx',import.meta.url),'utf8');
 assert.match(verify,/GIZE AI verification/);
 assert.match(stage,/GIZE AI staging/);
 assert.match(verify,/\/api\/gaiz\/verify/);
 assert.match(stage,/\/api\/gaiz\//);
 assert.doesNotMatch(verify,/['"]GAIZ verification/);
 assert.doesNotMatch(stage,/['"]GAIZ staging/);
});
