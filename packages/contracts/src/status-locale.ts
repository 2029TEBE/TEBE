/**
 * Presentation-only status terminology; never change stored status codes.
 * English-source labels are explicit, with approved legacy Arabic variants.
 * Untranslated locales fall back to English (not the raw API code).
 */
export const STATUS_LABELS = {
  documents: {
    draft: ['Draft', 'مسودة'], in_review: ['In review', 'قيد المراجعة'],
    approved: ['Approved', 'معتمد'], superseded: ['Superseded', 'مستبدل'],
  },
  benefits: {
    planned: ['Planned', 'مخطط'], in_progress: ['In progress', 'قيد التنفيذ'],
    realized: ['Realized', 'متحقق'], missed: ['Missed', 'لم يتحقق'],
  },
  work: {
    todo: ['To do', 'للعمل'], in_progress: ['In progress', 'قيد التنفيذ'],
    blocked: ['Blocked', 'متعثر'], done: ['Done', 'مكتمل'],
  },
  portfolios: {
    on_track: ['On track', 'وفق الخطة'], at_risk: ['At risk', 'يحتاج انتباها'],
    critical: ['Critical', 'حرج'],
  },
} as const;

export function localizedStatus(domain: keyof typeof STATUS_LABELS, status: string, locale: string): string {
  const entries = STATUS_LABELS[domain] as Record<string, readonly [string, string]>;
  const label = entries[status];
  if (!label) return status.replace(/_/g, ' ');
  return locale === 'ar' || locale === 'ar-SA' ? label[1] : label[0];
}
