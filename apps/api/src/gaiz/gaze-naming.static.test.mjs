import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
test('.GAZE displays consistently in enterprise EN/AR',()=>{
 const page=read('../../../web/src/app/(app)/gaiz/page.tsx');
 assert.match(page,/\.GAZE integration/);
 assert.match(page,/تكامل \.GAZE/);
 assert.match(page,/PDF · HTML · \.GAZE/);
 assert.match(page,/legacy experimental \.gaiz artifacts/);
 assert.match(page,/Upload, decryption and record import are disabled/);
});
test('proposed .GAZE name does not silently change legacy signed artifacts',()=>{
 const contract=read('../../../../docs/gaiz/GAZE_OFFICIAL_NAME_AND_WIRE_MIGRATION.md');
 assert.match(contract,/Official display name and proposed extension/);
 assert.match(contract,/GAIZ1/);
 assert.match(contract,/GAIZ2/);
 assert.match(contract,/no silent conversion/i);
 assert.match(contract,/protocol migration/i);
});
