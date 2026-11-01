/**
 * Load authenticated onboarding and licensing as one fail-closed UI decision.
 * A failed module lookup must not be disguised as an unlicensed workspace:
 * in particular 401/403 must reach the existing bilingual Loaded boundary.
 * This is a UI guard; the API remains authoritative for every mutation.
 */
const TASK_KEYS = new Set(['workspace', 'team', 'portfolio', 'program', 'project']);
const TASK_CAPABILITIES = new Set(['read', 'pmoa_manage_people', 'pmoa_manage_projects']);
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

export function validOnboardingJourneyPayload(data, modules) {
  if (!Array.isArray(modules) || modules.length > 100 ||
      !modules.every(m => nonEmpty(m) && m.length <= 64 && /^[a-z0-9_-]+$/.test(m))) return false;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !data.tenant || typeof data.tenant !== 'object' ||
      !nonEmpty(data.tenant.name) || !nonEmpty(data.tenant.slug) ||
      !Array.isArray(data.tasks) || data.tasks.length < 1 || data.tasks.length > 5 ||
      !Number.isInteger(data.completed) || data.completed < 0 ||
      !Number.isInteger(data.total) || data.total !== data.tasks.length ||
      data.completed > data.total ||
      !Number.isInteger(data.percent) || data.percent < 0 || data.percent > 100) return false;

  const seen = new Set();
  for (const task of data.tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task) ||
        !TASK_KEYS.has(task.key) || seen.has(task.key) ||
        typeof task.completed !== 'boolean' ||
        !TASK_CAPABILITIES.has(task.capability)) return false;
    seen.add(task.key);
  }
  if (data.nextStep !== null &&
      (!TASK_KEYS.has(data.nextStep) ||
       !data.tasks.some(task => task.key === data.nextStep && !task.completed))) return false;
  return true;
}

export async function loadVerifiedOnboardingJourney(loadStatus, loadModules) {
  // Do not catch/reclassify 401, 403, or transport errors. Loaded has explicit
  // Arabic/English expired-session, forbidden, and unavailable states.
  const [data, modules] = await Promise.all([loadStatus(), loadModules()]);
  if (!validOnboardingJourneyPayload(data, modules)) {
    throw new Error('Invalid onboarding response');
  }
  return { data, modules };
}
