import Link from 'next/link';
import {Page,Loaded} from '@/components/Page';
import {api,getSession} from '@/lib/api';
import {getFrontendLocale} from '@/lib/i18n';

export default async function StudioEscalationTriage(){
  const locale=await getFrontendLocale(),ar=locale==='ar';
  const session=await getSession();
  const allowed=session.authenticated&&session.capabilities.includes('pmoa_admin');
  const t=(en:string,arabic:string)=>ar?arabic:en;
  return <Page title={t('Overdue Studio approvals','الموافقات المتأخرة في استوديو الأعمال')}
    sub={t('Administrator-only, read-only escalation triage','مراجعة إدارية للمهل المتأخرة دون تنفيذ آلي')}>
    <p><Link href="/studio/services">{t('Back to Studio','العودة إلى استوديو الأعمال')}</Link></p>
    <p role="note" className="dim">{t(
      'Overdue flags do not mean approval, rejection, reassignment, or notification occurred. Authorized staff must follow organizational escalation procedures.',
      'التأخير لا يعني حدوث موافقة أو رفض أو إعادة إسناد أو إشعار. يجب اتباع إجراءات التصعيد المعتمدة من المختصين.'
    )}</p>
    {!allowed ? <p role="alert">{t('Studio administrator permission required.','يتطلب العرض صلاحية مدير الاستوديو.')}</p>:
    <Loaded load={api.studioOverdueApprovals}>
      {items=>items.length?<div role="region" className="design-table-scroll" tabIndex={0}
        aria-label={t('Overdue approvals requiring human review','الموافقات المتأخرة التي تتطلب مراجعة بشرية')}>
        <table><thead><tr>
          <th scope="col">{t('Service','الخدمة')}</th>
          <th scope="col">{t('Request','الطلب')}</th>
          <th scope="col">{t('Approval stage','مرحلة الموافقة')}</th>
          <th scope="col">{t('Due date','تاريخ الاستحقاق')}</th>
          <th scope="col">{t('Required human action','الإجراء البشري المطلوب')}</th>
        </tr></thead><tbody>{items.map(item=><tr key={item.id}>
          <td><code>{item.serviceKey}</code></td>
          <td><code>{item.id}</code></td>
          <td>{item.phase}</td>
          <td>{item.sla.deadlineAt&&<time dateTime={item.sla.deadlineAt}>
            {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.sla.deadlineAt))}
          </time>}</td>
          <td><strong>{item.sla.actionRequired??'manual_review'}</strong>
            <span className="dim"> · {t('Not executed','لم ينفذ')}</span></td>
        </tr>)}</tbody></table>
      </div>:<p className="dim">{t('No overdue approvals found in this workspace.','لا توجد موافقات متأخرة في مساحة العمل.')}</p>}
    </Loaded>}
  </Page>;
}
