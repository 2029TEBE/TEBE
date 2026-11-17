import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page=readFileSync(new URL('../../../web/src/app/(app)/gaiz/page.tsx',import.meta.url),'utf8');

test('GIZE AI is the official visible enterprise product name in English and Arabic',()=>{
 assert.ok(page.includes('GIZE AI — Verification preview'));
 assert.ok(page.includes('التحقق من GIZE AI'));
 assert.ok(!page.includes('.GAZE'));
});

test('legacy GAIZ wire formats remain explicitly compatible without an invented new format',()=>{
 assert.ok(page.includes('Experimental GAIZ1/GAIZ2 wire identifiers remain for legacy compatibility'));
 assert.ok(page.includes('A new file format has not been ratified'));
 assert.ok(!page.includes('final .GAZE file format'));
});

test('verification preview retains authenticated read-only boundary',()=>{
 assert.match(page,/!session\.authenticated/);
 assert.ok(page.includes('GaizVerificationPanel ar={ar}'));
 assert.ok(page.includes('No data is imported'));
});
