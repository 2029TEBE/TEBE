import { api } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { Flash } from '@/components/NewRecord';
import { getLang, getFrontendLocale, tr } from '@/lib/i18n';
import { directionForLocale, formatNumber } from '@/lib/locale-format.mjs';
import type { T } from '@pmo/contracts';
import { when } from '@/lib/fmt';

const COLS = [
  ['todo', 'To do'], ['in_progress', 'In progress'],
  ['blocked', 'Blocked'], ['done', 'Done'],
] as const;

/**
 * Moving a card is a plain form POST, not a drag gesture.
 *
 * A drag needs JavaScript, a pointer and a steady hand; a button works on a
 * phone, on a touchpad, with a keyboard and with the client bundle broken —
 * and it goes through the same audited write path as every other change.
 */
function Move({ id, to, label, glyph, taskTitle, t }:
  { id: string; to: string; label: string; glyph: string; taskTitle: string; t: T }) {
  const title = t('Move to {state}').replace('{state}', label);
  const accessibleLabel = t('Move {task} to {state}')
    .replace('{task}', taskTitle).replace('{state}', label);
  return (
    <form method="post" action="/api/govern">
      <input type="hidden" name="intent" value="task" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="state" value={to} />
      <input type="hidden" name="returnTo" value="/board" />
      <button type="submit" className="movebtn"
              title={title} aria-label={accessibleLabel}>{glyph}</button>
    </form>
  );
}

export default async function BoardPage({ searchParams }:
  { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const lang = await getLang();
  const locale = await getFrontendLocale();
  const tx = await tr();
  const rtl = directionForLocale(locale) === 'rtl';
  return (
    <Page title={tx('Work Board')}
          sub={tx('Day-to-day work across the portfolio, by workflow state. Use the arrows on a card to move it — every move is recorded in the audit trail.')}>
      <Flash error={error} done={done} lang={lang} />
      <Loaded load={api.tasks} empty={tx('No tasks yet.')}>
        {(tasks) => (
          <>
            <section className="design-context" aria-label={tx('Work board snapshot')}>
              <div className="design-context-head">
                <span className="design-kicker">{tx('TASK DELIVERY')}</span>
                <h2>{tx('Status of returned tasks')}</h2>
                <p>{tx('These figures count tasks returned by this API response, not necessarily every task across the workspace.')}</p>
              </div>
              <div className="design-summary">
                <div className="design-metric"><small>{tx('Returned tasks')}</small><strong>{formatNumber(tasks.length, locale)}</strong></div>
                <div className="design-metric"><small>{tx('Blocked tasks')}</small><strong>{formatNumber(tasks.filter((task: { state: string }) => task.state === 'blocked').length, locale)}</strong></div>
                <div className="design-metric"><small>{tx('Completed tasks')}</small><strong>{formatNumber(tasks.filter((task: { state: string }) => task.state === 'done').length, locale)}</strong></div>
              </div>
            </section>
            <div className="board">
            {COLS.map(([state, label], i) => {
              const col = tasks.filter((t) => t.state === state);
              const prev = COLS[i - 1];
              const next = COLS[i + 1];
              return (
                <section key={state} className="col" aria-label={t(label)}>
                  <header>{t(label)} <span className="count" aria-label={tx('{count} tasks').replace('{count}', formatNumber(col.length, locale))}>{formatNumber(col.length, locale)}</span></header>
                  {col.length === 0
                    ? <p className="dim" style={{ padding: '8px 2px' }}>—</p>
                    : col.map((t) => (
                        <article key={t.id} className={`tcard${state === 'blocked' ? ' blocked' : ''}`}>
                          <div className="num dim"><bdi>{t.projectCode}</bdi></div>
                          <strong><bdi>{t.title}</bdi></strong>
                          <div className="dim">
                            <bdi>{t.assignee ?? tx('unassigned')}</bdi>
                            {t.dueDate && <> {' · '}{tx('due')} <time dateTime={t.dueDate}>{when(t.dueDate, locale)}</time></>}
                          </div>
                          <div className="moverow">
                            {prev ? <Move id={t.id} to={prev[0]} label={t(prev[1])}
                                          glyph={rtl ? '→' : '←'} t={tx} taskTitle={t.title} />
                                  : <span />}
                            {next ? <Move id={t.id} to={next[0]} label={t(next[1])}
                                          glyph={rtl ? '←' : '→'} t={tx} taskTitle={t.title} />
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
