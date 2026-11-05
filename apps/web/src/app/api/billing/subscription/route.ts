import { NextRequest, NextResponse } from 'next/server';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';

/** Subscription state is provider-managed; local cancellation forms cannot change it. */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeBrowserMutation(req);
  if (unsafe) return unsafe;
  return NextResponse.json(
    { error: 'Paddle subscription changes are temporarily unavailable' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
