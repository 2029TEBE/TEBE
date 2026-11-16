import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const deploy=readFileSync(new URL('../infra/deploy.sh',import.meta.url),'utf8');

test('loaded image digest and revision mismatch remains a hard refusal',()=>{
  const block=deploy.split('    [[ "$digest" == "$expected_digest" && "$revision" == "$EPMO_CI_VERIFIED_SHA" ]] || {')[1]?.split('\n    }')[0];
  assert.ok(block,'both image integrity conditions must be required');
  assert.match(block,/echo "BLOCKED: loaded \$service image runtime content or revision differs from CI"/);
  assert.match(block,/runtime digest mismatch for \$service: expected=\$expected_digest actual=\$digest/);
  assert.match(block,/revision mismatch for \$service: expected=\$EPMO_CI_VERIFIED_SHA actual=\$revision/);
  assert.match(block,/exit 1/);
  assert.doesNotMatch(block,/echo.*(?:Config|environment|DEPLOY_KEY|password)/i);
});
