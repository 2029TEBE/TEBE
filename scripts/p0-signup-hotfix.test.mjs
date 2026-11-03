import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apps/web/src/app/signup/page.tsx', import.meta.url),'utf8');
const login = readFileSync(new URL('../apps/web/src/app/login/page.tsx', import.meta.url),'utf8');
const css = readFileSync(new URL('../apps/web/src/app/globals.css', import.meta.url),'utf8');

test('independent /signup route exists on the main deployment line',()=>{
 assert.match(source,/export default async function SignupPage/);
 assert.match(source,/getLang\(\)/);
 assert.match(source,/dir=\{ar \? 'rtl' : 'ltr'\}/);
 assert.match(source,/href="\/login"/);
 assert.match(source,/href="https:\/\/theepmo\.com\/"/);
 assert.match(login,/getLang/);
 assert.match(login,/<Link href="\/signup">/);
 assert.match(source,/robots: \{ index: false, follow: false \}/);
 assert.match(css,/\.authwrap/);
 assert.match(css,/\.authpanel/);
});
test('route cannot silently claim paid signup or send to a known unverified mailbox',()=>{
 assert.match(source,/mailboxVerified = process\.env\.EPMO_SIGNUP_EMAIL_READY === 'true'/);
 assert.match(source,/temporarily unavailable while mailbox delivery is being verified/);
 assert.match(source,/invitation-only/);
 assert.doesNotMatch(source,/@\/lib\/api|signupMutation|createTenant|createCheckout|Paddle\.Initialize|Stripe/);
});
