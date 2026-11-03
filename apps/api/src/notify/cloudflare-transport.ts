type Message = { to: string; subject: string; body: string; lang: 'en' | 'ar' };
type Result = { ok: true } | { ok: false; error: string };
type Config = { accountId: string; token: string; from: string };
type Fetcher = typeof fetch;
/** Application guard only: Cloudflare still independently verifies each destination. */
export function pilotRecipients(value: string | undefined): ReadonlySet<string> | null {
  const parts = (value ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  const addresses = new Set(parts);
  if (addresses.size === 0 || addresses.size > 200 || parts.some(v =>
    v.length > 254 || v.includes('*') || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(v))) return null;
  return addresses;
}

const mailbox = (value: string) => value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]!));

/** No configurable endpoint: secrets and reset links only go to Cloudflare HTTPS. */
export function createCloudflareTransport(config: Config & { pilotAllowlist?: string }, fetcher: Fetcher = fetch) {
  if (!/^[a-f0-9]{32}$/.test(config.accountId) || !config.token.trim() ||
      /[\r\n]/.test(config.token) || !mailbox(config.from)) return null;
  const allowed = config.pilotAllowlist === undefined ? undefined : pilotRecipients(config.pilotAllowlist);
  if (allowed === null) return null;
  return {
    name: 'cloudflare',
    delivers: true,
    status: allowed ? 'Cloudflare invited pilot: only approved recipients can be sent email; each also needs Cloudflare verification. Provider acceptance is not inbox delivery.' :
      'Transactional email is configured through Cloudflare; inbox delivery requires verification.',
    pilot: allowed ? { mode: 'verified-only' as const, approvedRecipients: allowed.size, maximumRecipients: 200, providerVerificationRequired: true } : undefined,
    canSendTo: (address: string) => !allowed || allowed.has(address.trim().toLowerCase()),
    async send(message: Message): Promise<Result> {
      if (!mailbox(message.to) || !message.subject.trim() || /[\r\n]/.test(message.subject)) {
        return { ok: false, error: 'Invalid transactional email.' };
      }
      if (allowed && !allowed.has(message.to.toLowerCase())) {
        return { ok: false, error: 'Recipient is not approved for pilot email. Ask the administrator to verify and approve this address.' };
      }
      try {
        const response = await fetcher(
          `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`, {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(10_000),
            headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              from: { address: config.from, name: 'The EPMO' },
              to: message.to,
              subject: message.subject,
              text: message.body,
              html: `<div lang="${message.lang === 'ar' ? 'ar' : 'en'}" dir="${message.lang === 'ar' ? 'rtl' : 'ltr'}"><p>${escapeHtml(message.body).replace(/\r?\n/g, '<br>')}</p></div>`,
            }),
          });
        // Never echo provider bodies: they can contain recipient details or bearer links.
        if (!response.ok) return { ok: false, error: 'Cloudflare email request was not accepted.' };
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid Cloudflare email response.' };
        const data = payload as { success?: unknown; result?: unknown };
        if (data.success !== true || !data.result || typeof data.result !== 'object') {
          return { ok: false, error: 'Cloudflare email request failed.' };
        }
        const result = data.result as Record<string, unknown>;
        const contains = (list: unknown) => Array.isArray(list) && list.some(
          address => typeof address === 'string' && address.toLowerCase() === message.to.toLowerCase());
        if (contains(result.permanent_bounces) ||
            !(contains(result.delivered) || contains(result.queued))) {
          return { ok: false, error: 'Cloudflare did not accept this recipient.' };
        }
        // Accepted/queued is not proof of inbox delivery. No automatic retry of POST.
        return { ok: true };
      } catch {
        return { ok: false, error: 'Cloudflare email delivery is unavailable.' };
      }
    },
  };
}
