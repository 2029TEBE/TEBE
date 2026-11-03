'use client';

import { useEffect, useRef, useState } from 'react';
import { DeploymentRequestSelector, type DeploymentPreference } from './DeploymentRequestSelector';
import { DeploymentStatus, isDisplayableDeployment, type DeploymentView } from './DeploymentStatus';

type Locale = 'ar' | 'en';
type Props = {
  locale?: Locale;
  /** Must be an authenticated, tenant-scoped read. Never use browser-stored status. */
  loadDeployment: (signal: AbortSignal) => Promise<unknown>;
  /** Optional authenticated, tenant-authorized request endpoint. Not an approval endpoint. */
  requestDeployment?: (preference: DeploymentPreference) => Promise<void>;
  canRequest?: boolean;
  /** Changes whenever the authenticated workspace changes. */
  workspaceKey: string;
};

const text = {
  en: {
    refresh: 'Refresh deployment status',
    refreshPending: 'Refreshing…',
    note: 'Deployment requests are reviewed separately. This page cannot approve or activate hosting.',
    requestDisabled: 'Only authorized workspace administrators can request a deployment review.',
  },
  ar: {
    refresh: 'تحديث حالة الاستضافة',
    refreshPending: 'جارٍ التحديث…',
    note: 'تُراجع طلبات الاستضافة بشكل منفصل. لا يمكن لهذه الصفحة الموافقة على الاستضافة أو تفعيلها.',
    requestDisabled: 'يمكن لمسؤولي مساحة العمل المخولين فقط طلب مراجعة الاستضافة.',
  },
} as const;

/**
 * Workspace-scoped presentation boundary. All data comes from the caller's
 * authenticated server API; the UI never infers compliance or activation.
 */
export function DeploymentOverview({
  locale = 'en', loadDeployment, requestDeployment, canRequest = false, workspaceKey,
}: Props) {
  const t = text[locale];
  const [deployment, setDeployment] = useState<DeploymentView | null>(null);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  // A pending request must never refresh or affect a newly selected workspace.
  const activeWorkspace = useRef(workspaceKey);
  activeWorkspace.current = workspaceKey;
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const current = ++sequence.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    // Clear previous tenant information before the new request completes.
    setDeployment(null);
    setPending(true);
    setFailed(false);
    loadDeployment(abort.signal)
      .then((value) => {
        if (abort.signal.aborted || sequence.current !== current) return;
        if (!isDisplayableDeployment(value)) {
          setDeployment(null);
          setFailed(true);
          return;
        }
        setDeployment(value);
      })
      .catch(() => {
        if (!abort.signal.aborted && sequence.current === current) setFailed(true);
      })
      .finally(() => {
        if (!abort.signal.aborted && sequence.current === current) setPending(false);
      });
    return () => { abort.abort(); sequence.current++; };
  }, [loadDeployment, workspaceKey, revision]);

  async function submit(preference: DeploymentPreference) {
    if (!workspaceKey || !canRequest || !requestDeployment) throw new Error('Unauthorized request');
    const submittedFor = workspaceKey;
    await requestDeployment(preference);
    // The request belongs to the original workspace. A late response cannot
    // refresh or imply success in another workspace after the user switches.
    if (activeWorkspace.current !== submittedFor) return;
    // A submitted request does not imply approved/active; re-read server truth.
    setRevision((value) => value + 1);
  }

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <DeploymentStatus deployment={deployment} locale={locale} pending={pending} failed={failed} />
      <button type="button" disabled={pending} onClick={() => setRevision((value) => value + 1)}>
        {pending ? t.refreshPending : t.refresh}
      </button>
      <p>{t.note}</p>
      {!canRequest && <p>{t.requestDisabled}</p>}
      <DeploymentRequestSelector
        key={workspaceKey}
        locale={locale}
        disabled={!workspaceKey || !canRequest || pending}
        onRequest={workspaceKey && canRequest && requestDeployment ? submit : undefined}
      />
    </div>
  );
}
