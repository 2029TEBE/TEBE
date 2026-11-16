import { Page } from '@/components/Page';
import { getLang } from '@/lib/i18n';

/**
 * Disabled-by-default .GAZE enterprise entry point. This page deliberately
 * does not accept files, submit data, release keys or call unapproved APIs.
 * Existing authenticated app layout remains the access boundary.
 */
export default async function GaizPage() {
  const lang = await getLang();
  const ar = lang === 'ar';
  const steps = ar
    ? [
        ['رفع آمن', 'استقبال الملفات ضمن مساحة عزل بعد الاعتماد'],
        ['التحقق', 'توقيع الجهة المصدرة وسلامة المحتوى ونطاق المؤسسة'],
        ['المراجعة', 'عرض آمن وربط الحقول ثم موافقة بشرية'],
        ['التسجيل', 'إنشاء مسودات مع سجل تدقيق بعد التفعيل'],
      ]
    : [
        ['Secure intake', 'Quarantined upload after security approval'],
        ['Verification', 'Issuer signature, authenticated content and tenant scope'],
        ['Review', 'Sanitized preview, field mapping and human approval'],
        ['Recording', 'Draft records and audit receipt after release approval'],
      ];
  return (
    <Page title={ar ? 'تكامل .GAZE' : '.GAZE integration'}
      sub={ar ? 'تبادل التقارير المحمية تحت تحكم المؤسسة' : 'Protected artifact exchange under enterprise control'}>
      <section className="panel" dir={ar ? 'rtl' : 'ltr'} aria-labelledby="gaiz-availability">
        <h2 id="gaiz-availability">{ar ? 'غير مفعّل حالياً' : 'Not yet enabled'}</h2>
        <p>{ar
          ? 'التكامل قيد المراجعة الأمنية. لا يمكن رفع ملفات أو فك تشفيرها أو استيراد السجلات حتى اكتمال اختبارات التوافق والعزل.'
          : '.GAZE remains under security review. Upload, decryption and record import are disabled until interoperability, authorization and tenant-isolation acceptance passes.'}</p>
        <div className="grid2">
          {steps.map(([title, description], index) => (
            <div className="panel" key={title}>
              <strong>{index + 1}. {title}</strong>
              <p>{description}</p>
            </div>
          ))}
        </div>
        <h3>{ar ? 'صيغ التصدير المخطط لها' : 'Planned export formats'}</h3>
        <p>PDF · HTML · .GAZE</p>
        <p className="dim">{ar
          ? 'التوافق: ملفات ‎.gaiz التجريبية القديمة ليست صيغة ‎.GAZE معتمدة، ولا يُعاد تسميتها أو تحويلها تلقائياً.'
          : 'Compatibility: legacy experimental .gaiz artifacts are not yet a ratified .GAZE wire format and are never silently renamed or converted.'}</p>
        <p className="dim">{ar
          ? 'تبقى خيارات تصدير التقارير الحالية مستقلة ومتاحة وفق صلاحياتها.'
          : 'Existing report exports remain separate and governed by their existing permissions.'}</p>
      </section>
    </Page>
  );
}
