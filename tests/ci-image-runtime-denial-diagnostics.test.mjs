import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const deploy=readFileSync(new URL('../infra/deploy.sh',import.meta.url),'utf8');

test('loaded image is checked against attested exact CI content ID and revision',()=>{
  const block=deploy.split('    [[ "$actual" =~ ^sha256:[a-f0-9]{64}$ && "$actual" == "$expected_id" && "$revision" == "$EPMO_CI_VERIFIED_SHA" ]] || {')[1]?.split('\n    }')[0];
  assert.ok(block,'image ID and revision must both be required');
  assert.match(block,/BLOCKED: loaded \$service image content ID or revision differs from attested CI/);
  assert.match(block,/content ID mismatch for \$service: expected=\$expected_id actual=\$actual/);
  assert.match(block,/revision mismatch for \$service: expected=\$EPMO_CI_VERIFIED_SHA actual=\$revision/);
  assert.match(block,/exit 1/);
  assert.doesNotMatch(block,/echo.*(?:Config|environment|DEPLOY_KEY|password)/i);
});
