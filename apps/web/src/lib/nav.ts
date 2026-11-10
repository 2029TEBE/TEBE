import type { Capability } from '@pmo/contracts';

/**
 * The workspace navigation, matching The EPMO's own six groups and twenty-one
 * items. Arabic labels are resolved through the shared @pmo/contracts catalog
 * rather than translated by us, and each item carries the capability that
 * gates it — same capability strings their product uses.
 */
export type NavItem = { key: string; label: string; href: string; cap: Capability };
export type NavGroup = { key: string; label: string; ar: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { key: 'home', label: 'Home', items: [
    { key: 'getting-started', label: 'Getting Started', href: '/getting-started', cap: 'read' },
    { key: 'executive-overview', label: 'Executive Overview', href: '/', cap: 'read' },
    { key: 'my-work', label: 'My Work', href: '/my-work', cap: 'read' },
    { key: 'attention', label: 'Attention', href: '/activity', cap: 'read' },
  ]},
  { key: 'plan', label: 'Plan & Deliver', items: [
    { key: 'portfolios', label: 'Portfolios', href: '/portfolios', cap: 'pmoa_view_portfolio' },
    { key: 'projects', label: 'Projects', href: '/projects', cap: 'read' },
    { key: 'work-board', label: 'Work Board', href: '/board', cap: 'pmoa_manage_work' },
    { key: 'schedule', label: 'Schedule', href: '/planner', cap: 'pmoa_manage_work' },
  ]},
  { key: 'govern', label: 'Govern', items: [
    { key: 'stage-gates', label: 'Stage Gates', href: '/governance', cap: 'pmoa_manage_raid' },
    { key: 'raid', label: 'RAID Register', href: '/raid', cap: 'pmoa_manage_raid' },
    { key: 'decisions', label: 'Decisions', href: '/decisions', cap: 'pmoa_view_portfolio' },
    { key: 'approvals', label: 'Approvals', href: '/approvals', cap: 'pmoa_approve' },
  ]},
  { key: 'analyse', label: 'Analyse', items: [
    { key: 'analytics', label: 'Analytics', href: '/analytics', cap: 'pmoa_view_portfolio' },
    { key: 'financials', label: 'Financials', href: '/financials', cap: 'pmoa_view_financials' },
    { key: 'benefits', label: 'Benefits', href: '/benefits', cap: 'pmoa_view_financials' },
    { key: 'resources', label: 'Resources', href: '/resources', cap: 'pmoa_view_portfolio' },
    { key: 'notifications', label: 'Notifications', href: '/notifications', cap: 'pmoa_admin' },
    { key: 'data', label: 'Import & Export', href: '/data', cap: 'pmoa_manage_projects' },
    { key: 'power-bi', label: 'Power BI', href: '/power-bi', cap: 'pmoa_admin' },
    { key: 'reports', label: 'Reports', href: '/reports', cap: 'pmoa_view_portfolio' },
  ]},
  { key: 'collaborate', label: 'Collaborate', items: [
    { key: 'documents', label: 'Documents', href: '/documents', cap: 'read' },
    { key: 'updates', label: 'Updates', href: '/updates', cap: 'read' },
    { key: 'stakeholders', label: 'Stakeholders', href: '/stakeholders', cap: 'read' },
  ]},
  { key: 'configure', label: 'Configure', items: [
    { key: 'studio', label: 'Platform Studio', href: '/studio', cap: 'pmoa_admin' },
    { key: 'integrations', label: 'Integrations', href: '/integrations', cap: 'pmoa_manage_projects' },
    { key: 'workspace-settings', label: 'Settings', href: '/settings', cap: 'read' },
    { key: 'platform', label: 'Modules', href: '/platform', cap: 'pmoa_platform' },
    { key: 'billing', label: 'Billing & Renewals', href: '/billing', cap: 'pmoa_admin' },
    { key: 'super-admin', label: 'Subscriptions', href: '/super-admin', cap: 'pmoa_platform' },
  ]},
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
