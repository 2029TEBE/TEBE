import Link from 'next/link';
import {ApprovalDecision} from './review/ApprovalDecision';
import {DraftCreator,DefinitionActions,RevisionAction} from './manage/StudioGovernanceForms';
import { Page, Loaded } from '@/components/Page';
import { api } from '@/lib/api';
import { getFrontendLocale, tr } from '@/lib/i18n';

/**
 * Read-only, tenant-scoped Studio workspace.
 * Data comes exclusively from the authenticated server API: no demo fallback,
 * localStorage cache, client-supplied tenant or speculative publication.
 */
export default async function GovernedServices() {
  const locale = await getFrontendLocale();
  const t = await tr();
  const copy = (english: string, arabic: string) => locale === 'ar' ? arabic : t(english);
  const label = (name: Record<string,string> | null | undefined) => {
    const chosen = name?.[locale];
    if (chosen?.trim()) return { text:chosen, reviewed:true };
    const source = name?.['en-US'] ?? name?.['en-GB'] ?? '';
    return { text:source || copy('Unnamed service','خدمة دون اسم'), reviewed:false };
  };
  return <Page title="Business Studio" sub="Governed services, published catalog and request progress.">
    <p className="dim" role="note">
      {copy(
        'Only services explicitly authorized for your account appear in the catalog. This view cannot activate imported workflows or publish drafts.',
        'لا تظهر في دليل الخدمات إلا الخدمات المصرح بها لحسابك. لا تتيح هذه الصفحة تفعيل إجراءات مستوردة أو نشر المسودات.'
      )}
    </p>
    <p><Link href="/studio">{copy('Return to platform configuration','العودة إلى إعدادات المنصة')}</Link></p>
    <section aria-labelledby="studio-catalog-heading" className="panel">
      <h2 id="studio-catalog-heading">{copy('My service catalog','دليل الخدمات المتاحة لي')}</h2>
      <Loaded load={api.studioCatalog}>
        {items => items.length ? <ul>
          {items.map(item => {
            const name = label(item.name);
            return <li key={item.id}>
              <Link href={`/studio/services/${encodeURIComponent(item.id)}`} lang={name.reviewed ? locale : 'en'}>{name.text}</Link>
              {' · '}{copy('Version','الإصدار')} {item.version}
              {!name.reviewed && <span className="dim" lang="en">{' · '}English translation fallback</span>}
              <span className="dim">{' — '}{copy('Published for your account. Open to submit a governed request.','منشورة لحسابك. افتح الخدمة لتقديم طلب محكوم.')}</span>
            </li>;
          })}
        </ul> : <p className="dim">{copy('No services are authorized for this account.','لا توجد خدمات مصرح بها لهذا الحساب.')}</p>}
      </Loaded>
    </section>
    <section aria-labelledby="studio-approval-heading" className="panel">
      <h2 id="studio-approval-heading">{copy('My assigned approvals','الموافقات المسندة إلي')}</h2>
      <Loaded load={api.studioAssignedApprovals}>
        {items => items.length ? <div role="region" tabIndex={0} className="design-table-scroll" aria-label={copy('Assigned approval requests','طلبات الموافقة المسندة')}>
          <table><thead><tr><th scope="col">{copy('Service','الخدمة')}</th>
            <th scope="col">{copy('Step','المرحلة')}</th><th scope="col">{copy('Request','الطلب')}</th>
            <th scope="col">{copy('Decision','القرار')}</th></tr></thead><tbody>
          {items.map(item=><tr key={item.id}><td><code>{item.serviceKey}</code></td>
            <td>{item.phase}</td><td><code>{item.id}</code></td>
            <td><ApprovalDecision id={item.id} locale={locale}/></td></tr>)}
          </tbody></table></div>
          : <p className="dim">{copy('No decisions currently assigned to you.','لا توجد موافقات مسندة إليك حاليا.')}</p>}
      </Loaded>
    </section>
    <section aria-labelledby="studio-request-heading" className="panel">
      <h2 id="studio-request-heading">{copy('My service requests','طلبات الخدمات الخاصة بي')}</h2>
      <Loaded load={api.studioRequests}>
        {items => items.length ? <div role="region" tabIndex={0} className="design-table-scroll" aria-label={copy('Request status','حالة الطلبات')}>
          <table><thead><tr>
            <th scope="col">{copy('Request','الطلب')}</th>
            <th scope="col">{copy('Submitted','تاريخ التقديم')}</th>
            <th scope="col">{copy('State','الحالة')}</th>
            <th scope="col">{copy('Form version','إصدار النموذج')}</th>
            <th scope="col">{copy('Workflow version','إصدار الإجراءات')}</th>
          </tr></thead><tbody>
            {items.map(item => <tr key={item.id}>
              <td><code>{item.id}</code></td>
              <td><time dateTime={item.submittedAt}>{new Intl.DateTimeFormat(locale, {dateStyle:'medium'}).format(new Date(item.submittedAt))}</time></td>
              <td>{item.phase}</td><td className="num">{item.formVersion}</td><td className="num">{item.workflowVersion}</td>
            </tr>)}
          </tbody></table></div> : <p className="dim">{copy('You have not submitted any service requests.','لم تقدم أي طلبات خدمات بعد.')}</p>}
      </Loaded>
    </section>
    <section aria-labelledby="studio-draft-heading" className="panel">
      <h2 id="studio-draft-heading">{copy('Create a governed service draft','إنشاء مسودة خدمة محكومة')}</h2>
      <DraftCreator locale={locale}/>
    </section>
    <section aria-labelledby="studio-definition-heading" className="panel">
      <h2 id="studio-definition-heading">{copy('Governance workspace','مساحة عمل الحوكمة')}</h2>
      <Loaded load={api.studioDefinitions}>
        {items => items.length ? <div role="region" className="design-table-scroll" tabIndex={0} aria-label={copy('Service definitions','تعريفات الخدمات')}>
          <table><thead><tr>
            <th scope="col">{copy('Service','الخدمة')}</th>
            <th scope="col">{copy('Version','الإصدار')}</th>
            <th scope="col">{copy('State','الحالة')}</th><th scope="col">{copy('Review actions','إجراءات المراجعة')}</th>
          </tr></thead><tbody>
            {items.map(item => <tr key={item.id}><td><code>{item.serviceKey}</code></td>
              <td className="num">{item.version}</td><td>{item.state}</td><td><DefinitionActions id={item.id} state={item.state} locale={locale}/>{(item.state==='published'||item.state==='retired')&&<RevisionAction id={item.id} locale={locale}/>}<Link href={`/studio/services/manage/${encodeURIComponent(item.id)}`}>{copy('Check translations','فحص الترجمات')}</Link></td></tr>)}
          </tbody></table>
        </div> : <p className="dim">{copy('No definitions visible with your current permissions.','لا توجد تعريفات ظاهرة وفق صلاحياتك الحالية.')}</p>}
      </Loaded>
    </section>
    <p className="dim">{copy(
      'Locale fallback labels are not evidence of completed translation review. Publishing remains blocked until every required locale is verified.',
      'عرض النص الإنجليزي بديلا لا يعني اكتمال اعتماد الترجمة. يظل النشر محظورا حتى التحقق من جميع اللغات المطلوبة.'
    )}</p>
  </Page>;
}
