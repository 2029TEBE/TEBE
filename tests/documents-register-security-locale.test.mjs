import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeDocumentWebUrl } from '../apps/web/src/lib/document-link.mjs';
import { FRONTEND_LOCALES } from '../apps/web/src/lib/frontend-locale.mjs';
import { num } from '../apps/web/src/lib/presentation-values.mjs';
const page = readFileSync(new URL('../apps/web/src/app/(app)/documents/page.tsx', import.meta.url), 'utf8');

test('external document URL safety disallows executable schemes, ambiguous paths and credential links', () => {
  for (const bad of [
    'javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd',
    'blob:https://example.com/uuid', '//example.com/path', '/internal/path',
    'https://user:password@example.com/doc', 'ftp://example.com/file',
    '', '  ', null, undefined, 7, 'not a url',
  ]) assert.equal(safeDocumentWebUrl(bad), null, String(bad));
  assert.equal(safeDocumentWebUrl('https://example.org/a?b=1'), 'https://example.org/a?b=1');
  assert.equal(safeDocumentWebUrl('http://example.org/file'), 'http://example.org/file');
});

test('document register only renders safe link schemes while retaining authorized Microsoft document open API', () => {
  for (const expected of [
    'safeDocumentWebUrl(d.url)',
    'href={safeDocumentWebUrl(d.url)!}',
    'href={`/api/microsoft/documents/${d.id}/open`}',
    'load={api.documents}', 'api.createOptions()', '<DocumentUpload',
    '<NewRecord', "statusLabel(d.status, locale)",
    'formatNumber(list.length, locale)',
    "formatNumber(list.filter((d: any) => d.status === 'approved').length, locale)",
    'formatNumber(list.filter((d: any) => Boolean(d.evidenceFor)).length, locale)',
    'size(d.sizeKb, locale)', '<time dateTime={d.updatedAt}>',
    '<bdi>{d.name}</bdi>', '<bdi>{d.projectCode',
    '<bdi>{d.owner}</bdi>', '<bdi>{d.evidenceFor}</bdi>',
  ]) assert.ok(page.includes(expected), expected);
  assert.ok(!page.includes('href={d.url}'), 'do not bind arbitrary user URL directly to anchor');
});

test('document sizes and counts use locale-aware format and guard invalid values', () => {
  assert.equal(FRONTEND_LOCALES.length, 23);
  assert.ok(page.includes('!Number.isFinite(kb) || kb < 0'));
  for (const locale of FRONTEND_LOCALES) {
    for (const value of [0, 1, 1234.5]) assert.ok(num(value, 1, locale).trim(), locale);
  }
});
