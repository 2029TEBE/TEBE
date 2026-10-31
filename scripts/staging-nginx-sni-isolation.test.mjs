import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as httpServer, get as httpGet } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createServer as netServer } from 'node:net';
import { once } from 'node:events';

const source = readFileSync(new URL('../infra/staging/nginx.conf', import.meta.url), 'utf8');
const hosts = ['staging.theepmo.com', 'api-staging.theepmo.com'];
const guard = 'if ($ssl_server_name != $host) { return 421; }';
const available = ['nginx', 'openssl'].every(bin =>
  spawnSync(bin, [bin === 'nginx' ? '-v' : 'version'], { timeout: 3000 }).status === 0);
function replaceExact(input, from, to, count) {
  assert.equal(input.split(from).length - 1, count, 'Unexpected reviewed Nginx directive: ' + from);
  return input.split(from).join(to);
}
async function listen(server) {
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  return server.address().port;
}
async function freePort() {
  const server = netServer(), port = await listen(server);
  await new Promise(ok => server.close(ok));
  return port;
}
function getTls(port, ca, sni, host, extra = {}) {
  return new Promise((ok, fail) => {
    const req = httpsRequest({ hostname: '127.0.0.1', port, path: '/', agent: false,
      servername: sni, ca, rejectUnauthorized: true, timeout: 2500,
      headers: { Host: host, ...extra } }, res => {
      let body = '', size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 8192) req.destroy(new Error('Response too large'));
        else body += chunk.toString('utf8');
      });
      res.on('end', () => ok({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy(new Error('Local TLS timeout')));
    req.on('error', fail);
    req.end();
  });
}
async function ready(port, child) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Disposable Nginx exited');
    try {
      const code = await new Promise((ok, fail) => {
        const req = httpGet({ hostname: '127.0.0.1', port, path: '/edge-health', timeout: 300 }, res => {
          res.resume(); res.on('end', () => ok(res.statusCode));
        });
        req.on('error', fail);
        req.on('timeout', () => req.destroy());
      });
      if (code === 200) return;
    } catch { /* disposable listener not ready */ }
    await new Promise(ok => setTimeout(ok, 60));
  }
  throw new Error('Disposable Nginx readiness timeout');
}

async function disposableNginx(run) {
  const dir = mkdtempSync(join(tmpdir(), 'epmo-s39-'));
  const upstream = name => httpServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ name, headers: req.headers }));
  });
  const web = upstream('web'), api = upstream('api');
  let child;
  try {
    const webPort = await listen(web), apiPort = await listen(api);
    const tlsPort = await freePort(), healthPort = await freePort();
    const cert = join(dir, 'tls.crt'), key = join(dir, 'tls.key');
    const openssl = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-days', '2', '-subj', '/CN=staging.theepmo.com',
      '-addext', 'subjectAltName=DNS:staging.theepmo.com,DNS:api-staging.theepmo.com',
      '-keyout', key, '-out', cert], { timeout: 15000, stdio: 'ignore' });
    assert.equal(openssl.status, 0, 'Synthetic certificate generation failed');
    let conf = source;
    for (const [from, to, count] of [
      ['listen 8080;', 'listen 127.0.0.1:' + healthPort + ';', 1],
      ['listen 8443 ssl default_server;', 'listen 127.0.0.1:' + tlsPort + ' ssl default_server;', 1],
      ['listen 8443 ssl;', 'listen 127.0.0.1:' + tlsPort + ' ssl;', 2],
      ['/run/epmo-tls/tls.crt', cert, 3], ['/run/epmo-tls/tls.key', key, 3],
      ['web:3000', '127.0.0.1:' + webPort, 1], ['api:4000', '127.0.0.1:' + apiPort, 1],
    ]) conf = replaceExact(conf, from, to, count);
    writeFileSync(join(dir, 'vhosts.conf'), conf, { mode: 0o600 });
    for (const name of ['client', 'proxy', 'fastcgi', 'uwsgi', 'scgi']) mkdirSync(join(dir, name));
    writeFileSync(join(dir, 'nginx.conf'),
      'pid ' + dir + '/nginx.pid;\nerror_log ' + dir + '/error.log notice;\n' +
      'events { worker_connections 64; }\nhttp { access_log off; ' +
      ['client', 'proxy', 'fastcgi', 'uwsgi', 'scgi'].map(name =>
        (name === 'client' ? 'client_body' : name) + '_temp_path ' + dir + '/' + name + ';').join(' ') +
      ' include ' + dir + '/vhosts.conf; }\n', { mode: 0o600 });
    const args = ['-p', dir + '/', '-c', join(dir, 'nginx.conf')];
    assert.equal(spawnSync('nginx', [...args, '-t'], { timeout: 5000 }).status, 0,
      'Disposable Nginx configuration invalid');
    child = spawn('nginx', [...args, '-g', 'daemon off;'], { stdio: 'ignore' });
    await ready(healthPort, child);
    await run({ port: tlsPort, ca: readFileSync(cert) });
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([once(child, 'exit').catch(() => {}),
        new Promise(ok => setTimeout(ok, 1800))]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await Promise.all([web, api].filter(s => s.listening).map(s =>
      new Promise(ok => s.close(ok))));
    rmSync(dir, { recursive: true, force: true });
  }
}

test('S39: both staging Nginx vhosts fail closed on mismatched SNI/Host', () => {
  assert.equal(source.split(guard).length - 1, 2);
  assert.match(source, /listen 8443 ssl default_server;[\s\S]*?return 421;/);
  assert.equal((source.match(/server_name\s+(?:api-)?staging\.theepmo\.com;/g) || []).length, 2);
  assert.doesNotMatch(source, /server_name\s+app\.theepmo\.com\s*;/);
});

test('S39 real loopback Nginx routes staging web/API only on matching SNI and replaces forged headers',
  { skip: !available, timeout: 20000 }, async () => {
    await disposableNginx(async ({ port, ca }) => {
      for (const [host, expected] of [[hosts[0], 'web'], [hosts[1], 'api']]) {
        const r = await getTls(port, ca, host, host, {
          'X-Forwarded-For': '203.0.113.8', 'X-Forwarded-Proto': 'http',
          'X-Forwarded-Host': 'app.theepmo.com', 'X-Forwarded-Port': '80',
        });
        assert.equal(r.status, 200);
        const data = JSON.parse(r.body);
        assert.equal(data.name, expected);
        assert.equal(data.headers.host, host);
        assert.equal(data.headers['x-forwarded-for'], '127.0.0.1');
        assert.equal(data.headers['x-forwarded-proto'], 'https');
        assert.equal(data.headers['x-forwarded-host'], host);
        assert.equal(data.headers['x-forwarded-port'], '443');
      }
      for (const [sni, host] of [
        [hosts[0], hosts[1]], [hosts[1], hosts[0]],
        [hosts[0], 'app.theepmo.com'], [hosts[1], 'app.theepmo.com'],
        [hosts[0], 'unknown.theepmo.com'],
      ]) {
        const r = await getTls(port, ca, sni, host);
        assert.equal(r.status, 421, 'Must reject cross-vhost SNI=' + sni + ' Host=' + host);
      }
    });
  });
