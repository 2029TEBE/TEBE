import { NextRequest, NextResponse } from 'next/server';
import { publicUrl } from '@/lib/public-url';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';
import { readBoundedBrowserForm } from '@/lib/bounded-browser-form.mjs';
import { fetchTenantMutation } from '@/lib/tenant-mutation-fetch.mjs';
import { billingFailurePath } from '@/lib/billing-mutation-feedback.mjs';
import { readBillingMutationJson, isSubscriptionPreferenceAcknowledged } from '@/lib/billing-mutation-ack.mjs';

const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const COOKIE = 'pmo_session';

/** Authenticated same-origin proxy; the API enforces tenant and capability checks. */
export async function POST(req: NextRequest) {
  // No legacy Stripe or local subscription mutations during Paddle cutover.
  if (process.env.BILLING_PROVIDER === 'paddle')
    return NextResponse.json({ error: 'Billing provider migration in progress' }, { status: 503 });
  const unsafe = rejectUnsafeBrowserMutation(req);
  if (unsafe) return unsafe;
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return NextResponse.redirect(publicUrl(req, billingFailurePath(401)), 303);
  const parsed = await readBoundedBrowserForm(req, 16_384);
  if (!parsed.form) return NextResponse.json({ error: 'Invalid billing form submission' },
    { status: parsed.error === 'too-large' ? 413 : 400 });
  const target = publicUrl(req, '/billing');
  const action = parsed.form.get('action');
  const path = action === 'schedule-cancellation' ? '/api/v1/subscription/cancel-at-period-end'
    : action === 'resume' ? '/api/v1/subscription/resume' : null;
  if (!path) {
    return NextResponse.redirect(publicUrl(req, billingFailurePath(400)), 303);
  }
  const response = await fetchTenantMutation(fetch, `${BASE}${path}`, {
    method: 'POST', cache: 'no-store',
    headers: { 'content-type': 'application/json', cookie: `${COOKIE}=${token}` },
    body: '{}',
  });
  // A timed-out mutation may have committed upstream; never retry or claim success.
  if (!response?.ok || response.redirected) {
    return NextResponse.redirect(publicUrl(req, billingFailurePath(response?.status)), 303);
  }
  // Verify the actual tenant-scoped API acknowledgement, not merely HTTP 200.
  const data = await readBillingMutationJson(response);
  if (!isSubscriptionPreferenceAcknowledged(data, action === 'schedule-cancellation'))
    return NextResponse.redirect(publicUrl(req, billingFailurePath(502)), 303);
  target.searchParams.set('updated', '1');
  return NextResponse.redirect(target, 303);
}
