'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const agent37 = require('../server/agent37');

const ENV_KEYS = ['AGENT37_API_KEY', 'AGENT37_INSTANCE_ID', 'AGENT37_INSTANCE_URL'];
const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
const originalFetch = global.fetch;
const validSessionId = '7f3e0b6c52a949d2b1c4a8e9d0f31726';

function configureAgent37() {
  process.env.AGENT37_API_KEY = 'sk_live_test_only_not_a_real_key';
  process.env.AGENT37_INSTANCE_ID = 'ab12cd34ef';
  process.env.AGENT37_INSTANCE_URL = 'https://ab12cd34ef.agent37.app';
}

function restoreEnvironment() {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
}

test('Agent37 public configuration never exposes the Cloud API key', () => {
  configureAgent37();
  const config = agent37.publicConfig();
  assert.equal(config.chatEnabled, true);
  assert.equal(config.instanceId, 'ab12cd34ef');
  assert.equal(config.instanceUrl, 'https://ab12cd34ef.agent37.app');
  assert.equal(Object.hasOwn(config, 'apiKey'), false);
  assert.equal(JSON.stringify(config).includes(process.env.AGENT37_API_KEY), false);
  restoreEnvironment();
});

test('Agent37 stays disabled when required server credentials are missing', () => {
  delete process.env.AGENT37_API_KEY;
  delete process.env.AGENT37_INSTANCE_ID;
  delete process.env.AGENT37_INSTANCE_URL;
  assert.equal(agent37.publicConfig().chatEnabled, false);
  assert.throws(() => agent37.getConfig(), { status: 503 });
  restoreEnvironment();
});

test('Agent37 configuration rejects an instance URL that does not match the instance ID', () => {
  configureAgent37();
  process.env.AGENT37_INSTANCE_URL = 'https://attacker.example/v1';
  assert.throws(() => agent37.getConfig(), /must match/);
  restoreEnvironment();
});

test('Agent37 session IDs are validated before building upstream paths', () => {
  assert.equal(agent37.validateSessionId(validSessionId), validSessionId);
  assert.throws(() => agent37.validateSessionId('../../other-user'), { status: 409 });
});

test('Agent37 message proxy sends only typed input and uses the server-side key', async () => {
  configureAgent37();
  let captured;
  global.fetch = async (url, options) => {
    captured = { url: String(url), options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      id: 'c91d2a7e84f04b6f9a3d5e1c0b87f4a2',
      session_id: validSessionId,
      status: 'completed',
      output_text: 'Hello from the Agent37 test double.'
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await agent37.sendMessage('Hello Agent37');
  assert.equal(captured.url, 'https://ab12cd34ef.agent37.app/v1/responses');
  assert.equal(captured.options.headers['X-Agent37-Key'], 'sk_live_test_only_not_a_real_key');
  assert.deepEqual(captured.body, { input: 'Hello Agent37', stream: false, mode: 'chat' });
  assert.equal(Object.hasOwn(captured.body, 'files'), false);
  assert.equal(Object.hasOwn(captured.body, 'metadata'), false);
  assert.equal(Object.hasOwn(captured.body, 'session_id'), false);
  assert.deepEqual(result, { sessionId: validSessionId, message: 'Hello from the Agent37 test double.' });
  restoreEnvironment();
});

test('Agent37 continues only the provided server-owned session ID', async () => {
  configureAgent37();
  let sentBody;
  global.fetch = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ session_id: validSessionId, status: 'completed', output_text: 'Continued.' }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  };
  await agent37.sendMessage('Follow-up', validSessionId);
  assert.equal(sentBody.session_id, validSessionId);
  assert.equal(sentBody.input, 'Follow-up');
  restoreEnvironment();
});

test('Agent37 history exposes only user/assistant text and omits reasoning', async () => {
  configureAgent37();
  global.fetch = async () => new Response(JSON.stringify({
    history: [
      { role: 'user', content: 'Hi', created_at: 1781049601000 },
      { role: 'assistant', content: 'Hello', thinking: 'private chain of thought', created_at: 1781049642000 },
      { role: 'system', content: 'system prompt' },
      { role: 'tool', content: 'tool output' }
    ]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const history = await agent37.readHistory(validSessionId);
  assert.deepEqual(history.map(({ role, content }) => ({ role, content })), [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello' }
  ]);
  assert.equal(Object.hasOwn(history[1], 'thinking'), false);
  restoreEnvironment();
});
