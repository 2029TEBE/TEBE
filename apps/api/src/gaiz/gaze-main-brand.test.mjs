import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../../../web/src/app/(app)/gaiz/page.tsx',import.meta.url),'utf8');
test('GIZE AI is the user-visible English and Arabic enterprise name',()=>{
 assert.match(page,/\.GAZE — Verification preview/);
 assert.match(page,/التحقق من ‎\.GAZE/);
 assert.doesNotMatch(page,/GAIZ Shield — Verification preview/);
});
test('legacy GAIZ wire names remain without claiming a new file format',()=>{
 assert.match(page,/Experimental GAIZ1\/GAIZ2 wire identifiers remain for legacy compatibility/);
 assert.match(page,/final \.GAZE file format is not yet ratified/);
 assert.match(page,/final \.GAZE file format is not yet ratified/);
});
test('verification preview retains authenticated read-only boundary',()=>{
 assert.match(page,/!session\.authenticated/);
 assert.match(page,/GaizVerificationPanel ar=\{ar\}/);
 assert.match(page,/No data is imported/);
});
