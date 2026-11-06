import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, getSession } from '@/lib/api';
import { Page, Loaded } from '@/components/Page';
import { getLang } from '@/lib/i18n';

/** Global account visibility is reserved for platform administrators, not workspace owners. */
export default async function Accounts({ searchParams }: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const session = await getSession();
  if (!session.authenticated) redirect('/login');
  if (!session.capabilities.includes('pmoa_platform')) redirect('/');
  const ar = (await getLang()) === 'ar';
  const tx = (en: string, arabic: string) => ar ? arabic : en;
  const { q = '', cursor } = await searchParams;
  const date = (value: string | null) => value
    ? new Intl.DateTimeFormat(ar ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value))
    : tx('Never signed in', 'لم يسجّل الدخول');
  const href = (next?: string) => {
    const params = new URLSearchParams({ q });
    if (next) params.set('cursor', next);
    return `/super-admin/users?${params}`;
  };
  return <Page title={tx('All accounts', 'جميع الحسابات')}
    sub={tx('Registered accounts across all workspaces. Only platform administrators can view this directory.',
      'الحسابات المسجلة في جميع مساحات العمل. يقتصر عرض هذا الدليل على مسؤولي المنصة.')}>
    <p><Link href="/super-admin">{tx('Subscriptions and workspaces', 'الاشتراكات ومساحات العمل')}</Link></p>
    <form method="get" action="/super-admin/users" role="search" className="panel"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', marginBlockEnd: 20 }}>
      <label>{tx('Search name, email or username', 'البحث بالاسم أو البريد الإلكتروني أو اسم المستخدم')}
        <input type="search" name="q" maxLength={100} defaultValue={q}/>
      </label>
      <button type="submit" className="btn">{tx('Search', 'بحث')}</button>
      <Link href="/super-admin/users">{tx('Clear search', 'مسح البحث')}</Link>
    </form>
    <Loaded load={() => api.superAdminAccounts(q, cursor)}>{result => <>
      <p role="status">{tx(`Showing ${result.items.length} accounts on this page`, `عرض ${result.items.length} حسابًا في هذه الصفحة`)}</p>
      {result.items.length === 0 && <p className="panel">{tx('No accounts match this search.', 'لا توجد حسابات تطابق البحث.')}</p>}
      <div className="modgrid">
        {result.items.map(account => <article className="modcard" key={account.id}>
          <h2>{account.displayName}</h2>
          <p dir="ltr">{account.email}</p>
          <dl>
            <dt>{tx('Username', 'اسم المستخدم')}</dt><dd>{account.username ?? '—'}</dd>
            <dt>{tx('Account status', 'حالة الحساب')}</dt><dd>{account.isActive ? tx('Active', 'نشط') : tx('Disabled', 'معطّل')}</dd>
            <dt>{tx('Platform administrator', 'مسؤول المنصة')}</dt><dd>{account.isPlatformAdmin ? tx('Yes', 'نعم') : tx('No', 'لا')}</dd>
            <dt>{tx('Registered (UTC)', 'تاريخ التسجيل (UTC)')}</dt><dd>{date(account.createdAt)}</dd>
            <dt>{tx('Last sign-in (UTC)', 'آخر دخول (UTC)')}</dt><dd>{date(account.lastLoginAt)}</dd>
          </dl>
          <h3>{tx('Workspace memberships', 'عضويات مساحات العمل')}</h3>
          {account.workspaces.length === 0 ? <p>{tx('No workspace memberships', 'لا توجد عضويات في مساحات العمل')}</p>
            : <ul>{account.workspaces.map(workspace => <li key={workspace.id}>
              <strong>{workspace.name}</strong> ({workspace.slug}) — {workspace.role}
              {!workspace.isActive && <> · {tx('Membership suspended', 'العضوية موقوفة')}</>}
            </li>)}</ul>}
        </article>)}
      </div>
      <nav aria-label={tx('Account pages', 'صفحات الحسابات')} style={{ display: 'flex', gap: 20, marginBlockStart: 20 }}>
        {cursor && <Link href={href()}>{tx('First page', 'الصفحة الأولى')}</Link>}
        {result.nextCursor && <Link href={href(result.nextCursor)}>{tx('Next page', 'الصفحة التالية')}</Link>}
      </nav>
    </>}</Loaded>
  </Page>;
}
