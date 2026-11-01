import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safePowerBiReportUrl, powerBiGroupSummary, powerBiReportSummary }
  from '../apps/api/src/microsoft/powerbi-report-policy.ts';

const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const start = source.indexOf('async reports()');
const end = source.indexOf('async embed(', start);
assert.ok(start >= 0 && end > start);
const method = source.slice(start, end);
const legacyStart = method.indexOf('// This is a workspace-level delegated');
assert.ok(legacyStart > 0);
const preview = method.slice(0, legacyStart);
const legacy = method.slice(legacyStart);

test('E61: Power BI catalogue URLs permit only the exact Microsoft app origin', () => {
  const good = 'https://app.powerbi.com/groups/me/reports/123e4567-e89b-12d3-a456-426614174000';
  assert.equal(safePowerBiReportUrl(good), good);
  for (const bad of [
    'http://app.powerbi.com/groups/me/reports/1',
    'https://app.powerbi.com.evil.example/groups/me/reports/1',
    'https://user:pass@app.powerbi.com/groups/me/reports/1',
    'https://app.powerbi.com:444/groups/me/reports/1',
    'https://app.powerbi.com/redirect?to=evil',
    'https://app.powerbi.com/groups/me/reports/1#fragment',
    'javascript:alert(1)', '//app.powerbi.com/groups/me/reports/1',
    ' https://app.powerbi.com/groups/me/reports/1', null, 123,
  ]) assert.equal(safePowerBiReportUrl(bad), null, String(bad));
});

test('E61: reports expose a strict display-only metadata whitelist', () => {
  const webUrl = 'https://app.powerbi.com/groups/me/reports/abc123';
  const result = powerBiReportSummary({
    id: 'abc123', name: 'Synthetic QA', webUrl,
    embedUrl: 'https://attacker.invalid/embed', accessToken: 'SECRET',
    datasetId: 'private-dataset', internal: { credential: 'SECRET' },
  }, null, 'My workspace');
  assert.deepEqual(result, {
    id: 'abc123', name: 'Synthetic QA', groupId: null,
    groupName: 'My workspace', embedUrl: null, webUrl,
  });
  assert.doesNotMatch(JSON.stringify(result), /SECRET|datasetId|attacker/);
});

test('E61: malformed Power BI metadata fails closed', () => {
  for (const raw of [
    null, [], { id: '', name: 'A' }, { id: '../escape', name: 'A' },
    { id: 'ok', name: '' }, { id: 'ok', name: 'line\nbreak' },
    { id: 'ok', name: 'A', webUrl: 'https://evil.invalid' },
  ]) assert.throws(() => powerBiReportSummary(raw, null, 'My workspace'));
  assert.throws(() => powerBiReportSummary({ id: 'ok', name: 'A' }, '../bad', 'Group'));
  assert.deepEqual(powerBiGroupSummary({ id: 'group-1', name: 'Synthetic workspace' }),
    { id: 'group-1', name: 'Synthetic workspace' });
  assert.throws(() => powerBiGroupSummary({ id: 'bad/path', name: 'Group' }));
});

test('E61: preview requires administrator, consenting owner and exact Power BI bearer', () => {
  assert.match(preview, /microsoftUserStorePreviewEnabled\(\)/);
  assert.match(preview, /requireCapability\('pmoa_admin'\)/);
  assert.match(preview, /const ownerId = this\.ownerUserId\(\)/);
  assert.match(preview, /await this\.accessToken\('powerbi'\)/);
  assert.match(preview, /readUserMicrosoftConnection\(tenantId, ownerId\)/);
  assert.match(preview, /issued\.accessToken !== token/);
  assert.match(preview, /issued\.credential !== own\.sealedRefreshToken/);
  assert.doesNotMatch(preview, /FROM integration_connections|this\.connection\(tx\)/);
});

test('E61: provider listing is bounded and cannot leak raw provider objects or tokens', () => {
  assert.match(preview, /callAll<any>\(POWERBI, token, '\/reports', 100\)/);
  assert.match(preview, /callAll<any>\(POWERBI, token, '\/groups', 20\)/);
  assert.match(preview, /out\.length >= 200/);
  assert.match(preview, /Math\.min\(100, 200 - out\.length\)/);
  assert.match(preview, /powerBiGroupSummary\(rawGroup\)/);
  assert.match(preview, /powerBiReportSummary\(report/);
  assert.doesNotMatch(preview, /accessToken: token|embedUrl: r\.embedUrl/);
});

test('E61: owner revocation and credential rotation are rechecked after provider reads', () => {
  const lastProviderRead = preview.lastIndexOf('await callAll<any>(POWERBI');
  const recheck = preview.lastIndexOf('await assertStillOwner()');
  const output = preview.lastIndexOf('return { reports: out }');
  assert.ok(lastProviderRead >= 0 && recheck > lastProviderRead && output > recheck);
  assert.match(preview, /latest\.sealedRefreshToken !== own\.sealedRefreshToken/);
  assert.match(preview, /currentBearer\.accessToken !== token/);
  assert.match(preview, /currentBearer\.credential !== own\.sealedRefreshToken/);
});

test('E61: preview embed still denies transferable bearer; legacy path is untouched', () => {
  const embed = source.slice(end, source.indexOf('private async previewAccessToken(', end));
  assert.match(embed, /if \(microsoftUserStorePreviewEnabled\(\)\)/);
  assert.match(embed, /throw new ServiceUnavailableException/);
  assert.match(legacy, /MS_ALLOW_LEGACY_ADMIN_EMBED/);
  assert.match(legacy, /await this\.accessToken\('powerbi'\)/);
});
