import { NextRequest, NextResponse } from 'next/server';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';

const BASE=process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const headers={'Cache-Control':'no-store'};
export async function POST(req:NextRequest){
  const blocked=rejectUnsafeBrowserMutation(req);
  if(blocked)return blocked;
  if(process.env.SIGNUP_ENABLED!=='true' || process.env.DEPLOYMENT_ENV!=='staging')
    return NextResponse.json({error:'Registration unavailable'},{status:503,headers});
  let input:{token?:unknown;password?:unknown};
  try {input=await req.json();}catch{return NextResponse.json({error:'Invalid request'},{status:400,headers});}
  if(typeof input.token!=='string'|| !/^[A-Za-z0-9_-]{43}$/.test(input.token) ||
    typeof input.password!=='string'||input.password.length<12||input.password.length>200)
    return NextResponse.json({error:'Invalid request'},{status:400,headers});
  try {
    const response=await fetch(new URL('/auth/signup/confirm',BASE),{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({token:input.token,password:input.password}),
      redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(10_000),
    });
    if(!response.ok)return NextResponse.json({error:'Verification failed'},{status:response.status===400?400:503,headers});
    return NextResponse.json({verified:true,charged:false,trialStarted:false},{status:200,headers});
  }catch{return NextResponse.json({error:'Registration service unavailable'},{status:503,headers});}
}
