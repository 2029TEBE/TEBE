import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/paddle-sandbox-catalog-readonly.yml',import.meta.url),'utf8');

test('Paddle catalog verifier is manually dispatched, never triggered by PR or push',()=>{
 assert.match(workflow,/^on:\s*\n  workflow_dispatch:/m);
 assert.doesNotMatch(workflow,/^\s+(?:push|pull_request|schedule|workflow_run):/m);
 assert.match(workflow,/^permissions:\s*\n  contents: read/m);
 assert.doesNotMatch(workflow,/\b(write-all|id-token: write|contents: write)\b/);
});
test('secret is scoped only to final verification step, never checkout or setup',()=>{
 const steps=workflow.indexOf('    steps:');
 const secret=workflow.indexOf('PADDLE_SANDBOX_API_KEY:');
 const verification=workflow.indexOf('      - name: Verify sandbox catalog with step-scoped secret');
 assert.ok(steps>0&&verification>steps&&secret>verification);
 assert.equal(workflow.split('PADDLE_SANDBOX_API_KEY:').length-1,1);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/PADDLE_ENABLED: 'false'/);
 assert.match(workflow,/PADDLE_ENV: sandbox/);
 assert.match(workflow,/node scripts\/paddle-verified-sandbox-api-preflight\.mjs/);
 assert.doesNotMatch(workflow,/\b(?:curl|POST|paddle transactions create)\b/i);
});
test('manual workflow refuses missing secret, masks token and cannot deploy',()=>{
 assert.match(workflow,/if \[ -z "\$PADDLE_SANDBOX_API_KEY" \]; then/);
 assert.match(workflow,/::add-mask::/);
 assert.doesNotMatch(workflow,/(?:kubectl|docker login|paddle\.com\/transactions|deploy:)/i);
});
