import Link from 'next/link';
import { trialChecklist, TRIAL_EXAMPLE } from '@/lib/trial-guidance.mjs';
import { api, getSession, type OnboardingStatus } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { getLang } from '@/lib/i18n';
import { can, GETTING_STARTED_COPY, type Capability } from '@pmo/contracts';
import { onboardingActionHref, onboardingActionLicensed } from '@/lib/onboarding-guidance';
import { effectiveSubscriptionStatus, daysUntil } from '@/lib/subscription-display.mjs';



export default async function GettingStarted() {
  const lang = await getLang();
  const text = GETTING_STARTED_COPY[lang];
  const session = await getSession();
  const capabilities: Capability[] = session.authenticated
    ? (session.capabilities as Capability[]) : [];
  const subscription = session.authenticated && session.capabilities.includes('pmoa_admin')
    ? await api.subscriptionCurrent().catch(() => null) : null;
  const licenseStatus = subscription ? effectiveSubscriptionStatus(subscription) : null;
  const trialDays = licenseStatus === 'trialing' ? daysUntil(subscription?.trialEndsAt) : null;

  return (
    <Page title={text.title} sub={text.sub}>
      {licenseStatus === 'trialing' && <section className="panel" aria-label={lang === 'ar' ? 'إرشادات الفترة التجريبية' : 'Trial guidance'} style={{ marginBlockEnd: 16 }}>
        <strong>{lang === 'ar' ? 'الفترة التجريبية لمساحة العمل' : 'Your workspace trial'}</strong>
        <p>{lang === 'ar' ? `المتبقي من التجربة: ${trialDays ?? '—'} أيام. أكمِل إعداد مساحة العمل وراجع خطة الاشتراك قبل انتهاء التجربة.` : `Trial time remaining: ${trialDays ?? '—'} days. Finish workspace setup and review your plan before the trial ends.`}</p>
        <Link href="/billing">{lang === 'ar' ? 'مراجعة الخطة والتجديد' : 'Review plan and renewal'}</Link>
      </section>}
      {licenseStatus === 'expired' && <section className="panel" role="status" style={{ marginBlockEnd: 16 }}>
        <p>{lang === 'ar' ? 'انتهت صلاحية الاشتراك. قد تكون الوحدات التجارية غير متاحة حتى تأكيد التجديد.' : 'The subscription has expired. Commercial modules may be unavailable until renewal is confirmed.'}</p>
        <Link href="/billing">{lang === 'ar' ? 'فتح الفوترة' : 'Open billing'}</Link>
      </section>}
      <Loaded load={async () => ({
        data: await api.onboarding(),
        modules: await api.enabledModules().catch(() => ['core360']),
      })}>
        {({ data, modules }: { data: OnboardingStatus; modules: string[] }) => {
          const nextTask = data.tasks.find(task => task.key === data.nextStep);
          const canOpenNext = nextTask && can(capabilities, nextTask.capability)
            && onboardingActionLicensed(nextTask.key, modules);
          return (
          <>
            <section className="panel" aria-label={text.progress}>
              <h2 className="sec" style={{ marginTop: 0 }}>{text.progress}</h2>
              <p><strong>{data.tenant.name}</strong> <span className="dim">({data.tenant.slug})</span></p>
              <div className="tiles" style={{ marginTop: 12 }}>
                <div className="tile">
                  <span>{text.completed}</span>
                  <strong>{data.completed} / {data.total}</strong>
                </div>
                <div className="tile">
                  <span>{text.progress}</span>
                  <strong>{data.percent}%</strong>
                  <div className="bar" role="progressbar" aria-label={text.progress}
                       aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.percent}>
                    <i style={{ width: `${data.percent}%` }} />
                  </div>
                </div>
              </div>
              {data.completed === data.total && <p>{text.finished}</p>}
              {licenseStatus === 'trialing' && <div style={{ marginTop: 16 }} aria-label={lang === 'ar' ? 'خطوات نجاح التجربة' : 'Trial success checklist'}>
                <h3>{lang === 'ar' ? 'أهداف نجاح التجربة' : 'Trial success goals'}</h3>
                <ol>{trialChecklist(data.tasks, lang).map(step => <li key={step.key}>
                  {step.completed ? '✓ ' : '○ '}{step.label}
                </li>)}</ol>
                <p className="dim">{lang === 'ar' ? 'مثال توضيحي فقط، وليس بيانات فعلية أو مشروعاً محفوظاً:' : 'Illustrative sample only — not real data or a saved project:'}
                  {' '}{TRIAL_EXAMPLE.project} · {TRIAL_EXAMPLE.risks} {lang === 'ar' ? 'مخاطر' : 'risks'} · {TRIAL_EXAMPLE.decisions} {lang === 'ar' ? 'قرار' : 'decision'}.
                </p>
              </div>}
            </section>

            {nextTask ? (
              <section className="panel" aria-labelledby="onboarding-next" style={{ marginTop: 16 }}>
                <h2 className="sec" id="onboarding-next" style={{ marginTop: 0 }}>{text.nextTitle}</h2>
                <p><strong>{text.tasks[nextTask.key][0]}</strong></p>
                <p className="dim">{text.nextInfo}</p>
                {canOpenNext ? (
                  <Link href={onboardingActionHref(nextTask.key)} className="btn">
                    {text.nextButton}
                  </Link>
                ) : <p className="dim">{text.nextBlocked}</p>}
              </section>
            ) : (
              <p role="status" style={{ marginTop: 16 }}>{text.allDone}: {text.finished}</p>
            )}

            <ol style={{ display: 'grid', gap: 12, paddingInlineStart: 24, marginTop: 22 }}>
              {data.tasks.map((task) => {
                const [heading, description] = text.tasks[task.key];
                const permitted = can(capabilities, task.capability);
                const licensed = onboardingActionLicensed(task.key, modules);
                const available = permitted && licensed;
                return (
                  <li key={task.key} className="panel" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div>
                        <strong>{heading}</strong>
                        <p className="dim" style={{ marginTop: 6 }}>{description}</p>
                      </div>
                      <span className={`pill ${task.completed ? 'on_track' : 's-closed'}`}>
                        {task.completed ? text.done : text.todo}
                      </span>
                    </div>
                    {available ? (
                      <Link href={onboardingActionHref(task.key)} className="btn" style={{ display: 'inline-block', marginTop: 10 }}>
                        {text.open}
                      </Link>
                    ) : (
                      <p className="dim" style={{ marginTop: 8 }}>
                        {!permitted ? text.askAdmin : text.moduleNeeded}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="dim">{text.help}</p>
            <p className="dim">{text.note}</p>
          </>
        );
        }}
      </Loaded>
    </Page>
  );
}
