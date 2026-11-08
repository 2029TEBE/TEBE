/**
 * Frontend-only English-source label catalog.
 * This deliberately does not modify @pmo/contracts translations, which also
 * power the EN/AR backend document exports.
 *
 * Initially covers the shared navigation groups and a handful of stable
 * navigation terms. Missing translations intentionally show English. The
 * provided legacy Arabic label remains authoritative for existing nav items.
 * The catalog is not evidence of full DE/ZH/FR/JA language coverage.
 */
export const UI_LABELS = Object.freeze({
  'Home': { 'de-DE': 'Startseite', 'zh-CN': '首页', 'fr-FR': 'Accueil', 'ja-JP': 'ホーム' },
  'Plan & Deliver': { 'de-DE': 'Planung und Umsetzung', 'zh-CN': '规划与交付', 'fr-FR': 'Planifier et réaliser', 'ja-JP': '計画と実行' },
  'Govern': { 'de-DE': 'Governance', 'zh-CN': '治理', 'fr-FR': 'Gouvernance', 'ja-JP': 'ガバナンス' },
  'Analyse': { 'de-DE': 'Analyse', 'zh-CN': '分析', 'fr-FR': 'Analyse', 'ja-JP': '分析' },
  'Collaborate': { 'de-DE': 'Zusammenarbeit', 'zh-CN': '协作', 'fr-FR': 'Collaboration', 'ja-JP': '共同作業' },
  'Configure': { 'de-DE': 'Konfiguration', 'zh-CN': '配置', 'fr-FR': 'Configuration', 'ja-JP': '設定' },
  'Projects': { 'de-DE': 'Projekte', 'zh-CN': '项目', 'fr-FR': 'Projets', 'ja-JP': 'プロジェクト' },
  'Reports': { 'de-DE': 'Berichte', 'zh-CN': '报告', 'fr-FR': 'Rapports', 'ja-JP': 'レポート' },
  'Settings': { 'de-DE': 'Einstellungen', 'zh-CN': '设置', 'fr-FR': 'Paramètres', 'ja-JP': '設定' },
  'Skip to content': { 'de-DE': 'Zum Inhalt springen', 'zh-CN': '跳转到内容', 'fr-FR': 'Aller au contenu', 'ja-JP': '本文へスキップ' },
  'Modules': { 'de-DE': 'Module', 'zh-CN': '模块', 'fr-FR': 'Modules', 'ja-JP': 'モジュール' },
  'The EPMO': { 'de-DE': 'The EPMO', 'zh-CN': 'The EPMO', 'fr-FR': 'The EPMO', 'ja-JP': 'The EPMO' },
});

/**
 * English stays the source. Legacy Arabic is passed from existing NAV/controls
 * so this UI-only adapter never overwrites verified Arabic strings.
 */
export function uiLabel(english, locale, legacyArabic = null) {
  if (locale === 'ar-SA') return legacyArabic || english;
  if (locale === 'en') return english;
  const row = Object.hasOwn(UI_LABELS, english) ? UI_LABELS[english] : null;
  return row?.[locale] ?? english;
}

/** Missing entries are explicit QA findings, not automatic translations. */
export function uiLabelCoverage(englishLabels, locale) {
  const unique = [...new Set(englishLabels)];
  const missing = unique.filter((english) =>
    locale !== 'en' && locale !== 'ar-SA' &&
    !(Object.hasOwn(UI_LABELS, english) && Object.hasOwn(UI_LABELS[english], locale)));
  return { total: unique.length, translated: unique.length - missing.length, missing };
}
