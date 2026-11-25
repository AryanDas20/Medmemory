'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../index');

function listen() {
  return new Promise(resolve => {
    const server = http.createServer(app).listen(0, () => resolve(server));
  });
}

test('root entry exports the Express app (a function, not a listening server)', () => {
  assert.equal(typeof app, 'function');
});

test('public API routes return JSON without authentication', async () => {
  const server = await listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/api/config', '/api/health']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get('content-type'), /json/, path);
      await res.json();
    }
    const cfg = await (await fetch(base + '/api/config')).json();
    assert.ok(!JSON.stringify(cfg).match(/private_key|service_role|client_email/i));
  } finally { server.close(); }
});

test('unknown API route and protected routes return JSON errors', async () => {
  const server = await listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const missing = await fetch(base + '/api/does-not-exist');
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /json/);
    const protectedRes = await fetch(base + '/api/profile', { method: 'PUT' });
    assert.ok([401, 403].includes(protectedRes.status));
    assert.match(protectedRes.headers.get('content-type'), /json/);
  } finally { server.close(); }
});

test('frontend serves index.html for the root path', async () => {
  const server = await listen();
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /html/);
  } finally { server.close(); }
});


test('Agent37 API key is never included in public config', async () => {
  const keys = ['AGENT37_API_KEY', 'AGENT37_INSTANCE_ID', 'AGENT37_INSTANCE_URL'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.AGENT37_API_KEY = 'sk_live_public_config_test_secret';
  process.env.AGENT37_INSTANCE_ID = 'ab12cd34ef';
  process.env.AGENT37_INSTANCE_URL = 'https://ab12cd34ef.agent37.app';
  const server = await listen();
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/config`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.agent37.chatEnabled, true);
    assert.equal(JSON.stringify(body).includes(process.env.AGENT37_API_KEY), false);
    assert.equal(Object.hasOwn(body.agent37, 'apiKey'), false);
  } finally {
    server.close();
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test('Agent37 chat, history, and session reset require Firebase authentication', async () => {
  const server = await listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const requests = [
      fetch(base + '/api/agent37/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hello' }) }),
      fetch(base + '/api/agent37/history'),
      fetch(base + '/api/agent37/session', { method: 'DELETE' })
    ];
    const responses = await Promise.all(requests);
    for (const response of responses) {
      assert.equal(response.status, 401);
      assert.match(response.headers.get('content-type'), /json/);
    }
  } finally { server.close(); }
});
