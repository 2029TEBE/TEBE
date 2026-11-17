import Link from 'next/link';
import {Page,Loaded} from '@/components/Page';
import {api,getSession} from '@/lib/api';
import {getFrontendLocale} from '@/lib/i18n';
import {DelegationRevocationForm} from './DelegationRevocationForm';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function StudioRequestAudit({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const locale=await getFrontendLocale();
  const ar=locale==='ar';
  const t=(en:string,arabic:string)=>ar?arabic:en;
  const session=await getSession();
  const allowed=session.authenticated&&session.capabilities.includes('pmoa_admin');
  return <Page title={t('Studio request audit history','سجل تدقيق طلب الاستوديو')}
    sub={t('Tenant-admin only · read-only records','للمسؤول فقط · سجلات للقراءة فقط')}>
    <p><Link href="/studio/services/escalations">{t('Back to escalations','العودة إلى التصعيدات')}</Link></p>
    {!allowed?<p role="alert">{t('Studio administrator permission required.','صلاحية مسؤول الاستوديو مطلوبة.')}</p>:
      !uuid.test(id)?<p role="alert">{t('Invalid request reference.','معرف الطلب غير صالح.')}</p>:
      <Loaded load={()=>api.studioRequestAudit(id)}>
        {audit=><div>
          <p><strong>{t('Request','الطلب')}:</strong> <code>{audit.requestId}</code> · <strong>{t('Current stage','المرحلة الحالية')}:</strong> {audit.phase}</p>
          <p role="note">{t('History only. No approval, rejection, reassignment, notification or fulfillment is performed here.',
            'سجل فقط. لا يتم تنفيذ موافقة أو رفض أو إعادة إسناد أو إشعار أو استيفاء من هذه الصفحة.')}</p>
          <section aria-label={t('Delegation history','سجل التفويض')}>
            <h2>{t('Delegation history','سجل التفويض')}</h2>
            {audit.delegations.length===0?<p>{t('No delegation records.','لا توجد سجلات تفويض.')}</p>:
              <div className="design-table-scroll" tabIndex={0}><table>
                <thead><tr><th scope="col">{t('Date','التاريخ')}</th><th scope="col">{t('Stage','المرحلة')}</th><th scope="col">{t('Original approver','المعتمد الأصلي')}</th><th scope="col">{t('Delegate','المفوض إليه')}</th><th scope="col">{t('Admin','المسؤول')}</th><th scope="col">{t('Reason','السبب')}</th><th scope="col">{t('Expiry / revocation','الانتهاء والإلغاء')}</th></tr></thead>
                <tbody>{audit.delegations.map(row=><tr key={row.id}>
                  <td><time dateTime={row.createdAt}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.createdAt))}</time></td>
                  <td>{row.step}</td><td><code>{row.originalApproverId}</code></td><td><code>{row.delegateId}</code></td><td><code>{row.delegatedBy}</code></td><td>{row.reason}</td>
                  <td>{row.revoked?t('Revoked','ملغى'):row.expiresAt&&new Date(row.expiresAt).getTime()<=Date.now()?t('Expired','منتهي'):
                    <><p>{row.expiresAt?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.expiresAt)):t('Legacy permanent grant','تفويض قديم دائم')}</p>
                    {audit.phase===row.step&&<DelegationRevocationForm requestId={audit.requestId} delegationId={row.id} locale={locale}/>}</>}</td>
                </tr>)}</tbody>
              </table></div>}
          </section>
          <section aria-label={t('Revocation history','سجل إلغاء التفويض')}>
            <h2>{t('Revocation history','سجل إلغاء التفويض')}</h2>
            {audit.revocations.length===0?<p>{t('No revocations recorded.','لا توجد عمليات إلغاء مسجلة.')}</p>:
             <ul>{audit.revocations.map(item=><li key={item.id}>
              <time dateTime={item.createdAt}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.createdAt))}</time>
              {' · '}<code>{item.delegationId}</code>{' · '}{item.reason}
             </li>)}</ul>}
          </section>
          <section aria-label={t('Escalation review history','سجل مراجعة التصعيد')}>
            <h2>{t('Escalation review history','سجل مراجعة التصعيد')}</h2>
            {audit.reviews.length===0?<p>{t('No escalation reviews.','لا توجد مراجعات تصعيد.')}</p>:
              <div className="design-table-scroll" tabIndex={0}><table>
                <thead><tr><th scope="col">{t('Date','التاريخ')}</th><th scope="col">{t('Stage','المرحلة')}</th><th scope="col">{t('Reviewer','المراجع')}</th><th scope="col">{t('Action recorded','الإجراء المسجل')}</th><th scope="col">{t('Note','الملاحظة')}</th></tr></thead>
                <tbody>{audit.reviews.map(row=><tr key={row.id}>
                  <td><time dateTime={row.createdAt}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.createdAt))}</time></td>
                  <td>{row.step}</td><td><code>{row.reviewedBy}</code></td><td>{row.action}</td><td>{row.note}</td>
                </tr>)}</tbody>
              </table></div>}
          </section>
        </div>}
      </Loaded>}
  </Page>;
}
