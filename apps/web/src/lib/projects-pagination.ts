/** Accept only canonical, UTC API cursor timestamps for safe navigation. */
export function validProjectCursor(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 40) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? value : undefined;
}

/** Preserve signed-in project view scope, not an arbitrary redirect target. */
export function projectPageHref(cursor: string | null, program?: string, health?: string): string {
  const params = new URLSearchParams();
  if (program) params.set('program', program);
  if (health) params.set('health', health);
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query ? `/projects?${query}` : '/projects';
}

/** Unrecognized URL filters must never silently hide every project. */
export function validProjectHealth(value: unknown): 'on_track' | 'at_risk' | 'critical' | undefined {
  return value === 'on_track' || value === 'at_risk' || value === 'critical' ? value : undefined;
}
