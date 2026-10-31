import { NextRequest, NextResponse } from 'next/server';
import { publicUrl } from '@/lib/public-url';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';
import { stripeCheckoutRedirect } from '@/lib/billing-checkout-redirect';
import { readBoundedBrowserForm } from '@/lib/bounded-browser-form.mjs';
import { fetchTenantMutation } from '@/lib/tenant-mutation-fetch.mjs';
import { billingFailurePath } from '@/lib/billing-mutation-feedback.mjs';

const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const COOKIE = 'pmo_session';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Same-site form proxy. Never accept arbitrary return URLs or untrusted Stripe redirects. */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeBrowserMutation(req);
  if (unsafe) return unsafe;
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return NextResponse.redirect(publicUrl(req, billingFailurePath(401)), 303);
  const parsed = await readBoundedBrowserForm(req, 16_384);
  if (!parsed.form) return NextResponse.json({ error: 'Invalid billing form submission' },
    { status: parsed.error === 'too-large' ? 413 : 400 });
  const form = parsed.form;
  const action = form.get('action');
  const invoiceId = String(form.get('invoiceId') ?? '');
  const target = publicUrl(req, '/billing');
  let path: string;
  let payload: Record<string, unknown>;
  if (action === 'issue-invoice') {
    path = '/api/v1/subscription/billing/renewal-invoice';
    payload = {};
  } else if (action === 'checkout' && UUID.test(invoiceId)) {
    path = '/api/v1/subscription/billing/stripe/checkout';
    payload = { invoiceId };
  } else {
    return NextResponse.redirect(publicUrl(req, billingFailurePath(400)), 303);
  }
  const response = await fetchTenantMutation(fetch, `${BASE}${path}`, {
    method: 'POST', cache: 'no-store',
    headers: { 'content-type': 'application/json', cookie: `${COOKIE}=${token}` },
    body: JSON.stringify(payload),
  });
  // The shared mutation proxy enforces a 15s deadline, rejects redirects and
  // never replays an ambiguous payment-related POST.
  if (!response?.ok || response.redirected) {
    return NextResponse.redirect(publicUrl(req, billingFailurePath(response?.status)), 303);
  }
  if (action === 'issue-invoice') {
    target.searchParams.set('success', '1');
    return NextResponse.redirect(target, 303);
  }
  const data = await response.json().catch(() => null);
  const url = stripeCheckoutRedirect(data, invoiceId);
  if (!url) {
    return NextResponse.redirect(publicUrl(req, billingFailurePath(502)), 303);
  }
  return NextResponse.redirect(url, 303);
}
