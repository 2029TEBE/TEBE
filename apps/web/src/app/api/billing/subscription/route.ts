import { NextRequest, NextResponse } from 'next/server';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';

/** Paddle-only migration: no charge or subscription mutation without a signed ledger. */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeBrowserMutation(req);
  if (unsafe) return unsafe;
  return NextResponse.json(
    { error: 'Paddle billing is not yet accepting customer payments' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
