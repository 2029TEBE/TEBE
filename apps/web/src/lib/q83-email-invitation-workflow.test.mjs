import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onboardingMutationAcknowledged } from './onboarding-mutation-ack.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url),'utf8');
const readApi = p => readFileSync(new URL('../../../api/src/' + p, import.meta.url),'utf8');
const ctl = readApi('onboarding/onboarding.controller.ts');
const svc = readApi('onboarding/onboarding.service.ts');
const schemas = readApi('onboarding/onboarding.schemas.ts');
const route = read('app/api/onboarding/route.ts');
const accept = read('app/api/invite/accept/route.ts');
const form = read('app/accept-invite/InviteForm.tsx');
const settings = read('app/(app)/settings/page.tsx');

const uuid = 'f31766e8-4abe-4b93-88e2-d6294a29b691';
const body = { id: uuid, role: 'team_member', email: 'test@example.org',
  deliveryStatus: 'sent', expiresAt: '2026-11-04T12:00:00.000Z' };
function reply(b=body,status=201,contentType='application/json') {
 return {ok:true,status,redirected:false,headers:{get:()=>contentType},
   body:undefined, async json(){return b},
   text:async()=>JSON.stringify(b),
 };
}
test('customer invitation extension preserves trusted tenant, capability, token rotation and response privacy',()=>{
 assert.match(ctl, /@Get\('email-readiness'\)/);
 assert.match(ctl, /@Post\('invitations\/:id\/resend'\)/);
 assert.match(ctl, /ttl: 900_000, limit: 3/);
 assert.match(svc, /requireCapability\('pmoa_manage_people'\)/);
 assert.match(svc, /transport\.canSendTo && !transport\.canSendTo\(body\.email\)/);
 assert.match(svc, /transport\.canSendTo && !transport\.canSendTo\(record\.email\)/);
 assert.match(svc, /tenant_id=\$\{tenantId\} FOR UPDATE/);
 assert.match(svc, /SET revoked_at=now\(\)/);
 assert.match(svc, /return this\.invite\(\{ email: invitation\.email, role: invitation\.role, lang \}\)/);
 assert.match(svc, /ON CONFLICT \(tenant_id,dedupe_key\) DO NOTHING/);
 assert.match(svc, /const welcome = workspaceWelcome\(origin, lang\)/);
 assert.match(schemas, /lang: z\.enum\(\['ar','en'\]\)\.default\('en'\)/);
});
test('web invitation requests keep CSRF, bounded body and no client-chosen tenant or unsafe upstream reflection',()=>{
 assert.match(route,/rejectUnsafeBrowserMutation\(req\)/);
 assert.match(route,/fetchTenantMutation\(fetch,/);
 assert.match(route,/action === 'resend' && uuid\.test\(get\('id'\)\)/);
 assert.match(route,/onboardingMutationAcknowledged\(result, action, body\)/);
 assert.match(accept,/readBoundedBrowserJson\(req\)/);
 assert.match(accept,/redirect: 'error'/);
 assert.match(accept,/lang: body\.lang === 'ar' \? 'ar' : 'en'/);
 assert.match(form,/body: JSON\.stringify\(\{ token, displayName: name, password, lang \}\)/);
 assert.match(settings,/api\.workspaceEmailReadiness/);
 assert.match(settings,/name="action" value="resend"/);
 assert.doesNotMatch(route,/response\.json\(\)\.message|response\.text\(\)/);
});
