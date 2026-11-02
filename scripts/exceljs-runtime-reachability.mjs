/**
 * Synthetic ExcelJS 4.x runtime reachability probe for GHSA-w5hq-g745-h8pq
 * and GHSA-g3hv-75wg-m249. This is NOT security acceptance: only the
 * first-party XLSX writeBuffer/load path is exercised, with no customer data.
 */
import assert from 'node:assert/strict';
import Module, {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const apiRequire = createRequire(pathToFileURL(resolve('apps/api/package.json')));
const originalLoad = Module._load;
const observed = {uuidLoads: 0, minimatchLoads: 0, vulnerableUuidCalls: 0, minimatchCalls: 0};
const dangerousUuidExports = new Set(['v3', 'v5', 'v6']);

function trackCall(fn, field) {
  return new Proxy(fn, {
    apply(target, thisArg, args) {
      observed[field]++;
      return Reflect.apply(target, thisArg, args);
    },
    construct(target, args, newTarget) {
      observed[field]++;
      return Reflect.construct(target, args, newTarget);
    },
  });
}

function instrumentExports(exports, names, field) {
  if (typeof exports === 'function') {
    const wrapped = trackCall(exports, field);
    return new Proxy(wrapped, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        return names.has(property) && typeof value === 'function' ? trackCall(value, field) : value;
      },
    });
  }
  if (!exports || typeof exports !== 'object') return exports;
  return new Proxy(exports, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      return names.has(property) && typeof value === 'function' ? trackCall(value, field) : value;
    },
  });
}

Module._load = function(specifier, parent, isMain) {
  const exports = originalLoad.call(this, specifier, parent, isMain);
  if (specifier === 'uuid') {
    observed.uuidLoads++;
    return instrumentExports(exports, dangerousUuidExports, 'vulnerableUuidCalls');
  }
  if (specifier === 'minimatch') {
    observed.minimatchLoads++;
    return instrumentExports(exports, new Set(['Minimatch', 'minimatch', 'match', 'makeRe', 'filter']), 'minimatchCalls');
  }
  return exports;
};

try {
  const ExcelJS = apiRequire('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Synthetic');
  sheet.addRow(['fixture', 'literal pattern', 'Arabic']);
  sheet.addRow(['noncustomer', '**/../**/../fixture', 'اختبار']);
  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.length > 200, 'XLSX writer must emit nonempty archive');
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(buffer);
  assert.equal(restored.getWorksheet('Synthetic').getCell('B2').value, '**/../**/../fixture');
  assert.equal(restored.getWorksheet('Synthetic').getCell('C2').value, 'اختبار');
} finally {
  Module._load = originalLoad;
}

assert.equal(observed.vulnerableUuidCalls, 0, 'ExcelJS exercised a vulnerable uuid v3/v5/v6 call');
assert.equal(observed.minimatchCalls, 0, 'ExcelJS XLSX buffer path invoked minimatch');
console.log('PASS scoped ExcelJS synthetic XLSX buffer/load call-path: ' + JSON.stringify({
  exactHeadSha: process.env.EPMO_CANDIDATE_SHA || null,
  exceljsVersion: apiRequire('exceljs/package.json').version,
  ...observed,
  scope: 'LOCAL_SYNTHETIC_XLSX_BUFFER_LOAD_ONLY_NOT_SECURITY_ACCEPTANCE',
}));
