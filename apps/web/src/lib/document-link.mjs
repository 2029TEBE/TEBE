/**
 * Document-register external links originate from tenant records. Only allow
 * absolute HTTP(S) URLs; forbid script/data/file schemes and credential URLs.
 * This does not grant access to any document or bypass provider authorization.
 */
export function safeDocumentWebUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
