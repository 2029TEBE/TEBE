import { NextRequest, NextResponse } from 'next/server';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';

/** Same-origin, cookie-authenticated proxy; no client-controlled tenant or price. */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeBrowserMutation(req);
  if (unsafe) return unsafe;
  if (process.env.EVALUATION_ACCESS_ENABLED !== 'true' ||
      process.env.DEPLOYMENT_ENV === 'production')
    return NextResponse.json({ error: 'Evaluation is not available' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const token = req.cookies.get('pmo_session')?.value;
  if (!token) return NextResponse.json({ error: 'Sign-in is required' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  let response: Response;
  try {
    response = await fetch(new URL('/api/v1/subscription/evaluation/start', base), {
      method: 'POST',
      headers: { cookie: `pmo_session=${token}`, 'Content-Type':'application/json' },
      body: '{}', redirect: 'manual', cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: 'Evaluation service unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!response.ok)
    return NextResponse.json({ error: 'Evaluation could not be started' },
      { status: response.status >= 400 && response.status < 500 ? response.status : 503,
        headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.redirect(new URL('/billing?evaluation=started',req.url),303);
}
