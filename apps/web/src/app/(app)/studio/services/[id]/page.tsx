import Link from 'next/link';
import { Page, Loaded } from '@/components/Page';
import { api } from '@/lib/api';
import { getFrontendLocale, tr } from '@/lib/i18n';
import { PublishedStudioForm } from './PublishedStudioForm';

export default async function StudioServiceIntake({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const locale=await getFrontendLocale();
  const t=await tr();
  return <Page title="Service request" sub="Submit a request against an approved published version.">
    <p><Link href="/studio/services">{t('Back')}</Link></p>
    <Loaded load={()=>api.studioCatalogItem(id)}>
      {service=>{
        const translated=service.name?.[locale];
        const name=translated?.trim()||service.name?.['en-US']||service.serviceKey;
        return <section className="panel" aria-label={locale==='ar'?'نموذج طلب الخدمة':'Service request form'}>
          <h2 lang={translated?.trim()?locale:'en'}>{name}</h2>
          <p className="dim">{locale==='ar'?'الإصدار المنشور':'Published version'}: {service.version}</p>
          <p role="note" className="dim">{locale==='ar'
            ? 'يتحقق الخادم من صلاحيات الحساب وحقول النموذج وسير الموافقات. لن تنفذ المرفقات أو الأدوات المستوردة تلقائيا.'
            : 'The server rechecks authorization, fields and workflow approvals. Attachments and imported tools never execute automatically.'}</p>
          <PublishedStudioForm id={service.id} fields={service.fields} locale={locale}/>
        </section>;
      }}
    </Loaded>
  </Page>;
}
