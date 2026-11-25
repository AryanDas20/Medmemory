'use strict';

const SESSION_ID_RE = /^[a-f0-9]{32}$/i;
const INSTANCE_ID_RE = /^[a-z0-9]{10}$/;
const REQUEST_TIMEOUT_MS = 240_000;

function configurationError(message = 'Agent37 is not configured. Check the server environment variables.') {
  return Object.assign(new Error(message), { status: 503 });
}

function getConfig() {
  const apiKey = String(process.env.AGENT37_API_KEY || '').trim();
  const instanceId = String(process.env.AGENT37_INSTANCE_ID || '').trim().toLowerCase();
  if (!apiKey || !apiKey.startsWith('sk_live_')) throw configurationError();
  if (!INSTANCE_ID_RE.test(instanceId)) throw configurationError('Set a valid 10-character AGENT37_INSTANCE_ID.');

  const configuredUrl = String(process.env.AGENT37_INSTANCE_URL || `https://${instanceId}.agent37.app`).trim();
  let parsed;
  try { parsed = new URL(configuredUrl); }
  catch { throw configurationError('AGENT37_INSTANCE_URL must be a valid HTTPS instance URL.'); }

  // Do not accept arbitrary hosts here. This prevents an environment typo or
  // future request parameter from turning the server into an SSRF proxy.
  if (parsed.protocol !== 'https:' || parsed.hostname !== `${instanceId}.agent37.app`
      || (parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash
      || parsed.username || parsed.password || parsed.port) {
    throw configurationError('AGENT37_INSTANCE_URL must match https://AGENT37_INSTANCE_ID.agent37.app.');
  }

  return { apiKey, instanceId, instanceUrl: parsed.origin };
}

function publicConfig() {
  const instanceId = String(process.env.AGENT37_INSTANCE_ID || '').trim().toLowerCase();
  try {
    const config = getConfig();
    return {
      instanceId: config.instanceId,
      instanceUrl: config.instanceUrl,
      chatEnabled: true
    };
  } catch {
    // A public status flag is safe; the API key itself is never returned.
    return {
      instanceId: INSTANCE_ID_RE.test(instanceId) ? instanceId : '',
      instanceUrl: INSTANCE_ID_RE.test(instanceId) ? `https://${instanceId}.agent37.app` : '',
      chatEnabled: false
    };
  }
}

function validateSessionId(value) {
  const id = String(value || '');
  if (!SESSION_ID_RE.test(id)) throw Object.assign(new Error('The saved Agent37 conversation is invalid. Start a new chat.'), { status: 409 });
  return id;
}

function mapUpstreamError(status, body) {
  const code = body?.error?.code || body?.code || '';
  if (code === 'insufficient_balance' || status === 402) {
    return Object.assign(new Error('The Agent37 Cloud wallet is out of available credit. Check your Agent37 billing balance.'), { status: 402 });
  }
  if (code === 'invalid_api_key' || status === 401 || status === 403) {
    return Object.assign(new Error('Agent37 rejected the server credentials. Check the API key and its access settings.'), { status: 502 });
  }
  if (code === 'session_busy' || status === 409) {
    return Object.assign(new Error('Agent37 is still working on this conversation. Wait a moment and try again.'), { status: 409 });
  }
  if (code === 'wake_timeout' || status === 503) {
    return Object.assign(new Error('Agent37 could not wake or reach the instance. Check that the instance is healthy and try again.'), { status: 502 });
  }
  return Object.assign(new Error('Agent37 could not complete the request. Check the instance and try again.'), { status: 502 });
}

async function request(path, { method = 'GET', body } = {}) {
  const config = getConfig();
  let response;
  try {
    response = await fetch(`${config.instanceUrl}${path}`, {
      method,
      headers: {
        'X-Agent37-Key': config.apiKey,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw Object.assign(new Error('Agent37 took too long to respond. Please try again.'), { status: 504 });
    }
    throw Object.assign(new Error('Could not reach Agent37. Check the instance URL and network status.'), { status: 502 });
  }

  let data = null;
  try { data = await response.json(); } catch { /* handled below without echoing upstream HTML or raw content */ }
  if (!response.ok) throw mapUpstreamError(response.status, data);
  if (!data || typeof data !== 'object') {
    throw Object.assign(new Error('Agent37 returned an unreadable response.'), { status: 502 });
  }
  return data;
}

async function sendMessage(message, sessionId) {
  const body = { input: message, stream: false, mode: 'chat' };
  if (sessionId) body.session_id = validateSessionId(sessionId);
  const data = await request('/v1/responses', { method: 'POST', body });
  if (data.status === 'failed') {
    throw mapUpstreamError(502, data);
  }
  if (data.status !== 'completed' || typeof data.output_text !== 'string' || !SESSION_ID_RE.test(String(data.session_id || ''))) {
    throw Object.assign(new Error('Agent37 returned an incomplete response. Please try again.'), { status: 502 });
  }
  return { sessionId: data.session_id, message: data.output_text };
}

async function readHistory(sessionId) {
  const id = validateSessionId(sessionId);
  const data = await request(`/v1/sessions/${encodeURIComponent(id)}`);
  const history = Array.isArray(data.history) ? data.history : [];
  return history
    .filter(item => (item?.role === 'user' || item?.role === 'assistant') && typeof item.content === 'string')
    .slice(-60)
    .map(item => ({ role: item.role, content: item.content.slice(0, 12_000), createdAt: Number(item.created_at) || null }));
}

async function deleteSession(sessionId) {
  const id = validateSessionId(sessionId);
  return request(`/v1/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

module.exports = { getConfig, publicConfig, validateSessionId, sendMessage, readHistory, deleteSession };
