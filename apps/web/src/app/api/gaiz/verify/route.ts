import { NextRequest, NextResponse } from 'next/server';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';

const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION = 'pmo_session';
export const dynamic = 'force-dynamic';

// Same-origin, session-forwarding development-only proxy. No raw file storage.
export async function POST(req: NextRequest) {
  const blocked = rejectUnsafeBrowserMutation(req);
  if (blocked) return blocked;
  const token = req.cookies.get(SESSION)?.value;
  if (!token) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  if (!(req.headers.get('content-type') ?? '').startsWith('application/json')) {
    return NextResponse.json({ error: 'JSON request required.' }, { status: 415 });
  }
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > 90_000) return NextResponse.json({ error: 'GAIZ preview file too large.' }, { status: 413 });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 90_000) {
    return NextResponse.json({ error: 'GAIZ preview file too large.' }, { status: 413 });
  }
  try {
    const response = await fetch(`${BASE}/api/v1/gaiz/verify`, {
      method: 'POST',
      headers: { cookie: `${SESSION}=${token}`, 'content-type': 'application/json' },
      body: raw,
      cache: 'no-store',
      redirect: 'manual',
    });
    const text = await response.text();
    return new NextResponse(text || null, {
      status: response.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'GAIZ verification service unavailable.' }, { status: 502 });
  }
}
