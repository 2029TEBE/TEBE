import { UiText } from '@/components/UiLocale';
import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { Flash } from '@/components/NewRecord';
import { getLang } from '@/lib/i18n';
import { when } from '@/lib/fmt';

const COLS = [
  ['todo', 'To do', 'للعمل'], ['in_progress', 'In progress', 'قيد التنفيذ'],
  ['blocked', 'Blocked', 'متعثر'], ['done', 'Done', 'مكتمل'],
] as const;

/**
 * Moving a card is a plain form POST, not a drag gesture.
 *
 * A drag needs JavaScript, a pointer and a steady hand; a button works on a
 * phone, on a touchpad, with a keyboard and with the client bundle broken —
 * and it goes through the same audited write path as every other change.
 */
function Move({ id, to, label, glyph, lang, taskTitle }:
  { id: string; to: string; label: string; glyph: string; lang: 'ar' | 'en'; taskTitle: string }) {
  return (
    <form method="post" action="/api/govern">
      <input type="hidden" name="intent" value="task" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="state" value={to} />
      <input type="hidden" name="returnTo" value="/board" />
      <button type="submit" className="movebtn"
              title={lang === 'ar' ? `نقل إلى ${label}` : `Move to ${label}`}
              aria-label={lang === 'ar' ? `نقل المهمة ${taskTitle} إلى ${label}` : `Move ${taskTitle} to ${label}`}>{glyph}</button>
    </form>
  );
}

export default async function BoardPage({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const lang = await getLang();
  return (
    <Page title={lang === 'ar' ? 'لوحة العمل' : 'Work Board'}
          sub={lang === 'ar'
            ? 'المهام حسب حالة التنفيذ. استخدم الأسهم لنقل المهمة بين الحالات؛ وتوثق كل حركة في سجل التدقيق.'
            : 'Day-to-day work across the portfolio, by workflow state. Use the arrows on a card to move it — every move is recorded in the audit trail.'}>
      <Flash error={error} done={done} lang={lang} />
      <Loaded load={api.tasks} empty={lang === 'ar' ? 'لا توجد مهام بعد.' : 'No tasks yet.'}>
        {(tasks) => (
          <>
            <section className="design-context" aria-label={lang === 'ar' ? 'ملخص لوحة العمل' : 'Work board snapshot'}>
              <div className="design-context-head">
                <span className="design-kicker"><UiText text={lang === 'ar' ? 'متابعة المهام' : 'TASK DELIVERY'} /></span>
                <h2><UiText text={lang === 'ar' ? 'وضع المهام المعروضة' : 'Status of returned tasks'} /></h2>
                <p><UiText text={lang === 'ar'
                  ? 'تعكس المؤشرات المهام التي أعادتها واجهة البيانات الحالية، ولا تمثل بالضرورة جميع مهام المؤسسة.'
                  : 'These figures count tasks returned by this API response, not necessarily every task across the workspace.'} /></p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'المهام المعروضة' : 'Returned tasks'} /></small><strong>{tasks.length}</strong></div>
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'مهام متعثرة' : 'Blocked tasks'} /></small><strong>{tasks.filter((task: { state: string }) => task.state === 'blocked').length}</strong></div>
                <div className="design-metric"><small><UiText text={lang === 'ar' ? 'مهام مكتملة' : 'Completed tasks'} /></small><strong>{tasks.filter((task: { state: string }) => task.state === 'done').length}</strong></div>
              </div>
            </section>
            <div className="board">
            {COLS.map(([state, label, labelAr], i) => {
              const col = tasks.filter((t) => t.state === state);
              const prev = COLS[i - 1];
              const next = COLS[i + 1];
              return (
                <section key={state} className="col" aria-label={lang === 'ar' ? labelAr : label}>
                  <header>{lang === 'ar' ? labelAr : label} <span className="count" aria-label={lang === 'ar' ? `عدد المهام: ${col.length}` : `${col.length} tasks`}>{col.length}</span></header>
                  {col.length === 0
                    ? <p className="dim" style={{ padding: '8px 2px' }}>—</p>
                    : col.map((t) => (
                        <article key={t.id} className={`tcard${state === 'blocked' ? ' blocked' : ''}`}>
                          <div className="num dim"><bdi>{t.projectCode}</bdi></div>
                          <strong><bdi>{t.title}</bdi></strong>
                          <div className="dim">
                            <bdi>{t.assignee ?? (lang === 'ar' ? 'غير معين' : 'unassigned')}</bdi>
                            {t.dueDate && <> {' · '}<UiText text={lang === 'ar' ? 'الاستحقاق' : 'due'} /> <time dateTime={t.dueDate}>{when(t.dueDate, lang)}</time></>}
                          </div>
                          <div className="moverow">
                            {prev ? <Move id={t.id} to={prev[0]} label={lang === 'ar' ? prev[2] : prev[1]}
                                          glyph={lang === 'ar' ? '→' : '←'} lang={lang} taskTitle={t.title} />
                                  : <span />}
                            {next ? <Move id={t.id} to={next[0]} label={lang === 'ar' ? next[2] : next[1]}
                                          glyph={lang === 'ar' ? '←' : '→'} lang={lang} taskTitle={t.title} />
                                  : <span />}
                          </div>
                        </article>
                      ))}
                </section>
              );
            })}
            </div>
          </>
        )}
      </Loaded>
    </Page>
  );
}
