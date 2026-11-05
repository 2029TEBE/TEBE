import { NextRequest, NextResponse } from 'next/server';
import { rejectUnsafeBrowserMutation } from '@/lib/check-browser-mutation';
import { publicUrl } from '@/lib/public-url';

const BASE=process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const fail=(req:NextRequest)=>NextResponse.redirect(publicUrl(req,'/signup?error=unavailable'),303);

export async function POST(req:NextRequest){
  const blocked=rejectUnsafeBrowserMutation(req);
  if(blocked)return blocked;
  if(process.env.SIGNUP_ENABLED!=='true' || process.env.DEPLOYMENT_ENV!=='staging')
    return NextResponse.json({error:'Registration unavailable'},{status:503});
  let form:FormData;
  try {form=await req.formData();} catch {return fail(req);}
  const email=String(form.get('email')??'').trim().toLowerCase();
  const displayName=String(form.get('displayName')??'').trim();
  const workspaceName=String(form.get('workspaceName')??'').trim();
  const lang=form.get('lang')==='ar'?'ar':'en';
  if(!email || email.length>254 || displayName.length<2 || displayName.length>120 ||
     workspaceName.length<2 || workspaceName.length>120) return fail(req);
  try {
    const res=await fetch(new URL('/auth/signup/request',BASE),{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({email,displayName,workspaceName,lang}),
      cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(10_000),
    });
    if(!res.ok)return fail(req);
  } catch {return fail(req);}
  return NextResponse.redirect(publicUrl(req,'/signup/check-email'),303);
}
