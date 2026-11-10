/** Shared reports English-source to Arabic catalog. */
const AR = Object.freeze({
  "Reporting & Exports": "التقارير والتصدير",
  "Board packs generated from live data rather than assembled by hand.": "حزم مجلس الإدارة من بيانات العمل الفعلية دون تجميعها يدويا.",
  "No report definitions yet.": "لا توجد تعريفات تقارير بعد.",
  "Reporting overview": "ملخص التقارير",
  "REPORTING OVERVIEW": "التقارير التنفيذية",
  "Report catalogue": "قائمة التقارير",
  "Board pack": "حزمة المجلس",
  "On demand": "عند الطلب",
  "Never generated": "لم يصدر بعد",
  "Open shared board pack": "فتح حزمة مجلس الإدارة المشتركة",
  "Each link in the table opens the shared board pack, not a separate preview of that report definition.": "كل رابط في الجدول يفتح حزمة مجلس الإدارة المشتركة، وليس معاينة منفصلة لكل تعريف تقرير.",
});
export function reportsArabic(english: string): string {
  return (AR as Readonly<Record<string,string>>)[english] ?? english;
}
