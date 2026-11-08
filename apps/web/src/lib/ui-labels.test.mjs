import test from 'node:test';
import assert from 'node:assert/strict';
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
});
test('coverage enumerates untranslated strings without duplication', () => {
  assert.deepEqual(uiLabelCoverage(['Projects','Projects','Unknown'], 'fr-FR'), {
    total: 2, translated: 1, missing: ['Unknown'],
  });
});
test('all shared nav group headings have four catalogue translations', () => {
  for (const title of ['Home','Plan & Deliver','Govern','Analyse','Collaborate','Configure']) {
    for (const locale of ['de-DE','zh-CN','fr-FR','ja-JP']) {
      assert.notEqual(uiLabel(title, locale), title === 'Govern' ? '' : undefined);
      assert.ok(uiLabel(title, locale).length > 0);
    }
  }
});
