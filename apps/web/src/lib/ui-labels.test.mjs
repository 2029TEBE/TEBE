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
      assert.deepEqual(uiLabelCoverage([title], locale), {
        total: 1, translated: 1, missing: [], invalidPlaceholders: [],
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

// Authentication UI must pass the selected frontend locale into both client forms.
test('password recovery and reset forms use the shared frontend locale catalog', () => {
  const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
  const recoveryPage = read('../app/forgot-password/page.tsx');
  const resetPage = read('../app/reset-password/page.tsx');
  const recoveryForm = read('../app/forgot-password/RecoveryRequestForm.tsx');
  const resetForm = read('../app/reset-password/ResetPasswordForm.tsx');
  assert.match(recoveryPage, /<RecoveryRequestForm lang=\\{lang\\} locale=\\{locale\\}/);
  assert.match(resetPage, /<ResetPasswordForm lang=\\{lang\\} locale=\\{locale\\}/);
  for (const form of [recoveryForm, resetForm]) {
    assert.match(form, /uiLabel\\(english, locale, authFormLabel\\(/);
    assert.match(form, /body: JSON\\.stringify/);
  }
  assert.equal(uiLabel('Forgot password?', 'es'), '¿Has olvidado tu contraseña?');
  assert.equal(uiLabel('Password', 'ur'), 'پاس ورڈ');
});

test('recovery headings and reset action have translations for each offered non-English locale', () => {
  const locales = ['ar', 'bn', 'de', 'es', 'es-419', 'fil', 'fr', 'hi', 'id',
    'it', 'ja', 'ko', 'pt-BR', 'pt-PT', 'ru', 'sw', 'tr', 'ur', 'vi', 'zh-CN', 'zh-TW'];
  const keys = ['Forgot your password?', 'Back to sign in',
    'Choose a new password', 'Reset password'];
  for (const locale of locales) {
    const result = uiLabelCoverage(keys, locale);
    assert.deepEqual(result.missing, [], `${locale}: missing recovery copy`);
    assert.deepEqual(result.invalidPlaceholders, [], `${locale}: invalid recovery markup`);
  }
  assert.equal(uiLabel('Choose a new password', 'es'), 'Elige una contraseña nueva');
  assert.equal(uiLabel('Reset password', 'zh-TW'), '重設密碼');
});
