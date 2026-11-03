type Invite = { deliveryStatus: string; expiresAt: string; consumedAt?: string | null; revokedAt?: string | null };
export function invitationDisplay(invite: Invite, lang: 'en' | 'ar', now = Date.now()) {
  const expiry = Date.parse(invite.expiresAt);
  const state = invite.consumedAt ? 'activated' : invite.deliveryStatus === 'failed' ? 'failed' :
    invite.revokedAt ? 'revoked' : !Number.isFinite(expiry) ? 'unknown' : expiry <= now ? 'expired' :
    invite.deliveryStatus === 'sent' ? 'awaiting' : invite.deliveryStatus === 'pending' ? 'pending' : 'unknown';
  const labels = {
    activated: ['Activated', 'مفعّلة'], failed: ['Delivery failed', 'تعذّر الإرسال'],
    revoked: ['Revoked', 'ملغاة'], expired: ['Expired', 'منتهية'],
    awaiting: ['Provider accepted · awaiting activation', 'قبلتها خدمة البريد · بانتظار التفعيل'],
    pending: ['Preparing invitation', 'جارٍ تجهيز الدعوة'], unknown: ['Unverified status', 'حالة غير متحققة'],
  };
  return { state, label: labels[state][lang === 'ar' ? 1 : 0],
    mayResend: ['awaiting', 'expired'].includes(state), mayRevoke: ['awaiting','pending','expired'].includes(state) };
}
