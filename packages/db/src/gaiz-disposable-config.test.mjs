import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGaizDisposableConfig} from './gaiz-disposable-config.mjs';
const tenantA='00000000-0000-4000-8000-000000000001';
const tenantB='00000000-0000-4000-8000-000000000002';
const ok={url:'postgres://gaiz_runner:test_secret@127.0.0.1:5432/gaiz_disposable_test',tenantA,tenantB};

test('only explicit local disposable database configuration accepted',()=>{
  assert.equal(validateGaizDisposableConfig(ok).database,'gaiz_disposable_test');
  assert.equal(validateGaizDisposableConfig({...ok,url:'postgresql://gaiz_runner:test_secret@localhost/gaiz_test_42'}).tenantA,tenantA);
});
test('production, remote, privileged and ambiguous URLs refused',()=>{
  const invalid=[
    'postgres://gaiz_runner:test_secret@prod-db/gaiz_disposable_test',
    'postgres://gaiz_runner:test_secret@192.168.1.3/gaiz_disposable_test',
    'postgres://postgres:test_secret@localhost/gaiz_disposable_test',
    'postgres://admin:test_secret@localhost/gaiz_disposable_test',
    'postgres://gaiz_runner:test_secret@localhost/epmo',
    'postgres://gaiz_runner:test_secret@localhost/gaiz_disposable_test?sslmode=disable',
    'postgres://gaiz_runner:test_secret@localhost/gaiz_disposable_test#frag',
    'postgres://gaiz_runner:test_secret@localhost/gaiz_%64isposable_test',
    'postgres://gaiz_runner@localhost/gaiz_disposable_test',
    'https://gaiz_runner:test_secret@localhost/gaiz_disposable_test',
  ];
  for(const url of invalid)assert.throws(()=>validateGaizDisposableConfig({...ok,url}),url);
  assert.throws(()=>validateGaizDisposableConfig({...ok,tenantB:tenantA}));
  assert.throws(()=>validateGaizDisposableConfig({}));
});
