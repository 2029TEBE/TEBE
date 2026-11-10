/** Shared getting-started-extra English-source to Arabic catalog. */
const AR = Object.freeze({
  "Trial time remaining: {days} days. Finish workspace setup and review your plan before the trial ends.": "المتبقي من التجربة: {days} أيام. أكمِل إعداد مساحة العمل وراجع خطة الاشتراك قبل انتهاء التجربة.",
  "Trial guidance": "إرشادات الفترة التجريبية",
  "Your workspace trial": "الفترة التجريبية لمساحة العمل",
  "Review plan and renewal": "مراجعة الخطة والتجديد",
  "The subscription has expired. Commercial modules may be unavailable until renewal is confirmed.": "انتهت صلاحية الاشتراك. قد تكون الوحدات التجارية غير متاحة حتى تأكيد التجديد.",
  "Open billing": "فتح الفوترة",
  "Trial success checklist": "خطوات نجاح التجربة",
  "Trial success goals": "أهداف نجاح التجربة",
  "Illustrative sample only — not real data or a saved project:": "مثال توضيحي فقط، وليس بيانات فعلية أو مشروعاً محفوظاً:",
  "risks": "مخاطر",
  "decision": "قرار",
});
export function gettingStartedExtraArabic(english: string): string {
  return (AR as Readonly<Record<string,string>>)[english] ?? english;
}
