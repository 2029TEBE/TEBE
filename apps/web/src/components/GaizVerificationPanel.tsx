'use client';
import { useState } from 'react';
import { GaizStagingPanel } from './GaizStagingPanel';

type Receipt = {
  verified: boolean; format: string; artifactId: string; issuerId: string;
  tenantScope: string; sha256: string; importAllowed: false;
};
const MAX_BYTES = 64 * 1024;
function base64url(bytes: Uint8Array) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(result).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function GaizVerificationPanel({ ar }: { ar: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [encodedArtifact, setEncodedArtifact] = useState<string | null>(null);
  async function verify() {
    setReceipt(null); setEncodedArtifact(null); setError('');
    if (!file) return;
    if (file.size > MAX_BYTES) { setError(ar ? 'الملف يتجاوز حد المعاينة.' : 'File exceeds the preview size limit.'); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const response = await fetch('/api/gaiz/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ artifactBase64url: base64url(bytes) }),
      });
      if (!response.ok) throw Error(response.status === 503
        ? 'GIZE AI preview is disabled or not configured.'
        : response.status === 401 ? 'Sign in again.'
        : 'File could not be verified for this workspace.');
      const result = await response.json() as Receipt;
      if (result.verified !== true || result.importAllowed !== false) throw Error('Invalid verification receipt');
      setReceipt(result);
      setEncodedArtifact(base64url(bytes));
    } catch (e) { setError(e instanceof Error ? e.message : 'Verification error'); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-label={ar ? 'التحقق من ملف GIZE AI' : 'GIZE AI verification'}>
    <h2>{ar ? 'معاينة التوقيع المشفر' : 'Verify a GIZE AI legacy artifact'}</h2>
    <p>{ar ? 'التحقق فقط، دون فك التشفير أو الاستيراد. يتم تحديد الجهة والعميل من الخادم الموثوق.'
      : 'Read-only verification. Trusted issuer and tenant scope are enforced by the server; no decryption or imports.'}</p>
    <p><label htmlFor="gaiz-upload">{ar ? 'اختر ملف .gaiz (حتى 64 كيلوبايت)' : 'Choose .gaiz file (up to 64 KiB)'}</label></p>
    <input id="gaiz-upload" type="file" accept=".gaiz" disabled={busy} onChange={event => {
      setReceipt(null);setEncodedArtifact(null);setError('');setFile(event.target.files?.[0] ?? null);
    }} />
    <p><button type="button" disabled={!file || busy} onClick={verify}>
      {busy ? (ar ? 'جارٍ التحقق…' : 'Verifying…') : (ar ? 'تحقق من التوقيع' : 'Verify signature')}</button></p>
    {error && <p className="err" role="alert">{error}</p>}
    {receipt && <div role="status" aria-live="polite">
      <p className="good">{ar ? 'تم التحقق من التوقيع. الاستيراد غير مسموح.' : 'Signature verified. Import is not authorized.'}</p>
      <dl>
        <div><dt>Artifact</dt><dd><code>{receipt.artifactId}</code></dd></div>
        <div><dt>Issuer</dt><dd><code>{receipt.issuerId}</code></dd></div>
        <div><dt>SHA-256</dt><dd style={{overflowWrap:'anywhere'}}><code>{receipt.sha256}</code></dd></div>
      </dl>
    </div>}
    <GaizStagingPanel ar={ar} artifactBase64url={receipt?.verified ? encodedArtifact : null} />
  </section>;
}
