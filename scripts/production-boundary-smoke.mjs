// Read-only smoke, streamed into the attested production API container.
const origin = 'http://127.0.0.1:4000';
const get = (path, headers = {}) => fetch(origin + path, {
  method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(10000),
});
const health = await get('/health');
if (health.status !== 200) throw Error('Production API health failed');
const body = await health.json();
if (body.ok !== true || body.service !== 'pmo-api') throw Error('Wrong API identity');
for (const path of ['/api/v1/subscription/current', '/api/v1/subscription/billing/invoices', '/api/v1/super-admin/tenants']) {
  for (const headers of [{}, {'x-tenant-id': 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'x-user-id': 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'}]) {
    const response = await get(path, headers);
    if (response.status !== 401) throw Error(path + ': expected 401, got ' + response.status);
  }
  console.log('PASS production anonymous and forged tenant-header denial: ' + path);
}
console.log('PASS production API identity and read-only authentication/tenant-header smoke');
