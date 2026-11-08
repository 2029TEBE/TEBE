import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uiLabel, uiLabelCoverage } from './ui-labels.mjs';

test('English source text is unchanged', () => {
  assert.equal(uiLabel('Projects', 'en', 'المشاريع'), 'Projects');
});
test('existing Arabic text wins without changing backend exports', () => {
  assert.equal(uiLabel('Plan & Deliver', 'ar-SA', 'التخطيط والتنفيذ'), 'التخطيط والتنفيذ');
});
test('four additional locales render catalogued terms', () => {
  assert.equal(uiLabel('Projects', 'de-DE'), 'Projekte');
  assert.equal(uiLabel('Projects', 'zh-CN'), '项目');
  assert.equal(uiLabel('Projects', 'fr-FR'), 'Projets');
  assert.equal(uiLabel('Projects', 'ja-JP'), 'プロジェクト');
});
test('missing translations safely fall back to English', () => {
  assert.equal(uiLabel('Project certification', 'de-DE'), 'Project certification');
  assert.equal(uiLabel('Missing Arabic', 'ar-SA'), 'Missing Arabic');
  assert.equal(uiLabel('Executive decision journey', 'ar-SA'), 'مسار القرار التنفيذي');
  assert.equal(uiLabel('Executive decision journey', 'ar-SA', 'مسار القرار التنفيذي'), 'مسار القرار التنفيذي');
});
test('coverage enumerates untranslated strings without duplication', () => {
  assert.deepEqual(uiLabelCoverage(['Projects','Projects','Unknown'], 'fr-FR'), {
    total: 2, translated: 1, missing: ['Unknown'],
  });
});
test('all shared nav group headings have four catalogue translations', () => {
  for (const title of ['Home','Plan & Deliver','Govern','Analyse','Collaborate','Configure']) {
    for (const locale of ['de-DE','zh-CN','fr-FR','ja-JP']) {
      assert.deepEqual(uiLabelCoverage([title], locale), {
        total: 1, translated: 1, missing: [],
      });
      assert.ok(uiLabel(title, locale).length > 0);
    }
  }
});

test('every shared dashboard navigation label has a catalog entry in four new locales', () => {
  const nav = readFileSync(new URL('./nav.ts', import.meta.url), 'utf8');
  const labels = [...new Set([...nav.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]))];
  assert.ok(labels.length >= 30, 'expected full navigation inventory');
  for (const locale of ['de-DE', 'zh-CN', 'fr-FR', 'ja-JP']) {
    assert.deepEqual(uiLabelCoverage(labels, locale).missing, [], `missing ${locale} nav labels`);
  }
});

test('shared executive journey has all six translations without separate dashboards', () => {
  const keys = [
    'Executive decision journey', 'FROM SIGNALS TO DECISIONS',
    'Turn delivery signals into accountable reviews',
    'These are the current workspace API signals, not automated decisions or approvals.',
    'OBSERVE', 'Overdue register items', 'VERIFY',
    'Blocked gates needing evidence review', 'HUMAN DECISION',
    'Projects returned in the attention queue',
    'Check the source evidence and accountable owner before acting.',
    'Delivery trend', 'Portfolio performance', 'Portfolio mix', 'Project health',
  ];
  for (const locale of ['de-DE', 'zh-CN', 'fr-FR', 'ja-JP']) {
    assert.deepEqual(uiLabelCoverage(keys, locale).missing, [], locale);
  }
  const page = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes("t('Executive decision journey')"));
  assert.ok(page.includes("t('Turn delivery signals into accountable reviews')"));
  assert.ok(!page.includes("lang === 'ar' ? 'حوّل الانحرافات"));
  assert.ok(page.includes('await api.overview()'));
  assert.ok(page.includes('await api.trends()'));
});
