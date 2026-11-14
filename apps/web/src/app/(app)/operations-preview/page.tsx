import { UiText, UiField } from '@/components/UiLocale';
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
    <div className="ops-study-banner" role="status"><UiText text={"DESIGN PROTOTYPE · SYNTHETIC FIXTURES · NO REAL TENANT DATA · NO AGENT EXECUTION"} /></div>
    <div className="ops-study-heading">
      <div><div className="ops-study-kicker"><UiText text={"THE EPMO / VENDOR OPERATIONS"} /></div>
        <h1><UiText text={"Platform operations"} /></h1>
        <p><UiText text={"Inspect the future control center. All figures and states below are simulated for local UX review."} /></p>
      </div>
      <a href="/super-admin" className="ops-study-back"><UiText text={"Return to real Super Admin ↗"} /></a>
    </div>
    <UiField as="nav" copy={["aria-label"]} className="ops-study-nav" aria-label="Operations prototype sections">
      <a href="#ops-overview"><UiText text={"Overview"} /></a><a href="#ops-tenants"><UiText text={"Customers"} /></a>
      <a href="#ops-workflows"><UiText text={"Workflow"} /></a><a href="#ops-agents"><UiText text={"AI control center"} /></a>
      <a href="#ops-entitlements"><UiText text={"Entitlements"} /></a><a href="#ops-design-review"><UiText text={"Review journey"} /></a><a href="#ops-states"><UiText text={"Design states"} /></a>
    </UiField>
    <section id="ops-overview" aria-labelledby="ops-overview-title">
      <div className="ops-study-sectionhead"><div><span><UiText text={"01 / OPERATIONS"} /></span><h2 id="ops-overview-title"><UiText text={"Overview at a glance"} /></h2></div><small><UiText text={"Data source: synthetic fixture"} /></small></div>
      <div className="ops-study-metrics">{metrics.map(m=><article key={m.label} className={'ops-study-metric '+m.tone}>
        <p>{m.label}</p><strong>{m.value}</strong><small>{m.detail}</small>
      </article>)}</div>
      <div className="ops-study-grid">
        <article className="ops-study-card"><h3><UiText text={"Operational readiness"} /></h3><p><UiText text={"No telemetry endpoint has been connected. Missing values must not imply healthy status."} /></p>
          <div className="ops-study-notmeasured"><span aria-hidden="true">◌</span><div><strong><UiText text={"Service status not measured"} /></strong><small><UiText text={"Requires an authorized health-monitoring contract in a later phase."} /></small></div></div>
        </article>
        <article className="ops-study-card"><h3><UiText text={"Review queue · sample"} /></h3><p><UiText text={"Demonstration of visual treatment only. There are no real approval requests here."} /></p>
          <div className="ops-study-alert"><span className="ops-study-indicator amber"><UiText text={"Attention"} /></span><div><strong><UiText text={"License adjustment"} /></strong><small><UiText text={"Demo Tenant Beta · Example request"} /></small></div><span><UiText text={"Pending"} /></span></div>
          <div className="ops-study-alert"><span className="ops-study-indicator teal"><UiText text={"Info"} /></span><div><strong><UiText text={"Workspace configuration"} /></strong><small><UiText text={"Demo Tenant Alpha · Example request"} /></small></div><span><UiText text={"Review"} /></span></div>
        </article>
      </div>
    </section>
    <section id="ops-tenants" aria-labelledby="ops-tenants-title">
      <div className="ops-study-sectionhead"><div><span><UiText text={"02 / CUSTOMERS"} /></span><h2 id="ops-tenants-title"><UiText text={"Customer workspace inventory"} /></h2></div><small><UiText text={"Non-identifying demo tenants"} /></small></div>
      <div className="ops-study-card"><div className="ops-study-tablewrap"><table><caption className="ops-study-visuallyhidden"><UiText text={"Synthetic customer list"} /></caption>
        <thead><tr><th scope="col"><UiText text={"Workspace"} /></th><th scope="col"><UiText text={"Plan"} /></th><th scope="col"><UiText text={"Status"} /></th><th scope="col"><UiText text={"Capacity example"} /></th><th scope="col"><UiText text={"Action"} /></th></tr></thead>
        <tbody>{tenants.map(t=><tr key={t.name}><td><strong>{t.name}</strong><small><UiText text={"DEMO DATA"} /></small></td><td>{t.plan}</td><td><span className="ops-study-indicator teal">{t.status}</span></td><td>{t.use}</td><td><a href="#ops-workflows"><UiText text={"Inspect sample"} /></a></td></tr>)}</tbody>
      </table></div></div>
    </section>
    <section id="ops-workflows" aria-labelledby="ops-workflow-title">
      <div className="ops-study-sectionhead"><div><span><UiText text={"03 / WORKFLOW MONITOR"} /></span><h2 id="ops-workflow-title"><UiText text={"A governable execution path"} /></h2></div><small><UiText text={"Visual playthrough · no execution"} /></small></div>
      <article className="ops-study-card">
        <p><UiText text={"Every simulated step is a proposed interface state. There are no configured jobs, queues, retries or network requests behind this diagram."} /></p>
        <UiField as="div" copy={["aria-label"]} className="ops-study-flow" aria-label="Concept workflow: organization, department, agent, approval gate, audit record">
          {['Organization','Department','AI assistant concept','Human approval gate','Audit trail'].map((n,i)=><div key={n} className="ops-study-node">
            <small><UiText text={"STEP "} />{String(i+1).padStart(2,'0')}</small><strong>{n}</strong><span>{['Demo workspace','Governance team','Proposed, not running','Awaiting a human','Immutable evidence concept'][i]}</span>
          </div>)}
        </UiField>
        <p className="ops-study-note"><UiText text={"Design note: future integrations need explicit authorization, scopes, cost guardrails and an audit-backed execution service."} /></p>
      </article>
    </section>
    <section id="ops-agents" aria-labelledby="ops-agents-title">
      <div className="ops-study-sectionhead"><div><span><UiText text={"04 / AI GOVERNANCE"} /></span><h2 id="ops-agents-title"><UiText text={"AI agents control center"} /></h2></div><small><UiText text={"Concept only · zero running agents"} /></small></div>
      <div className="ops-study-grid"><article className="ops-study-card">
        <h3><UiText text={"Agent directory"} /></h3>
        <div className="ops-study-agent"><div className="ops-study-avatar"><UiText text={"G"} /></div><div><strong><UiText text={"Governance analyst · concept"} /></strong><small><UiText text={"Scope proposal: read governance evidence"} /></small></div><span className="ops-study-indicator amber"><UiText text={"Proposed"} /></span></div>
        <div className="ops-study-agent"><div className="ops-study-avatar"><UiText text={"R"} /></div><div><strong><UiText text={"Reporting assistant · concept"} /></strong><small><UiText text={"Scope proposal: draft report summaries"} /></small></div><span className="ops-study-indicator neutral"><UiText text={"Not configured"} /></span></div>
        <UiField as="button" copy={["title"]} disabled type="button" title="A production execution service does not exist"><UiText text={"Run agent — unavailable"} /></UiField>
      </article><article className="ops-study-card"><h3><UiText text={"Execution guardrails"} /></h3>
        <dl className="ops-study-dl"><div><dt><UiText text={"Model / provider"} /></dt><dd><UiText text={"Not connected"} /></dd></div><div><dt><UiText text={"Estimated spend"} /></dt><dd><UiText text={"Not measured"} /></dd></div><div><dt><UiText text={"Approval policy"} /></dt><dd><UiText text={"Human confirmation required"} /></dd></div><div><dt><UiText text={"Tenant scope"} /></dt><dd><UiText text={"Not configured"} /></dd></div></dl>
        <p className="ops-study-note"><UiText text={"No vendor-wide access or data action can be inferred from this example."} /></p>
      </article></div>
    </section>
    <section id="ops-entitlements" aria-labelledby="ops-entitlements-title">
      <div className="ops-study-sectionhead"><div><span><UiText text={"05 / ENTITLEMENTS"} /></span><h2 id="ops-entitlements-title"><UiText text={"Plan and access concept"} /></h2></div><small><UiText text={"Illustrative plan names · no billing data"} /></small></div>
      <div className="ops-study-grid">
        <article className="ops-study-card"><h3><UiText text={"Sample capability matrix"} /></h3><p><UiText text={"Proposed presentation of licensed capabilities. No entitlements are read or changed here."} /></p>
          <div className="ops-study-tablewrap"><table><caption className="ops-study-visuallyhidden"><UiText text={"Synthetic entitlement comparison"} /></caption><thead><tr><th scope="col"><UiText text={"Capability example"} /></th><th scope="col"><UiText text={"Team sample"} /></th><th scope="col"><UiText text={"Enterprise sample"} /></th></tr></thead><tbody>
            <tr><td><UiText text={"Portfolio overview"} /></td><td><UiText text={"Illustrative"} /></td><td><UiText text={"Illustrative"} /></td></tr>
            <tr><td><UiText text={"Approval workflow"} /></td><td><UiText text={"Requires verification"} /></td><td><UiText text={"Requires verification"} /></td></tr>
            <tr><td><UiText text={"AI assistant execution"} /></td><td><UiText text={"Not configured"} /></td><td><UiText text={"Not configured"} /></td></tr>
          </tbody></table></div>
        </article>
        <article className="ops-study-card"><h3><UiText text={"Safe configuration preview"} /></h3><p><UiText text={"Example tenant entitlement request with no real controls, persistence, or price assumptions."} /></p>
          <dl className="ops-study-dl"><div><dt><UiText text={"Workspace"} /></dt><dd><UiText text={"Demo Tenant Alpha"} /></dd></div><div><dt><UiText text={"Requested change"} /></dt><dd><UiText text={"Example only"} /></dd></div><div><dt><UiText text={"Approval state"} /></dt><dd><UiText text={"Not submitted"} /></dd></div><div><dt><UiText text={"Audit event"} /></dt><dd><UiText text={"Not created"} /></dd></div></dl>
          <UiField as="button" copy={["title"]} disabled type="button" title="Prototype only; no entitlement service connected"><UiText text={"Apply entitlement — unavailable"} /></UiField>
        </article>
      </div>
    </section>
    <section id="ops-design-review" aria-labelledby="ops-design-review-title">
      <div className="ops-study-sectionhead"><div><span><UiText text={"06 / REVIEW JOURNEY"} /></span><h2 id="ops-design-review-title"><UiText text={"From request to accountable action"} /></h2></div><small><UiText text={"Design-only interaction model"} /></small></div>
      <UiField as="div" copy={["aria-label"]} className="ops-study-flow ops-study-flow-review" aria-label="Illustrative workflow: request, policy, human review, proposed action, audit">
        {['Request intake','Policy and tenant check','Human review','Proposed action','Audit evidence'].map((label,i)=><div className="ops-study-node" key={label}><small><UiText text={"CONCEPT "} />{String(i+1).padStart(2,'0')}</small><strong>{label}</strong><span>{['No live submission','No authorization evaluated','No approval issued','No changes executed','No event recorded'][i]}</span></div>)}
      </UiField>
      <p className="ops-study-note"><UiText text={"These nodes are a visualization, not an execution engine. The real system remains authoritative for access and actions."} /></p>
    </section>
    <section id="ops-states" aria-labelledby="ops-states-title">
      <div className="ops-study-sectionhead"><div><span><UiText text={"07 / COMPONENT STUDY"} /></span><h2 id="ops-states-title"><UiText text={"Status and access states"} /></h2></div></div>
      <div className="ops-study-card"><div className="ops-study-states">
        <span className="ops-study-indicator teal"><UiText text={"Success · sample"} /></span>
        <span className="ops-study-indicator amber"><UiText text={"Warning · sample"} /></span>
        <span className="ops-study-indicator red"><UiText text={"Critical · sample"} /></span>
        <span className="ops-study-indicator neutral"><UiText text={"Not measured"} /></span>
        <span className="ops-study-indicator neutral"><UiText text={"Permission denied"} /></span>
      </div><p className="ops-study-note"><UiText text={"Keyboard focus, disabled controls, empty metrics, table overflow and contrast must be checked in both themes."} /></p>
      </div>
    </section>
  </div>;
}
