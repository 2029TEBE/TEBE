import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validRiskRating, raidRiskScore, isCriticalRaidRisk } from '../apps/web/src/lib/raid-risk-score.mjs';
import { FRONTEND_LOCALES } from '../apps/web/src/lib/frontend-locale.mjs';
import { UI_LABELS, catalogLocale, uiLabel } from '../apps/web/src/lib/ui-labels.mjs';
const source = readFileSync(new URL('../apps/web/src/app/(app)/raid/page.tsx',import.meta.url),'utf8');
test('only valid integer one-to-five severity/likelihood values produce risk scores', () => {
  for(const invalid of [0,-1,6,NaN,Infinity,-Infinity,1.1,'3',null,undefined]) {
    assert.equal(validRiskRating(invalid),false);
    assert.equal(raidRiskScore(invalid,3),null);
    assert.equal(raidRiskScore(3,invalid),null);
  }
  for(let severity=1;severity<=5;severity++) for(let likelihood=1;likelihood<=5;likelihood++)
    assert.equal(raidRiskScore(severity,likelihood),severity*likelihood);
  assert.equal(isCriticalRaidRisk(14),false);
  assert.equal(isCriticalRaidRisk(15),true);
  assert.equal(isCriticalRaidRisk(25),true);
  assert.equal(isCriticalRaidRisk(26),false);
  assert.equal(isCriticalRaidRisk(null),false);
});
test('RAID register preserves audited gate-blocking field and authorized creation while displaying validated risk', () => {
  for (const clause of [
    'load={async () => ({ items: await api.raid(), o: await api.createOptions() })}',
    'kind="raid"', 'name: \'blocksActiveGate\'',
    'raidRiskScore(r.severity, r.likelihood)',
    'isCriticalRaidRisk(raidRiskScore(r.severity, r.likelihood))',
    "num(raidRiskScore(r.severity, r.likelihood), 0, locale)",
    "t('of 25')", 'const locale = await getFrontendLocale()',
    "<bdi>{r.title}</bdi>", "<bdi>{r.projectCode}</bdi>",
    "<bdi>{r.blocksGate}</bdi>", "<bdi>{r.detail}</bdi>",
    "t('RAID & Governance')"
  ]) assert.ok(source.includes(clause),clause);
  assert.equal((source.match(/<th scope="col">/g)||[]).length,7);
  assert.ok(!source.includes('r.severity * r.likelihood'), 'no unvalidated score multiplication');
});
test('RAID headings and statuses have explicit mappings in all supported non-English frontend locales', () => {
  const labels = [
    'RAID & Governance',
    'Risks, assumptions, issues, dependencies, changes and decisions. An open item pointed at a gate holds that gate shut.',
    'of 25','risk','issue','dependency','assumption','change','decision','closed'
  ];
  assert.equal(FRONTEND_LOCALES.length,23);
  for(const label of labels) for(const locale of FRONTEND_LOCALES) {
    const result=uiLabel(label,locale);
    assert.ok(result.trim(),locale+': '+label);
    if(!locale.startsWith('en-'))
      assert.equal(result,UI_LABELS[label]?.[catalogLocale(locale)],locale+': '+label);
  }
});
