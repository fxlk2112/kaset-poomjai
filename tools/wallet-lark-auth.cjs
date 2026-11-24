'use strict';

const {randomBytes, createHash, timingSafeEqual} = require('node:crypto');

const AUTHORIZE = 'https://accounts.larksuite.com/open-apis/authen/v1/authorize';
const TOKEN = 'https://open.larksuite.com/open-apis/authen/v2/oauth/token';
const USERINFO = 'https://open.larksuite.com/open-apis/authen/v1/user_info';
const STATE_COOKIE = 'wallet_lark_oauth';
const SESSION_COOKIE = 'wallet_lark_session';
const STATE_MS = 10 * 60 * 1000;
const SESSION_MS = 60 * 60 * 1000;
const LIMIT = 1000;
const RANDOM = /^[A-Za-z0-9_-]{43}$/;
const fail = (status, message) => Object.assign(new Error(message), {status});
const denied = () => fail(401, 'กรุณาเข้าสู่ระบบ Lark อีกครั้ง');
const unavailable = () => fail(502, 'ตรวจสอบบัญชี Lark ไม่สำเร็จ กรุณาลองใหม่');
const digest = value => createHash('sha256').update(value).digest();
const random = () => randomBytes(32).toString('base64url');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 &&
  value.length <= max && !/[\x00-\x1f\x7f]/.test(value);

// Reject duplicate cookie names rather than choosing an attacker-controlled path variant.
function cookieValue(header, name) {
  if (typeof header !== 'string' || header.length > 16384) return null;
  let value = null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (part.slice(0, index < 0 ? part.length : index).trim() !== name) continue;
    if (index < 0 || value !== null) return null;
    value = part.slice(index + 1).trim();
    if (!RANDOM.test(value)) return null;
  }
  return value;
}

/** One server-process instance; environment credentials and tenant are snapshotted at creation. */
function createLarkAuth({env = process.env, fetcher = fetch, now = Date.now, onDiagnostic = () => {},
  origin = 'http://127.0.0.1:4208'} = {}) {
  let parsed;
  try { parsed = new URL(origin); } catch { /* Validated below without echoing input. */ }
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
    throw fail(400, 'ที่อยู่เซิร์ฟเวอร์เข้าสู่ระบบไม่ถูกต้อง');
  }
  const callback = origin + '/__wallet/oauth/callback';
  const secure = parsed.protocol === 'https:' ? '; Secure' : '';
  const clientId = text(env.LARK_APP_ID, 256) ? env.LARK_APP_ID.trim() : '';
  const clientSecret = text(env.LARK_APP_SECRET, 4096) ? env.LARK_APP_SECRET.trim() : '';
  const tenant = text(env.LARK_WALLET_TENANT_KEY, 256) ? env.LARK_WALLET_TENANT_KEY.trim() : '';
  const missing = [];
  if (env.LARK_WALLET_LOGIN_ENABLED !== '1') missing.push('LARK_WALLET_LOGIN_ENABLED');
  if (!clientId) missing.push('LARK_APP_ID');
  if (!clientSecret) missing.push('LARK_APP_SECRET');
  if (!tenant) missing.push('LARK_WALLET_TENANT_KEY');
  const enabled = missing.length === 0;
  const states = new Map(), sessions = new Map();
  // Emit only fixed stage labels and numeric provider codes, never identity or credentials.
  const report = (stage, reason, code) => {
    try { onDiagnostic({stage, reason, ...(Number.isSafeInteger(code) ? {code} : {})}); } catch {}
  };
  const config = () => ({enabled, callback, missing: [...missing]});
  const requireEnabled = () => {
    if (!enabled) throw fail(503, 'ยังไม่ได้เปิดใช้งานการเข้าสู่ระบบ Lark สำหรับกระเป๋า');
  };
  const stateCookie = (value, maxAge) =>
    `${STATE_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/__wallet/oauth; Max-Age=${maxAge}${secure}`;
  const sessionCookie = (value, maxAge) =>
    `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/__wallet; Max-Age=${maxAge}${secure}`;
  const clearStateCookie = () => stateCookie('', 0);
  function prune(map) {
    const time = now();
    for (const [key, value] of map) if (time >= value.expiresAt) map.delete(key);
  }
  function begin() {
    requireEnabled();
    prune(states);
    if (states.size >= LIMIT) throw fail(429, 'มีคำขอเข้าสู่ระบบมากเกินไป กรุณารอสักครู่');
    const state = random(), nonce = random();
    states.set(digest(state).toString('hex'), {nonceHash: digest(nonce), expiresAt: now() + STATE_MS});
    const url = new URL(AUTHORIZE);
    url.search = new URLSearchParams({client_id: clientId, response_type: 'code',
      scope: 'contact:user.base:readonly', state, redirect_uri: callback}).toString();
    return {url: url.toString(), stateCookie: stateCookie(nonce, STATE_MS / 1000)};
  }

  async function provider(url, options) {
    const stage = url === TOKEN ? 'token' : 'userinfo';
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(fail(504, 'Lark ตอบช้า กรุณาลองเข้าสู่ระบบอีกครั้ง'));
        controller.abort();
      }, 15000);
    });
    try {
      return await Promise.race([timeout, (async () => {
        let response;
        try {
          response = await fetcher(url, {...options, redirect: 'error', cache: 'no-store',
            credentials: 'omit', signal: controller.signal});
        } catch { report(stage, 'network'); throw unavailable(); }
        if (!response || response.redirected || (response.url && response.url !== url)) throw unavailable();
        if (response.ok !== true || !Number.isInteger(response.status) ||
            response.status < 200 || response.status >= 300) {
          report(stage, 'http', response.status);
          if ([400, 401, 403].includes(response?.status)) throw denied();
          throw unavailable();
        }
        let body;
        try { body = await response.json(); } catch { throw unavailable(); }
        if (!object(body)) throw unavailable();
        if (Object.hasOwn(body, 'error') || (Object.hasOwn(body, 'code') && body.code !== 0)) {
          report(stage, 'provider', body.code);
          throw denied();
        }
        return body;
      })()]);
    } finally { clearTimeout(timer); }
  }

  async function userInfo(accessToken) {
    const body = await provider(USERINFO, {method: 'GET',
      headers: {Accept: 'application/json', Authorization: 'Bearer ' + accessToken}});
    const data = body.data;
    if (body.code !== 0 || !object(data) || typeof data.open_id !== 'string' ||
        !/^ou_[A-Za-z0-9]{1,128}$/.test(data.open_id) || !text(data.name, 256) ||
        !text(data.tenant_key, 256)) { report('userinfo', 'schema'); throw unavailable(); }
    if (data.tenant_key !== tenant) { report('userinfo', 'tenant'); throw fail(403, 'บัญชี Lark นี้ไม่ได้อยู่ในองค์กรที่อนุญาต'); }
    return Object.freeze({id: data.open_id, name: data.name.trim(), tenant: data.tenant_key});
  }

  async function complete(args = {}) {
    requireEnabled();
    if (!object(args)) throw denied();
    const {state, code, cookie, error} = args;
    if (typeof state !== 'string' || !RANDOM.test(state)) { report('callback', 'state'); throw denied(); }
    const key = digest(state).toString('hex'), pending = states.get(key);
    // Consume before validation or any await: even rejected callbacks cannot be replayed.
    states.delete(key);
    const nonce = cookieValue(cookie, STATE_COOKIE);
    if (!pending || !timingSafeEqual(pending.nonceHash, digest(nonce || '')) ||
        !nonce || now() >= pending.expiresAt) {
      report('callback', !pending ? 'missing-state' : !nonce ? 'missing-cookie' : now() >= pending.expiresAt ? 'expired' : 'cookie-mismatch');
      throw denied();
    }
    if (error !== undefined && error !== null) { report('callback', 'provider-error'); throw denied(); }
    if (!text(code, 4096) || /\s/.test(code)) throw denied();
    prune(sessions);
    if (sessions.size >= LIMIT) throw fail(429, 'มีผู้ใช้งานมากเกินไป กรุณารอสักครู่');
    // Start the expiry clock before exchange so network latency cannot extend token life.
    const startedAt = now();
    const token = await provider(TOKEN, {method: 'POST',
      headers: {'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json'},
      body: JSON.stringify({grant_type: 'authorization_code', client_id: clientId,
        client_secret: clientSecret, code, redirect_uri: callback})});
    if (typeof token.access_token !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(token.access_token) ||
        !Number.isSafeInteger(token.expires_in) || token.expires_in <= 0 ||
        (token.token_type !== undefined && !/^Bearer$/i.test(token.token_type))) { report('token', 'schema'); throw unavailable(); }
    const expiresAt = startedAt + Math.min(token.expires_in * 1000, SESSION_MS);
    const identity = await userInfo(token.access_token);
    const maxAge = Math.floor((expiresAt - now()) / 1000);
    if (maxAge <= 0) throw denied();
    prune(sessions);
    // Recheck after awaits; simultaneous callbacks must not exceed the session bound.
    if (sessions.size >= LIMIT) throw fail(429, 'มีผู้ใช้งานมากเกินไป กรุณารอสักครู่');
    const sessionId = random();
    sessions.set(sessionId, {accessToken: token.access_token, identity, expiresAt});
    return {sessionCookie: sessionCookie(sessionId, maxAge), identity, expiresAt};
  }

  function sessionFor(cookie) {
    if (!enabled) return null;
    const id = cookieValue(cookie, SESSION_COOKIE), session = sessions.get(id);
    if (!session) return null;
    if (now() >= session.expiresAt) { sessions.delete(id); return null; }
    return {id, session};
  }
  function valid(cookie) { return sessionFor(cookie) !== null; }
  async function authenticate(cookie) {
    requireEnabled();
    const entry = sessionFor(cookie);
    if (!entry) throw denied();
    const {id, session} = entry;
    try {
      const identity = await userInfo(session.accessToken);
      if (identity.id !== session.identity.id || identity.tenant !== session.identity.tenant) {
        throw fail(403, 'ข้อมูลบัญชี Lark เปลี่ยนแปลง กรุณาเข้าสู่ระบบอีกครั้ง');
      }
      // Logout, revocation in another request, or expiry wins over an in-flight success.
      if (sessions.get(id) !== session || now() >= session.expiresAt) throw denied();
      session.identity = identity;
      return identity;
    } catch (error) {
      sessions.delete(id);
      throw error;
    }
  }
  function logout(cookie) {
    const id = cookieValue(cookie, SESSION_COOKIE);
    if (id) sessions.delete(id);
    return {sessionCookie: sessionCookie('', 0)};
  }

  return {config, begin, complete, authenticate, valid, logout, clearStateCookie};
}

module.exports = {createLarkAuth};
