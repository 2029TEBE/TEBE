import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { db } from '@pmo/db';
import { buildTransport } from '../notify/transport';
import { canOfferSignup, hashSignupToken, issueSignupToken,
  signupConfirmationLink, signupMessage } from './signup-policy';
import type { SignupRequestInput, SignupConfirmInput } from './signup.schemas';

const rows = (r: unknown) => r as any[];
const GENERIC = { ok: true, message: 'If eligible, an email verification link will be sent.' };

@Injectable()
export class SignupService {
  private ensureEnabled() {
    if (!canOfferSignup()) throw new ServiceUnavailableException('Customer registration is not enabled');
  }

  async request(body: SignupRequestInput) {
    this.ensureEnabled();
    const transport = buildTransport();
    if (!transport.delivers) throw new ServiceUnavailableException('Verified signup email delivery is not configured');
    const origin = (process.env.WEB_ORIGIN ?? '').split(',')[0]?.trim();
    let link: string;
    const {token, hash} = issueSignupToken();
    try { link = signupConfirmationLink(origin ?? '',token); }
    catch { throw new ServiceUnavailableException('Signup requires a trusted HTTPS web origin'); }

    const [r] = rows(await db.execute(sql`
      SELECT public.pmo_issue_signup_request(
        ${body.email},${body.displayName},${body.workspaceName},${hash}) AS accepted`));
    // Always give the same answer for existing users, cooled-down requests
    // and accepted requests; never disclose address existence.
    if (r?.accepted !== true) return GENERIC;
    let delivered=false;
    try {
      const outcome=await transport.send({
        to:body.email, ...signupMessage(link,body.lang), lang:body.lang,
      });
      delivered=outcome.ok;
    } catch { /* Provider details and bearer URLs never reach API/logs. */ }
    if (!delivered) {
      await db.execute(sql`SELECT public.pmo_revoke_signup_request(${hash})`);
    }
    return GENERIC;
  }

  /** Consume the emailed single-use bearer token; do not auto-login or bill. */
  async confirm(body: SignupConfirmInput) {
    this.ensureEnabled();
    let hash: string;
    try { hash=hashSignupToken(body.token); }
    catch { throw new BadRequestException('Verification link is invalid or expired'); }
    const passwordHash=await bcrypt.hash(body.password,12);
    const [r] = rows(await db.execute(sql`
      SELECT public.pmo_complete_signup_request(${hash},${passwordHash}) AS verified`));
    if (r?.verified !== true)
      throw new BadRequestException('Verification link is invalid, expired or already used');
    return {
      ok:true, message:'Email verified. Sign in, then activate your optional seven-day Evaluation.',
      verified:true, charged:false, trialStarted:false,
    };
  }
}
