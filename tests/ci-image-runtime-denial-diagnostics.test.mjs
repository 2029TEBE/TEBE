import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const deploy=readFileSync(new URL('../infra/deploy.sh',import.meta.url),'utf8');

test('loaded image IDs and revisions must both match the attested CI bundle',()=>{
  assert.match(deploy,/API_EXPECTED_ID=\$\(jq -er \.apiId/);
  assert.match(deploy,/WEB_EXPECTED_ID=\$\(jq -er \.webId/);
  const block=deploy.split('    [[ "$actual" == "$expected_id" && "$revision" == "$EPMO_CI_VERIFIED_SHA" ]] || {')[1]?.split('\n    }')[0];
  assert.ok(block,'both image content ID and source revision must be enforced');
  assert.match(block,/BLOCKED: loaded \$service image content ID or revision differs from attested CI/);
  assert.match(block,/image ID mismatch for \$service: expected=\$expected_id actual=\$actual/);
  assert.match(block,/revision mismatch for \$service: expected=\$EPMO_CI_VERIFIED_SHA actual=\$revision/);
  assert.match(block,/exit 1/);
  assert.doesNotMatch(block,/echo.*(?:Config|environment|DEPLOY_KEY|password)/i);
  assert.doesNotMatch(deploy,/"\$digest" == "\$expected_digest"/);
});
