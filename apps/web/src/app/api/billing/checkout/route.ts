import { NextRequest, NextResponse } from 'next/server';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';

/** No browser checkout before an independently verified Paddle settlement writer. */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeBrowserMutation(req);
  if (unsafe) return unsafe;
  return NextResponse.json(
    { error: 'Paddle checkout is not accepting payments until verification is complete' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
