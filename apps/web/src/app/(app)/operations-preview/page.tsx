import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/api';
import './preview.css';

/**
 * DEV-ONLY vendor design study. No API calls except session introspection,
 * no financial/customer data, no mutation, and not reachable in production.
 * Vendor capability filtering is a presentation gate; existing APIs remain
 * authoritative for all real administrative operations.
 */
export default async function OperationsPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const session = await getSession();
  if (!session.authenticated) redirect('/login');
  if (!session.capabilities.includes('pmoa_platform')) notFound();

  const metrics = [
    { label: 'Demo tenants', value: '24', detail: 'Synthetic placeholder', tone: 'teal' },
    { label: 'Approvals awaiting review', value: '07', detail: 'Not connected to API', tone: 'amber' },
    { label: 'Active workflow examples', value: '12', detail: 'No workflow runs', tone: 'teal' },
    { label: 'Service availability', value: '—', detail: 'Not measured', tone: 'neutral' },
  ];
  const tenants = [
    { name: 'Demo Tenant Alpha', plan: 'Enterprise sample', status: 'Active · simulated', use: '7 / 10 seats' },
    { name: 'Demo Tenant Beta', plan: 'Team sample', status: 'Trial · simulated', use: '4 / 5 seats' },
    { name: 'Demo Tenant Gamma', plan: 'Unassigned sample', status: 'Paused · simulated', use: '—' },
  ];
  return <div className="ops-study">
    <div className="ops-study-banner" role="status">DESIGN PROTOTYPE · SYNTHETIC FIXTURES · NO REAL TENANT DATA · NO AGENT EXECUTION</div>
    <div className="ops-study-heading">
      <div><div className="ops-study-kicker">THE EPMO / VENDOR OPERATIONS</div>
        <h1>Platform operations</h1>
        <p>Inspect the future control center. All figures and states below are simulated for local UX review.</p>
      </div>
      <a href="/super-admin" className="ops-study-back">Return to real Super Admin ↗</a>
    </div>
    <nav className="ops-study-nav" aria-label="Operations prototype sections">
      <a href="#ops-overview">Overview</a><a href="#ops-tenants">Customers</a>
      <a href="#ops-workflows">Workflow</a><a href="#ops-agents">AI control center</a>
      <a href="#ops-entitlements">Entitlements</a><a href="#ops-design-review">Review journey</a><a href="#ops-states">Design states</a>
    </nav>
    <section id="ops-overview" aria-labelledby="ops-overview-title">
      <div className="ops-study-sectionhead"><div><span>01 / OPERATIONS</span><h2 id="ops-overview-title">Overview at a glance</h2></div><small>Data source: synthetic fixture</small></div>
      <div className="ops-study-metrics">{metrics.map(m=><article key={m.label} className={'ops-study-metric '+m.tone}>
        <p>{m.label}</p><strong>{m.value}</strong><small>{m.detail}</small>
      </article>)}</div>
      <div className="ops-study-grid">
        <article className="ops-study-card"><h3>Operational readiness</h3><p>No telemetry endpoint has been connected. Missing values must not imply healthy status.</p>
          <div className="ops-study-notmeasured"><span aria-hidden="true">◌</span><div><strong>Service status not measured</strong><small>Requires an authorized health-monitoring contract in a later phase.</small></div></div>
        </article>
        <article className="ops-study-card"><h3>Review queue · sample</h3><p>Demonstration of visual treatment only. There are no real approval requests here.</p>
          <div className="ops-study-alert"><span className="ops-study-indicator amber">Attention</span><div><strong>License adjustment</strong><small>Demo Tenant Beta · Example request</small></div><span>Pending</span></div>
          <div className="ops-study-alert"><span className="ops-study-indicator teal">Info</span><div><strong>Workspace configuration</strong><small>Demo Tenant Alpha · Example request</small></div><span>Review</span></div>
        </article>
      </div>
    </section>
    <section id="ops-tenants" aria-labelledby="ops-tenants-title">
      <div className="ops-study-sectionhead"><div><span>02 / CUSTOMERS</span><h2 id="ops-tenants-title">Customer workspace inventory</h2></div><small>Non-identifying demo tenants</small></div>
      <div className="ops-study-card"><div className="ops-study-tablewrap"><table><caption className="ops-study-visuallyhidden">Synthetic customer list</caption>
        <thead><tr><th scope="col">Workspace</th><th scope="col">Plan</th><th scope="col">Status</th><th scope="col">Capacity example</th><th scope="col">Action</th></tr></thead>
        <tbody>{tenants.map(t=><tr key={t.name}><td><strong>{t.name}</strong><small>DEMO DATA</small></td><td>{t.plan}</td><td><span className="ops-study-indicator teal">{t.status}</span></td><td>{t.use}</td><td><a href="#ops-workflows">Inspect sample</a></td></tr>)}</tbody>
      </table></div></div>
    </section>
    <section id="ops-workflows" aria-labelledby="ops-workflow-title">
      <div className="ops-study-sectionhead"><div><span>03 / WORKFLOW MONITOR</span><h2 id="ops-workflow-title">A governable execution path</h2></div><small>Visual playthrough · no execution</small></div>
      <article className="ops-study-card">
        <p>Every simulated step is a proposed interface state. There are no configured jobs, queues, retries or network requests behind this diagram.</p>
        <div className="ops-study-flow" aria-label="Concept workflow: organization, department, agent, approval gate, audit record">
          {['Organization','Department','AI assistant concept','Human approval gate','Audit trail'].map((n,i)=><div key={n} className="ops-study-node">
            <small>STEP {String(i+1).padStart(2,'0')}</small><strong>{n}</strong><span>{['Demo workspace','Governance team','Proposed, not running','Awaiting a human','Immutable evidence concept'][i]}</span>
          </div>)}
        </div>
        <p className="ops-study-note">Design note: future integrations need explicit authorization, scopes, cost guardrails and an audit-backed execution service.</p>
      </article>
    </section>
    <section id="ops-agents" aria-labelledby="ops-agents-title">
      <div className="ops-study-sectionhead"><div><span>04 / AI GOVERNANCE</span><h2 id="ops-agents-title">AI agents control center</h2></div><small>Concept only · zero running agents</small></div>
      <div className="ops-study-grid"><article className="ops-study-card">
        <h3>Agent directory</h3>
        <div className="ops-study-agent"><div className="ops-study-avatar">G</div><div><strong>Governance analyst · concept</strong><small>Scope proposal: read governance evidence</small></div><span className="ops-study-indicator amber">Proposed</span></div>
        <div className="ops-study-agent"><div className="ops-study-avatar">R</div><div><strong>Reporting assistant · concept</strong><small>Scope proposal: draft report summaries</small></div><span className="ops-study-indicator neutral">Not configured</span></div>
        <button disabled type="button" title="A production execution service does not exist">Run agent — unavailable</button>
      </article><article className="ops-study-card"><h3>Execution guardrails</h3>
        <dl className="ops-study-dl"><div><dt>Model / provider</dt><dd>Not connected</dd></div><div><dt>Estimated spend</dt><dd>Not measured</dd></div><div><dt>Approval policy</dt><dd>Human confirmation required</dd></div><div><dt>Tenant scope</dt><dd>Not configured</dd></div></dl>
        <p className="ops-study-note">No vendor-wide access or data action can be inferred from this example.</p>
      </article></div>
    </section>
    <section id="ops-entitlements" aria-labelledby="ops-entitlements-title">
      <div className="ops-study-sectionhead"><div><span>05 / ENTITLEMENTS</span><h2 id="ops-entitlements-title">Plan and access concept</h2></div><small>Illustrative plan names · no billing data</small></div>
      <div className="ops-study-grid">
        <article className="ops-study-card"><h3>Sample capability matrix</h3><p>Proposed presentation of licensed capabilities. No entitlements are read or changed here.</p>
          <div className="ops-study-tablewrap"><table><caption className="ops-study-visuallyhidden">Synthetic entitlement comparison</caption><thead><tr><th scope="col">Capability example</th><th scope="col">Team sample</th><th scope="col">Enterprise sample</th></tr></thead><tbody>
            <tr><td>Portfolio overview</td><td>Illustrative</td><td>Illustrative</td></tr>
            <tr><td>Approval workflow</td><td>Requires verification</td><td>Requires verification</td></tr>
            <tr><td>AI assistant execution</td><td>Not configured</td><td>Not configured</td></tr>
          </tbody></table></div>
        </article>
        <article className="ops-study-card"><h3>Safe configuration preview</h3><p>Example tenant entitlement request with no real controls, persistence, or price assumptions.</p>
          <dl className="ops-study-dl"><div><dt>Workspace</dt><dd>Demo Tenant Alpha</dd></div><div><dt>Requested change</dt><dd>Example only</dd></div><div><dt>Approval state</dt><dd>Not submitted</dd></div><div><dt>Audit event</dt><dd>Not created</dd></div></dl>
          <button disabled type="button" title="Prototype only; no entitlement service connected">Apply entitlement — unavailable</button>
        </article>
      </div>
    </section>
    <section id="ops-design-review" aria-labelledby="ops-design-review-title">
      <div className="ops-study-sectionhead"><div><span>06 / REVIEW JOURNEY</span><h2 id="ops-design-review-title">From request to accountable action</h2></div><small>Design-only interaction model</small></div>
      <div className="ops-study-flow ops-study-flow-review" aria-label="Illustrative workflow: request, policy, human review, proposed action, audit">
        {['Request intake','Policy and tenant check','Human review','Proposed action','Audit evidence'].map((label,i)=><div className="ops-study-node" key={label}><small>CONCEPT {String(i+1).padStart(2,'0')}</small><strong>{label}</strong><span>{['No live submission','No authorization evaluated','No approval issued','No changes executed','No event recorded'][i]}</span></div>)}
      </div>
      <p className="ops-study-note">These nodes are a visualization, not an execution engine. The real system remains authoritative for access and actions.</p>
    </section>
    <section id="ops-states" aria-labelledby="ops-states-title">
      <div className="ops-study-sectionhead"><div><span>07 / COMPONENT STUDY</span><h2 id="ops-states-title">Status and access states</h2></div></div>
      <div className="ops-study-card"><div className="ops-study-states">
        <span className="ops-study-indicator teal">Success · sample</span>
        <span className="ops-study-indicator amber">Warning · sample</span>
        <span className="ops-study-indicator red">Critical · sample</span>
        <span className="ops-study-indicator neutral">Not measured</span>
        <span className="ops-study-indicator neutral">Permission denied</span>
      </div><p className="ops-study-note">Keyboard focus, disabled controls, empty metrics, table overflow and contrast must be checked in both themes.</p>
      </div>
    </section>
  </div>;
}
