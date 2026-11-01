/**
 * E61: bounded, display-only Power BI catalogue metadata.
 * Never expose a delegated bearer, embed URL, arbitrary provider URL, or
 * unvalidated report identity from the owner-scoped preview endpoint.
 */
const providerId = /^[A-Za-z0-9_-]{1,128}$/;
const safeLabel = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 &&
  value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value);

export function safePowerBiReportUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.trim() !== value ||
      /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'app.powerbi.com' ||
        url.port || url.username || url.password || url.hash ||
        !(url.pathname.startsWith('/groups/') || url.pathname.startsWith('/reports/'))) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function powerBiGroupSummary(raw: unknown): { id: string; name: string } {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid Power BI workspace metadata.');
  const group = raw as Record<string, unknown>;
  if (typeof group.id !== 'string' || !providerId.test(group.id) ||
      !safeLabel(group.name)) throw new Error('Invalid Power BI workspace metadata.');
  return { id: group.id, name: group.name };
}

export function powerBiReportSummary(
  raw: unknown, groupId: string | null, groupName: string,
): { id: string; name: string; groupId: string | null; groupName: string;
     embedUrl: null; webUrl: string | null } {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid Power BI report metadata.');
  const report = raw as Record<string, unknown>;
  if (typeof report.id !== 'string' || !providerId.test(report.id) ||
      !safeLabel(report.name) || !safeLabel(groupName) ||
      (groupId !== null && !providerId.test(groupId))) {
    throw new Error('Invalid Power BI report metadata.');
  }
  const webUrl = report.webUrl == null ? null : safePowerBiReportUrl(report.webUrl);
  if (report.webUrl != null && !webUrl) throw new Error('Unsafe Power BI report URL.');
  // The preview catalogue is display-only. Embedding requires a separately
  // reviewed owner-scoped flow and must never inherit a workspace bearer.
  return { id: report.id, name: report.name, groupId, groupName,
           embedUrl: null, webUrl };
}
