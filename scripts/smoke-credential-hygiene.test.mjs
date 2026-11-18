import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const paths = ['shots.mjs','sweep.mjs','docshots.mjs','pages.sh'];
for(const name of paths) {
  test(name+' requires caller-provided synthetic credentials', () => {
    const source=readFileSync(new URL(name,import.meta.url),'utf8');
    assert.doesNotMatch(source,/ankit_aetherix|pmo-dev@123|pmoalign-dev|fatima@al-nakheel\.test/);
    if(name.endsWith('.sh')){
      assert.match(source,/SMOKE_USER:\?/);
      assert.match(source,/SMOKE_PASS:\?/);
    }else{
      assert.match(source,/process\.env\.SHOT_USER/);
      assert.match(source,/process\.env\.SHOT_PASS/);
      assert.match(source,/if \(!USER \|\| !PASS\)/);
    }
  });
}
