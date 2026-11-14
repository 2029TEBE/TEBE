import { UiText } from '@/components/UiLocale';
import { api, getSession } from '@/lib/api';
import { can, type Capability } from '@pmo/contracts';
import Link from 'next/link';
import { Page, Loaded } from '@/components/Page';
import { NewRecord, Flash } from '@/components/NewRecord';
import { ProjectsTable } from './ProjectsTable';
import { getLang, tr } from '@/lib/i18n';

export default async function ProjectsPage({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string; health?: string; program?: string; new?: string }> }) {
  const { error, done, health, program, new: openForm } = await searchParams;
  const programFilter = program && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(program) ? program : undefined;
  const lang = await getLang();
  const t = await tr();
  const session = await getSession();
  const capabilities = (session.authenticated ? session.capabilities : []) as Capability[];
  const licensedModules = await api.enabledModules().catch(() => ['core360']);
  const mayCreate = can(capabilities, 'pmoa_manage_projects') && licensedModules.includes('pmo360');
  return (
    <Page title={lang === 'ar' ? 'المشاريع' : 'Projects'}
          sub={lang === 'ar'
            ? 'تابع الميزانيات والحالة والتقدم. يبدأ كل مشروع مع بوابات الحوكمة.'
            : 'Everything being delivered, with budget, health and progress. Creating a project also opens its first gate.'}>
      <Flash error={error} done={done} lang={lang} />
      <Loaded load={async () => ({ d: await api.projects(programFilter), o: await api.createOptions() })}>
        {({ d, o }) => (
          <>
            {d.items.length > 0 && <section className="design-context" aria-label={lang === 'ar' ? 'ملخص المشاريع' : 'Project snapshot'}>
              <div className="design-context-head"><span className="design-kicker"><UiText text={lang === 'ar' ? 'متابعة التنفيذ' : 'DELIVERY SNAPSHOT'} /></span>
                <h2><UiText text={lang === 'ar' ? 'صحة المشاريع الحالية' : 'Project delivery at a glance'} /></h2>
                <p><UiText text={lang === 'ar' ? 'مؤشرات من سجلات المشاريع المسترجعة في الصفحة الحالية فقط.' : 'Metrics reflect returned project records only; they are not portfolio-wide totals when the API is paginated.'} /></p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'السجلات المعروضة' : 'Returned projects'} /></small><strong>{d.items.length}</strong></div>
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'وفق الخطة' : 'On track'} /></small><strong>{d.items.filter((project: any) => project.health === 'on_track').length}</strong></div>
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'تحتاج انتباها' : 'Need attention'} /></small><strong>{d.items.filter((project: any) => project.health === 'at_risk' || project.health === 'critical').length}</strong></div>
              </div>
            </section>}
            {o.programs.length === 0 && <section className="panel" style={{ marginBottom: 16 }}> 
              <h2 className="sec" style={{ marginTop: 0 }}>
                <UiText text={lang === 'ar' ? 'جهّز هيكل مشروعك' : 'Set up your project structure'} />
              </h2>
              <p className="dim"><UiText text={lang === 'ar'
                ? 'يمكنك إنشاء مشروع مستقل الآن، لكن ننصح بإنشاء محفظة وبرنامج أولاً لربطه بالأهداف الاستراتيجية.'
                : 'You can create a standalone project now, but we recommend a portfolio and programme first to connect it to your strategy.'} /></p>
              <Link href="/portfolios?new=portfolio">
                <UiText text={lang === 'ar' ? 'فتح إعداد المحفظة والبرنامج' : 'Set up portfolio and programme'} />
              </Link>
            </section>}
            {mayCreate ? <NewRecord lang={lang} kind="project" title="New project" cta="Create project" returnTo="/projects" initialOpen={openForm === 'project'}
              intro="The project is created with all seven stage gates. SG0 Concept opens immediately, with its checklist and an accountable owner, so it can be governed straight away."
              fields={[
                { name: 'code', label: 'Project code', required: true, minLength: 2, maxLength: 16, pattern: '[A-Za-z0-9-]{2,16}', placeholder: 'ANR',
                  hint: '2–16 letters, digits or hyphens. Unique in this workspace.' },
                { name: 'name', label: 'Project name', required: true, placeholder: 'Al-Nakheel Residential Complex' },
                { name: 'programId', label: 'Programme', type: 'select',
                  defaultValue: o.programs.some((p: any) => p.id === programFilter) ? programFilter : undefined,
                  options: o.programs.map((p: any) => ({ value: p.id, label: `${p.portfolio} — ${p.name}` })),
                  hint: o.programs.length ? undefined : 'Create a portfolio and programme first to group projects.' },
                { name: 'ownerId', label: 'Owner', type: 'select',
                  options: o.people.map((p: any) => ({ value: p.id, label: p.name })),
                  hint: 'Becomes the accountable approver on the first gate.' },
                { name: 'status', label: 'Status', type: 'select', required: true, options: [
                  { value: 'planning', label: 'Planning' }, { value: 'active', label: 'Active' },
                  { value: 'on_hold', label: 'On hold' }, { value: 'closed', label: 'Closed' }] },
                { name: 'budgetAmount', label: 'Budget (SAR)', type: 'number', min: 0, step: 'any', placeholder: '680000000' },
                { name: 'startDate', label: 'Start date', type: 'date' },
                { name: 'endDate', label: 'Target finish', type: 'date' },
                { name: 'withGates', label: 'Create the seven stage gates', type: 'checkbox', defaultChecked: true },
              ]} /> : <p className="dim"><UiText text={lang === 'ar'
                ? 'إنشاء المشاريع يتطلب الصلاحية المناسبة وتفعيل وحدة إدارة المشاريع.'
                : 'Creating projects requires project-management permission and an enabled PMO module.'} /></p>}
            {programFilter && <p className="filtered"><UiText text={lang === 'ar' ? 'البرنامج:' : 'Programme:'} />{' '}
              <strong>{o.programs.find((p: any) => p.id === programFilter)?.name ??
                (lang === 'ar' ? 'غير متاح' : 'Unavailable')}</strong>{' '}
              <Link href="/projects"><UiText text={lang === 'ar' ? 'عرض كل المشاريع' : 'Show all projects'} /></Link>
            </p>}
            {d.items.length === 0 ? (
              <div className="empty"><strong><UiText text={lang === 'ar' ? 'لا توجد مشاريع بعد' : 'No projects yet'} /></strong>
                <p>{mayCreate
                  ? (lang === 'ar' ? 'أنشئ مشروعك الأول أعلاه مع بوابات الحوكمة.' : 'Create your first project above with its governance gates.')
                  : (lang === 'ar' ? 'اطلب من مسؤول مخوّل إنشاء أول مشروع.' : 'Ask an authorized administrator to create the first project.')}</p></div>
            ) : (
              <>
                {health && (
                  <p className="filtered">
                    <UiText text={t('Showing only')} /> <strong><UiText text={t(health.replace(/_/g, ' '))} /></strong> <UiText text={t('projects')} />.{' '}
                    <a href="/projects"><UiText text={t('Show all')} /></a>
                  </p>
                )}
                <ProjectsTable lang={lang}
                  rows={(health
                    ? (d.items as any[]).filter((p) => p.health === health)
                    : (d.items as any[]))} />
              </>
            )}
          </>
        )}
      </Loaded>
    </Page>
  );
}
