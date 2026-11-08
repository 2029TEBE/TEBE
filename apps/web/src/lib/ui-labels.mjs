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
  "Getting Started": { 'de-DE': "Erste Schritte", 'zh-CN': "入门指南", 'fr-FR': "Premiers pas", 'ja-JP': "はじめに" },
  "Executive Overview": { 'de-DE': "Managementübersicht", 'zh-CN': "管理层概览", 'fr-FR': "Vue d’ensemble de direction", 'ja-JP': "エグゼクティブ概要" },
  "My Work": { 'de-DE': "Meine Aufgaben", 'zh-CN': "我的工作", 'fr-FR': "Mon travail", 'ja-JP': "自分の作業" },
  "Attention": { 'de-DE': "Handlungsbedarf", 'zh-CN': "待关注事项", 'fr-FR': "Points d’attention", 'ja-JP': "要対応" },
  "Portfolios": { 'de-DE': "Portfolios", 'zh-CN': "项目组合", 'fr-FR': "Portefeuilles", 'ja-JP': "ポートフォリオ" },
  "Work Board": { 'de-DE': "Aufgabenboard", 'zh-CN': "工作看板", 'fr-FR': "Tableau de travail", 'ja-JP': "作業ボード" },
  "Schedule": { 'de-DE': "Zeitplan", 'zh-CN': "进度计划", 'fr-FR': "Calendrier", 'ja-JP': "スケジュール" },
  "Stage Gates": { 'de-DE': "Phasenfreigaben", 'zh-CN': "阶段关卡", 'fr-FR': "Jalons de validation", 'ja-JP': "ステージゲート" },
  "RAID Register": { 'de-DE': "RAID-Register", 'zh-CN': "RAID 登记簿", 'fr-FR': "Registre RAID", 'ja-JP': "RAID台帳" },
  "Decisions": { 'de-DE': "Entscheidungen", 'zh-CN': "决策", 'fr-FR': "Décisions", 'ja-JP': "意思決定" },
  "Approvals": { 'de-DE': "Genehmigungen", 'zh-CN': "审批", 'fr-FR': "Approbations", 'ja-JP': "承認" },
  "Analytics": { 'de-DE': "Analysen", 'zh-CN': "分析报告", 'fr-FR': "Analytique", 'ja-JP': "分析" },
  "Financials": { 'de-DE': "Finanzen", 'zh-CN': "财务", 'fr-FR': "Finances", 'ja-JP': "財務" },
  "Benefits": { 'de-DE': "Nutzen", 'zh-CN': "效益", 'fr-FR': "Bénéfices", 'ja-JP': "効果" },
  "Resources": { 'de-DE': "Ressourcen", 'zh-CN': "资源", 'fr-FR': "Ressources", 'ja-JP': "リソース" },
  "Notifications": { 'de-DE': "Benachrichtigungen", 'zh-CN': "通知", 'fr-FR': "Notifications", 'ja-JP': "通知" },
  "Import & Export": { 'de-DE': "Import und Export", 'zh-CN': "导入与导出", 'fr-FR': "Importation et exportation", 'ja-JP': "インポートとエクスポート" },
  "Power BI": { 'de-DE': "Power BI", 'zh-CN': "Power BI", 'fr-FR': "Power BI", 'ja-JP': "Power BI" },
  "Platform Studio": { 'de-DE': "Plattformstudio", 'zh-CN': "平台工作室", 'fr-FR': "Studio de plateforme", 'ja-JP': "プラットフォームスタジオ" },
  "Integrations": { 'de-DE': "Integrationen", 'zh-CN': "集成", 'fr-FR': "Intégrations", 'ja-JP': "連携" },
  "Billing & Renewals": { 'de-DE': "Abrechnung und Verlängerungen", 'zh-CN': "账单与续订", 'fr-FR': "Facturation et renouvellements", 'ja-JP': "請求と更新" },
  "Subscriptions": { 'de-DE': "Abonnements", 'zh-CN': "订阅", 'fr-FR': "Abonnements", 'ja-JP': "サブスクリプション" },
  'Documents': { 'de-DE': 'Dokumente', 'zh-CN': '文档', 'fr-FR': 'Documents', 'ja-JP': '文書' },
  'Updates': { 'de-DE': 'Aktuelles', 'zh-CN': '最新动态', 'fr-FR': 'Actualités', 'ja-JP': '更新情報' },
  'Stakeholders': { 'de-DE': 'Stakeholder', 'zh-CN': '利益相关方', 'fr-FR': 'Parties prenantes', 'ja-JP': 'ステークホルダー' },
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
