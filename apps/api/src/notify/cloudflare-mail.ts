/** Transactional mail only. Never log credentials, recipients or recovery URLs. */
import type { MailTransport, Sendable, SendResult } from './transport';

export type CloudflareMailConfig = { accountId: string; token: string; from: string };
const address = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

export function cloudflareMailConfig(env: Record<string, string | undefined>): CloudflareMailConfig | null {
  const accountId = env.MAIL_CF_ACCOUNT_ID?.trim() ?? '';
  const token = env.MAIL_CF_API_TOKEN?.trim() ?? '';
  const from = env.MAIL_FROM?.trim() ?? '';
  if (!/^[a-f0-9]{32}$/.test(accountId) || token.length < 20 || token.length > 512 ||
      /[\s\x00-\x1f\x7f]/.test(token) || from.length > 254 || !address.test(from)) return null;
  return { accountId, token, from };
}

export class CloudflareMailTransport implements MailTransport {
  readonly name = 'cloudflare';
  readonly delivers = true;
  readonly status = 'Transactional email uses Cloudflare. The sending domain must be verified.';
  private readonly config: CloudflareMailConfig;
  private readonly request: typeof fetch;

  constructor(config: CloudflareMailConfig, request: typeof fetch = fetch) {
    // Validate even direct construction; an account ID must never alter the endpoint.
    const checked = cloudflareMailConfig({ MAIL_CF_ACCOUNT_ID: config.accountId,
      MAIL_CF_API_TOKEN: config.token, MAIL_FROM: config.from });
    if (!checked) throw new Error('Invalid transactional mail configuration');
    this.config = checked;
    this.request = request;
  }

  async send(message: Sendable): Promise<SendResult> {
    if (typeof message.to !== 'string' || message.to.length > 254 || !address.test(message.to) ||
        typeof message.subject !== 'string' || !message.subject.trim() || message.subject.length > 512 ||
        /[\r\n\x00]/.test(message.subject) || typeof message.body !== 'string' ||
        !message.body.trim() || Buffer.byteLength(message.body, 'utf8') > 262144) {
      return { ok: false, error: 'Invalid transactional email content.' };
    }
    try {
      const response = await this.request(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/email/sending/send`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: this.config.from, to: message.to,
            subject: message.subject, text: message.body }),
        });
      // Do not expose provider response bodies: they may echo bearer links or recipients.
      if (!response.ok) return { ok: false, error: `Mail provider refused the request (HTTP ${response.status}).` };
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object') throw new Error('Invalid response');
      const envelope = payload as Record<string, unknown>;
      if (envelope.success !== true || !Array.isArray(envelope.errors) || envelope.errors.length ||
          !envelope.result || typeof envelope.result !== 'object') throw new Error('Invalid response');
      const result = envelope.result as Record<string, unknown>;
      const lists = ['delivered', 'queued', 'permanent_bounces', 'suppressed_recipients'] as const;
      for (const key of lists) {
        if (key === 'suppressed_recipients' && result[key] === undefined) continue;
        if (!Array.isArray(result[key]) || (result[key] as unknown[]).some(v => typeof v !== 'string'))
          throw new Error('Invalid recipient result');
      }
      const contains = (key: typeof lists[number]) =>
        ((result[key] ?? []) as string[]).some(v => v.toLowerCase() === message.to.toLowerCase());
      if (contains('permanent_bounces') || contains('suppressed_recipients') ||
          (!contains('delivered') && !contains('queued'))) {
        return { ok: false, error: 'Mail provider did not accept the recipient.' };
      }
      // Queued means accepted by the provider, not proof of inbox delivery.
      return { ok: true };
    } catch {
      // No automatic retry: an interrupted response may already have accepted mail.
      return { ok: false, error: 'Mail delivery could not be confirmed. Check provider status before retrying.' };
    }
  }
}
