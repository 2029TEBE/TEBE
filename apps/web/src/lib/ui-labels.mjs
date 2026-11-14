import { UI_TRANSLATIONS } from './generated-translations.mjs';
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
  "Executive decision journey": { 'ar-SA': "مسار القرار التنفيذي", 'de-DE': "Weg zur Managemententscheidung", 'zh-CN': "管理决策流程", 'fr-FR': "Parcours de décision de direction", 'ja-JP': "経営判断の流れ" },
  "FROM SIGNALS TO DECISIONS": { 'ar-SA': "من المؤشرات إلى القرار", 'de-DE': "VON SIGNALEN ZU ENTSCHEIDUNGEN", 'zh-CN': "从信号到决策", 'fr-FR': "DES SIGNAUX AUX DÉCISIONS", 'ja-JP': "兆候から意思決定へ" },
  "Turn delivery signals into accountable reviews": { 'ar-SA': "حوّل الانحرافات إلى مراجعة موثقة", 'de-DE': "Umsetzungssignale in nachvollziehbare Prüfungen überführen", 'zh-CN': "将交付信号转化为可追责的审查", 'fr-FR': "Transformer les signaux d’exécution en examens responsables", 'ja-JP': "実行状況の兆候を責任あるレビューへ" },
  "These are the current workspace API signals, not automated decisions or approvals.": { 'ar-SA': "بيانات مساحة العمل الحالية فقط. الأرقام المعروضة لا تعني اعتماد قرار أو تنفيذ إجراء.", 'de-DE': "Dies sind API-Signale des aktuellen Arbeitsbereichs, keine automatisierten Entscheidungen oder Genehmigungen.", 'zh-CN': "这些是当前工作区的 API 信号，并非自动决策或审批。", 'fr-FR': "Ces signaux proviennent de l’API de l’espace de travail actuel ; ils ne constituent ni décisions ni approbations automatisées.", 'ja-JP': "これは現在のワークスペースのAPI情報であり、自動的な意思決定や承認ではありません。" },
  "OBSERVE": { 'ar-SA': "رصد", 'de-DE': "BEOBACHTEN", 'zh-CN': "观察", 'fr-FR': "OBSERVER", 'ja-JP': "観察" },
  "Overdue register items": { 'ar-SA': "عناصر سجل متأخرة", 'de-DE': "Überfällige Registereinträge", 'zh-CN': "逾期登记事项", 'fr-FR': "Éléments de registre en retard", 'ja-JP': "期限超過の台帳項目" },
  "VERIFY": { 'ar-SA': "تحقق", 'de-DE': "PRÜFEN", 'zh-CN': "核实", 'fr-FR': "VÉRIFIER", 'ja-JP': "確認" },
  "Blocked gates needing evidence review": { 'ar-SA': "بوابات متعثرة تتطلب التحقق من الأدلة", 'de-DE': "Blockierte Phasengates mit Nachweisprüfung", 'zh-CN': "需要核查证据的受阻阶段关卡", 'fr-FR': "Jalons bloqués nécessitant une revue des preuves", 'ja-JP': "証拠確認が必要なブロック中のゲート" },
  "HUMAN DECISION": { 'ar-SA': "قرار بشري", 'de-DE': "MENSCHLICHE ENTSCHEIDUNG", 'zh-CN': "人工决策", 'fr-FR': "DÉCISION HUMAINE", 'ja-JP': "人による判断" },
  "Projects returned in the attention queue": { 'ar-SA': "مشاريع ضمن قائمة الانتباه المسترجعة", 'de-DE': "Projekte in der Aufmerksamkeitsliste", 'zh-CN': "待关注队列中返回的项目", 'fr-FR': "Projets figurant dans la file d’attention", 'ja-JP': "要対応キューに返されたプロジェクト" },
  "Check the source evidence and accountable owner before acting.": { 'ar-SA': "يجب مراجعة السجل الأصلي وصاحب الصلاحية قبل اتخاذ القرار.", 'de-DE': "Vor Maßnahmen die Originalnachweise und die verantwortliche Person prüfen.", 'zh-CN': "采取行动前，请核对原始证据及责任人。", 'fr-FR': "Vérifiez les justificatifs d’origine et le responsable avant d’agir.", 'ja-JP': "対応前に元の証拠と責任者を確認してください。" },
  "Delivery trend": { 'ar-SA': "اتجاه التنفيذ", 'de-DE': "Umsetzungstrend", 'zh-CN': "交付趋势", 'fr-FR': "Tendance de livraison", 'ja-JP': "実行傾向" },
  "Portfolio performance": { 'ar-SA': "أداء المحفظة", 'de-DE': "Portfolioleistung", 'zh-CN': "项目组合绩效", 'fr-FR': "Performance du portefeuille", 'ja-JP': "ポートフォリオ実績" },
  "Portfolio mix": { 'ar-SA': "توزيع المحفظة", 'de-DE': "Portfoliozusammensetzung", 'zh-CN': "项目组合构成", 'fr-FR': "Composition du portefeuille", 'ja-JP': "ポートフォリオ構成" },
  "Project health": { 'ar-SA': "حالة المشاريع", 'de-DE': "Projektstatus", 'zh-CN': "项目健康状况", 'fr-FR': "Santé des projets", 'ja-JP': "プロジェクトの健全性" },
  "Showing the first {shown} of {total} projects needing review.": { 'ar-SA': "عرض أول {shown} من أصل {total} مشروعًا يحتاج إلى مراجعة.", 'de-DE': "Die ersten {shown} von {total} Projekten mit Prüfbedarf werden angezeigt.", 'zh-CN': "显示需要审查的 {total} 个项目中的前 {shown} 个。", 'fr-FR': "Affichage des {shown} premiers projets sur {total} nécessitant un examen.", 'ja-JP': "要確認のプロジェクト {total} 件のうち最初の {shown} 件を表示しています。" },
  "Cumulative, by month": { 'ar-SA': "تراكمي، حسب الشهر", 'de-DE': "Kumuliert, nach Monat", 'zh-CN': "按月累计", 'fr-FR': "Cumulé, par mois", 'ja-JP': "月別累計" },
  'Skip to content': { 'de-DE': 'Zum Inhalt springen', 'zh-CN': '跳转到内容', 'fr-FR': 'Aller au contenu', 'ja-JP': '本文へスキップ' },
  'Modules': { 'de-DE': 'Module', 'zh-CN': '模块', 'fr-FR': 'Modules', 'ja-JP': 'モジュール' },
  'The EPMO': { 'de-DE': 'The EPMO', 'zh-CN': 'The EPMO', 'fr-FR': 'The EPMO', 'ja-JP': 'The EPMO' },
});

/**
 * English stays the source. Legacy Arabic is passed from existing NAV/controls
 * so this UI-only adapter never overwrites verified Arabic strings.
 */
/** Bridge historical six-locale catalog keys to TheOrg language identifiers. */
export function catalogLocale(locale) {
  return ({ ar:'ar-SA', de:'de-DE', fr:'fr-FR', ja:'ja-JP', 'en-US':'en', 'en-GB':'en' })[locale] ?? locale;
}
export function uiLabel(english, locale, legacyArabic = null) {
  locale = catalogLocale(locale);
  const row = Object.hasOwn(UI_LABELS, english) ? UI_LABELS[english] : null;
  if (locale === 'en') return english;
  // A legacy Arabic label is preferred where one exists, but a broken
  // translation must never drop or rename dynamic display placeholders.
  const candidate = locale === 'ar-SA'
    ? (typeof legacyArabic === 'string' && legacyArabic.trim() && legacyArabic !== english
      ? legacyArabic : row?.['ar-SA'] ?? UI_TRANSLATIONS.ar?.[english])
    : row?.[locale] ?? UI_TRANSLATIONS[({ 'de-DE':'de','fr-FR':'fr','ja-JP':'ja','ar-SA':'ar' })[locale] ?? locale]?.[english];
  return typeof candidate === 'string' && candidate.trim() &&
    translationHasMatchingPlaceholders(english, candidate)
      ? candidate : english;
}

/** English text is the source. Placeholders must survive translation unchanged. */
export function translationPlaceholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z][\w]*)\}/g)]
    .map((match) => match[1]).sort();
}

export function translationHasMatchingPlaceholders(english, translated) {
  return JSON.stringify(translationPlaceholders(english)) ===
    JSON.stringify(translationPlaceholders(translated));
}

/**
 * Report verified catalog coverage; legacy Arabic fallback can be supplied as
 * a map of English source text to existing Arabic translations.
 * Do not count English fallback strings as translated.
 */
export function uiLabelCoverage(englishLabels, locale, legacyArabic = {}) {
  locale = catalogLocale(locale);
  const unique = [...new Set(englishLabels)];
  const missing = [];
  const invalidPlaceholders = [];
  for (const english of unique) {
    if (locale === 'en') continue;
    const row = Object.hasOwn(UI_LABELS, english) ? UI_LABELS[english] : null;
    const legacy = locale === 'ar-SA' && Object.hasOwn(legacyArabic, english)
      ? legacyArabic[english] : null;
    const translated = typeof legacy === 'string' && legacy.trim() && legacy !== english
      ? legacy : row?.[locale] ?? UI_TRANSLATIONS[({ 'de-DE':'de','fr-FR':'fr','ja-JP':'ja','ar-SA':'ar' })[locale] ?? locale]?.[english];
    if (typeof translated !== 'string' || !translated.trim()) {
      missing.push(english);
    } else if (!translationHasMatchingPlaceholders(english, translated)) {
      invalidPlaceholders.push(english);
    }
  }
  return { total: unique.length,
    translated: unique.length - missing.length - invalidPlaceholders.length,
    missing, invalidPlaceholders };
}
