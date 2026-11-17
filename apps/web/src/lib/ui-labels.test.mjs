import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UI_LABELS, uiLabel, uiLabelCoverage, translationHasMatchingPlaceholders } from './ui-labels.mjs';

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
    total: 2, translated: 1, missing: ['Unknown'], invalidPlaceholders: [],
  });
});
test('all shared nav group headings have four catalogue translations', () => {
  for (const title of ['Home','Plan & Deliver','Govern','Analyse','Collaborate','Configure']) {
    for (const locale of ['de-DE','zh-CN','fr-FR','ja-JP']) {
      const identical = UI_LABELS[title]?.[locale] === title;
      assert.deepEqual(uiLabelCoverage([title], locale), {
        total: 1, translated: identical ? 0 : 1,
        missing: identical ? [title] : [], invalidPlaceholders: [],
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
    const entriesMissing = labels.filter(key => !Object.hasOwn(UI_LABELS[key] ?? {}, locale));
    assert.deepEqual(entriesMissing, [], `missing ${locale} nav catalog entries`);
    assert.deepEqual(uiLabelCoverage(labels, locale).missing,
      labels.filter(key => UI_LABELS[key]?.[locale] === key),
      `unchanged English must be reported honestly for ${locale}`);
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
    assert.deepEqual(keys.filter(key => !Object.hasOwn(UI_LABELS[key] ?? {}, locale)), [], locale);
    assert.deepEqual(uiLabelCoverage(keys, locale).missing,
      keys.filter(key => UI_LABELS[key]?.[locale] === key), locale);
  }
  const page = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes("t('Executive decision journey')"));
  assert.ok(page.includes("t('Turn delivery signals into accountable reviews')"));
  assert.ok(!page.includes("lang === 'ar' ? 'حوّل الانحرافات"));
  assert.ok(page.includes('await api.overview()'));
  assert.ok(page.includes('await api.trends()'));
});

test('Arabic missing labels are not falsely recorded as translated', () => {
  assert.deepEqual(uiLabelCoverage(['Projects', 'Unknown'], 'ar-SA', { Projects: 'المشاريع' }), {
    total: 2, translated: 1, missing: ['Unknown'], invalidPlaceholders: [],
  });
});

test('placeholder integrity protects interpolated labels in every locale', () => {
  assert.equal(translationHasMatchingPlaceholders('Showing {shown} of {total}', 'عرض {total} من {shown}'), true);
  assert.equal(translationHasMatchingPlaceholders('Showing {shown} of {total}', 'عرض {shown}'), false);
  const result = uiLabelCoverage(['Showing {shown} of {total} projects needing review.'], 'fr-FR');
  assert.deepEqual(result.invalidPlaceholders, []);
});

test('runtime fallback rejects malformed interpolation including legacy Arabic', () => {
  const source = 'Showing the first {shown} of {total} projects needing review.';
  assert.equal(uiLabel(source, 'ar', 'عرض أول {shown} مشروع'), source);
  assert.equal(uiLabel(source, 'ar', 'عرض {total} من {shown} مشروع'), 'عرض {total} من {shown} مشروع');
  assert.equal(uiLabel(source, 'fr', ''), uiLabel(source, 'fr-FR'));
  assert.equal(uiLabel(source, 'xx'), source);
});

test('full UI label catalog preserves interpolation tokens across every translated variant', () => {
  for (const [source, variants] of Object.entries(UI_LABELS)) {
    for (const [locale, translated] of Object.entries(variants)) {
      assert.equal(translationHasMatchingPlaceholders(source, translated), true,
        `placeholder mismatch: ${locale} / ${source}`);
      assert.equal(typeof translated, 'string', `non-string translation: ${locale} / ${source}`);
      assert.ok(translated.trim().length > 0, `blank translation: ${locale} / ${source}`);
    }
  }
});

test('Urdu has localized navigation with preserved source labels', () => {
  const nav = readFileSync(new URL('./nav.ts', import.meta.url), 'utf8');
  const labels = [...new Set([...nav.matchAll(/label:\\s*'([^']+)'/g)].map(m => m[1]))];
  assert.equal(labels.length, 35);
  for (const label of labels) {
    assert.ok(typeof UI_LABELS[label]?.ur === 'string' && UI_LABELS[label].ur.trim(), label);
    assert.equal(uiLabel(label, 'ur'), UI_LABELS[label].ur);
  }
  assert.deepEqual(uiLabelCoverage(labels, 'ur').missing, ['Power BI']);
});
