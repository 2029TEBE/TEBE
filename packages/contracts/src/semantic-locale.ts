/**
 * Transitional semantic keys for the shared UI vocabulary.
 *
 * This is a narrow, typed foundation, not a claim of 19 complete translations.
 * Arabic is sourced from the existing reviewed navigation catalog rather than
 * maintained in a duplicate copy. Other unreviewed languages fall back to English.
 */
import { navigationArabic } from './nav-locale';
import { resolveLocale, type LocaleCode } from './locales';

export const SEMANTIC_LABELS = Object.freeze({
  'navigation.home': 'Home',
  'navigation.projects': 'Projects',
  'navigation.portfolios': 'Portfolios',
  'navigation.reports': 'Reports',
  'navigation.settings': 'Settings',
  'navigation.documents': 'Documents',
  'navigation.financials': 'Financials',
  'navigation.benefits': 'Benefits',
  'navigation.notifications': 'Notifications',
  'navigation.integrations': 'Integrations',
  'navigation.subscriptions': 'Subscriptions',
  'navigation.resources': 'Resources',
  'navigation.stakeholders': 'Stakeholders',
  'accessibility.skipToContent': 'Skip to content',
  'accessibility.modules': 'Modules',
  'authentication.signIn': 'Sign in',
  'brand.name': 'The EPMO',
} as const);

export type SemanticLabelKey = keyof typeof SEMANTIC_LABELS;

export function semanticEnglish(key: SemanticLabelKey): string {
  return SEMANTIC_LABELS[key];
}

export function semanticLabel(key: SemanticLabelKey, requestedLocale: LocaleCode | string): string {
  const english = SEMANTIC_LABELS[key];
  // The canonical Arabic terms remain in one existing reviewed source.
  return resolveLocale(requestedLocale) === 'ar' ? navigationArabic(english) : english;
}
