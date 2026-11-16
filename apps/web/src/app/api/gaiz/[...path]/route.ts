import { NextRequest, NextResponse } from 'next/server';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';

const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION = 'pmo_session';
export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest, path: string[]) {
  const relative = path.join('/');
  const permitted = req.method === 'GET'
    ? relative === 'requests'
    : relative === 'stage' || /^requests\/[a-f\d-]{36}\/review$/i.test(relative);
  if (!permitted) return NextResponse.json({error:'Unsupported GAIZ operation'},{status:404});
  if (req.method !== 'GET') {
    const blocked = rejectUnsafeBrowserMutation(req);
    if (blocked) return blocked;
  }
  const token = req.cookies.get(SESSION)?.value;
  if (!token) return NextResponse.json({error:'Sign in required'},{status:401});
  const raw = req.method === 'GET' ? undefined : await req.text();
  if (raw !== undefined &&
      (Buffer.byteLength(raw)>90_000 || !(req.headers.get('content-type')??'').startsWith('application/json'))) {
    return NextResponse.json({error:'Invalid GAIZ request'},{status:413});
  }
  try {
    const response = await fetch(`${BASE}/api/v1/gaiz/${relative}`, {
      method:req.method,
      headers:{
        cookie:`${SESSION}=${token}`,
        ...(raw!==undefined?{'content-type':'application/json'}:{}),
      },
      body:raw,cache:'no-store',redirect:'manual',
    });
    // Never forward redirects or cookies from the API.
    if(response.status>=300 && response.status<400)
      return NextResponse.json({error:'Unexpected GAIZ response'},{status:502});
    const text=await response.text();
    return new NextResponse(text||null,{status:response.status,headers:{
      'content-type':'application/json','cache-control':'no-store'
    }});
  } catch {
    return NextResponse.json({error:'GAIZ service unavailable'},{status:502});
  }
}

export const GET = (req: NextRequest, ctx: {params:Promise<{path:string[]}>})=>
  ctx.params.then(({path})=>proxy(req,path));
export const POST = (req: NextRequest, ctx: {params:Promise<{path:string[]}>})=>
  ctx.params.then(({path})=>proxy(req,path));
