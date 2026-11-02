/** E65: synthetic buffered and streaming XLSX archive compatibility proof. */
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const dir = mkdtempSync(join(tmpdir(), 'epmo-e65-xlsx-'));
const expected = ['Arabic / العربية', 'English', 17];
try {
  const buffered = new ExcelJS.Workbook();
  buffered.addWorksheet('Data').addRow(expected);
  const bytes = await buffered.xlsx.writeBuffer();
  assert.ok(bytes.byteLength > 100, 'Buffered XLSX must contain data');
  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(bytes);
  assert.deepEqual(reread.getWorksheet('Data').getRow(1).values.slice(1), expected);
  const filename = join(dir, 'stream.xlsx');
  const writer = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename, useStyles: true, useSharedStrings: true
  });
  const sheet = writer.addWorksheet('Data');
  sheet.addRow(expected).commit();
  sheet.commit();
  await writer.commit();
  const streamed = new ExcelJS.Workbook();
  await streamed.xlsx.readFile(filename);
  assert.deepEqual(streamed.getWorksheet('Data').getRow(1).values.slice(1), expected);
  console.log('PASS E65 synthetic ExcelJS buffered + streaming XLSX write/read (not staging/security signoff)');
} finally {
  rmSync(dir, {recursive: true, force: true});
}
