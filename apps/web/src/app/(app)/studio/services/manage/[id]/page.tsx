import Link from 'next/link';
import {api} from '@/lib/api';
import {Page,Loaded} from '@/components/Page';
import {getFrontendLocale} from '@/lib/i18n';

export default async function StudioTranslationReadiness({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const locale=await getFrontendLocale(),ar=locale==='ar';
 return <Page title="Service translation readiness" sub="Publishing requires complete, reviewed labels for every supported locale.">
   <p><Link href="/studio/services">{ar?'العودة إلى دليل الخدمات':'Back to governed services'}</Link></p>
   <Loaded load={()=>api.studioReadiness(id)}>
     {report=><section className="panel" aria-labelledby="studio-readiness-status">
       <h2 id="studio-readiness-status">{ar?'جاهزية تعريف الخدمة':'Service definition readiness'}</h2>
       <p>{ar?'الحالة':'State'}: <strong>{report.state}</strong></p>
       <p role="status">{report.publishable
         ? (ar?'اجتاز تعريف الخدمة فحص اللغات والحقول. ما زالت الموافقات والصلاحيات إلزامية.':'The definition passes locale and field validation; independent approval and authorization are still mandatory.')
         : (ar?'النشر محظور حتى معالجة جميع الملاحظات.':'Publishing is blocked until all diagnostics are resolved.')}</p>
       <p>{ar?'اللغات المطلوبة':'Required locales'}: {report.requiredLocales.join(', ')}</p>
       {report.missing.length>0&&<div role="region" tabIndex={0} aria-label={ar?'ملاحظات الترجمة':'Missing translations'}>
         <h3>{ar?'عناصر غير مكتملة':'Incomplete elements'} ({report.missing.length})</h3>
         <ul>{report.missing.map((failure,index)=><li key={index}><code>{failure}</code></li>)}</ul>
       </div>}
       <p className="dim">{ar
         ? 'الترجمة الآلية أو النص الإنجليزي البديل لا يعدان ترجمة معتمدة. لا يغير هذا الفحص حالة النشر.'
         : 'Automatic translation and English fallback are not evidence of reviewed coverage. This inspection never changes publication state.'}</p>
     </section>}
   </Loaded>
 </Page>;
}
