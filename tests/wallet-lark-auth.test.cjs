'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createLarkAuth} = require('../tools/wallet-lark-auth.cjs');

const TOKEN = 'https://open.larksuite.com/open-apis/authen/v2/oauth/token';
const USERINFO = 'https://open.larksuite.com/open-apis/authen/v1/user_info';
const ORIGIN = 'http://127.0.0.1:4208';
const CALLBACK = ORIGIN + '/__wallet/oauth/callback';
const ENV = {LARK_WALLET_LOGIN_ENABLED: '1', LARK_APP_ID: 'cli_test',
  LARK_APP_SECRET: 'test-confidential-secret', LARK_WALLET_TENANT_KEY: 'tenant-test'};
const USER = {open_id: 'ou_Test123', name: 'Test Person', tenant_key: 'tenant-test'};
const IDENTITY = {id: USER.open_id, name: USER.name, tenant: USER.tenant_key};
const ACCESS = 'test-user-access-token';
const REFRESH = 'test-refresh-token';
const pair = cookie => cookie.split(';')[0];
const status = expected => error => {
  assert.equal(error.status, expected);
  assert.match(error.message, /[\u0e00-\u0e7f]/);
  assert.doesNotMatch(error.message, /test-confidential-secret|test-user-access-token|test-refresh-token|private-provider-detail/);
  return true;
};
function response(body, httpStatus = 200, extra = {}) {
  return {ok: httpStatus >= 200 && httpStatus < 300, status: httpStatus,
    redirected: false, json: async () => body, ...extra};
}
function fixture(options = {}) {
  let time = 1000000;
  const calls = [];
  const provider = {
    token: () => response({code: 0, access_token: ACCESS, refresh_token: REFRESH,
      expires_in: 7200, token_type: 'Bearer'}),
    info: () => response({code: 0, data: {...USER}})
  };
  const fetcher = async (url, init) => {
    calls.push({url, ...init});
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'omit');
    assert.ok(init.signal instanceof AbortSignal);
    if (url === TOKEN) return provider.token(init);
    assert.equal(url, USERINFO);
    return provider.info(init);
  };
  const auth = createLarkAuth({env: {...ENV}, fetcher, now: () => time, ...options});
  const start = () => {
    const begun = auth.begin();
    return {state: new URL(begun.url).searchParams.get('state'),
      code: 'test-authorization-code', cookie: pair(begun.stateCookie)};
  };
  const login = async () => auth.complete(start());
  return {auth, calls, provider, start, login, advance: ms => { time += ms; }};
}

test('diagnostics contain only fixed labels and numeric codes, never provider secrets', async () => {
  const events = [], f = fixture({onDiagnostic: event => events.push(event)});
  f.provider.token = () => response({code: 20050, error: ACCESS, msg: ENV.LARK_APP_SECRET});
  await assert.rejects(f.login(), status(401));
  assert.deepEqual(events, [{stage: 'token', reason: 'provider', code: 20050}]);
  const args = f.start();
  await assert.rejects(f.auth.complete({...args, cookie: ''}), status(401));
  assert.deepEqual(events[1], {stage: 'callback', reason: 'missing-cookie'});
  const brokenLogger = fixture({onDiagnostic: () => { throw Error('logger failure'); }});
  await assert.rejects(brokenLogger.auth.complete({}), status(401));
});

test('configuration is opt-in, reports safe labels, and never mutates or enables env', async () => {
  for (const key of Object.keys(ENV)) {
    const env = {...ENV}; delete env[key];
    const snapshot = {...env}, f = fixture({env});
    assert.deepEqual(f.auth.config(), {enabled: false, callback: CALLBACK, missing: [key]});
    assert.throws(() => f.auth.begin(), status(503));
    await assert.rejects(f.auth.complete({}), status(503));
    await assert.rejects(f.auth.authenticate(''), status(503));
    assert.equal(f.auth.valid(''), false);
    assert.match(f.auth.logout('').sessionCookie, /Max-Age=0/);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(env, snapshot);
  }
  for (const value of ['0', true, 1, '', undefined]) {
    assert.equal(fixture({env: {...ENV, LARK_WALLET_LOGIN_ENABLED: value}}).auth.config().enabled, false);
  }
  const empty = fixture({env: {}}).auth.config();
  assert.deepEqual(empty.missing, Object.keys(ENV));
  const f = fixture();
  f.auth.config().missing.push('spoof');
  assert.deepEqual(f.auth.config(), {enabled: true, callback: CALLBACK, missing: []});
});

test('begin is synchronous, random, browser-bound, and uses only the fixed authorize parameters', () => {
  const f = fixture(), a = f.auth.begin(), b = f.auth.begin(), url = new URL(a.url);
  assert.equal(url.origin + url.pathname, 'https://accounts.larksuite.com/open-apis/authen/v1/authorize');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['client_id', 'redirect_uri', 'response_type', 'scope', 'state']);
  assert.equal(url.searchParams.get('client_id'), ENV.LARK_APP_ID);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'contact:user.base:readonly');
  assert.equal(url.searchParams.get('redirect_uri'), CALLBACK);
  assert.match(url.searchParams.get('state'), /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.url, b.url);
  assert.notEqual(a.stateCookie, b.stateCookie);
  assert.ok(!a.stateCookie.includes(url.searchParams.get('state')));
  assert.match(a.stateCookie, /^wallet_lark_oauth=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Lax; Path=\/__wallet\/oauth; Max-Age=600$/);
  assert.equal(f.calls.length, 0);
});

test('complete exchanges confidential code, ignores client identity, and returns only verified identity', async () => {
  const f = fixture(), args = f.start();
  const result = await f.auth.complete({...args, identity: {id: 'ou_Attacker', tenant: 'other'},
    open_id: 'ou_Attacker', tenant: 'other', admin: true, access_token: 'client-token',
    redirect_uri: 'https://attacker.invalid/callback', client_secret: 'attacker-secret'});
  assert.deepEqual(Object.keys(result).sort(), ['expiresAt', 'identity', 'sessionCookie']);
  assert.deepEqual(result.identity, IDENTITY);
  assert.ok(Object.isFrozen(result.identity));
  assert.equal(result.expiresAt, 1000000 + 3600000);
  assert.match(result.sessionCookie, /^wallet_lark_session=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Strict; Path=\/__wallet; Max-Age=3600$/);
  assert.equal(f.calls[0].url, TOKEN);
  assert.equal(f.calls[0].method, 'POST');
  assert.match(f.calls[0].headers['Content-Type'], /^application\/json/);
  assert.deepEqual(JSON.parse(f.calls[0].body), {grant_type: 'authorization_code', client_id: ENV.LARK_APP_ID,
    client_secret: ENV.LARK_APP_SECRET, code: args.code, redirect_uri: CALLBACK});
  assert.equal(f.calls[1].method, 'GET');
  assert.equal(f.calls[1].headers.Authorization, 'Bearer ' + ACCESS);
  assert.equal(f.calls[1].body, undefined);
  assert.doesNotMatch(JSON.stringify(result), /test-confidential-secret|test-user-access-token|test-refresh-token|test-authorization-code/);
  assert.equal(f.auth.valid(pair(result.sessionCookie)), true);
  await assert.rejects(f.auth.complete(args), status(401));
  assert.equal(f.calls.length, 2);
});

test('missing, wrong-browser, duplicate, malformed and expired nonce cookies fail before exchange', async () => {
  for (const tamper of [() => undefined, () => '', () => 'wallet_lark_oauth=bad',
    (args, f) => f.start().cookie, args => args.cookie + '; ' + args.cookie,
    args => args.cookie.replace('=', '=%'), args => ({cookie: args.cookie})]) {
    const f = fixture(), args = f.start();
    await assert.rejects(f.auth.complete({...args, cookie: tamper(args, f)}), status(401));
    await assert.rejects(f.auth.complete(args), status(401));
    assert.equal(f.calls.length, 0);
  }
  const f = fixture(), args = f.start();
  f.advance(600000);
  await assert.rejects(f.auth.complete(args), status(401));
  assert.equal(f.calls.length, 0);
});

test('callback errors, invalid codes, and state replay cannot reach provider', async () => {
  for (const changes of [{error: 'private-provider-detail'}, {code: ''}, {code: {}}, {code: 'code\n'},
    {state: ''}, {state: []}, {state: 'x'.repeat(43)}]) {
    const f = fixture(), args = f.start();
    await assert.rejects(f.auth.complete({...args, ...changes}), status(401));
    assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  await assert.rejects(f.auth.complete(null), status(401));
  await assert.rejects(f.auth.complete(), status(401));
  const args = f.start();
  const results = await Promise.allSettled([f.auth.complete(args), f.auth.complete(args)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 401);
  assert.equal(f.calls.length, 2);
});

test('tenant and credentials are immutable factory configuration; returned identity cannot be changed', async () => {
  const env = {...ENV}, f = fixture({env});
  env.LARK_WALLET_TENANT_KEY = 'tenant-attacker';
  env.LARK_APP_ID = 'cli_attacker'; env.LARK_APP_SECRET = 'attacker-secret';
  const result = await f.login();
  assert.equal(JSON.parse(f.calls[0].body).client_id, ENV.LARK_APP_ID);
  assert.equal(JSON.parse(f.calls[0].body).client_secret, ENV.LARK_APP_SECRET);
  assert.throws(() => { result.identity.id = 'ou_Attacker'; }, TypeError);
  f.provider.info = () => response({code: 0, data: {...USER, tenant_key: env.LARK_WALLET_TENANT_KEY}});
  await assert.rejects(f.auth.authenticate(pair(result.sessionCookie)), status(403));
  assert.equal(f.auth.valid(pair(result.sessionCookie)), false);
  await assert.rejects(f.login(), status(403));
});

test('userinfo requires a successful envelope, valid open_id, tenant and name', async () => {
  for (const body of [null, [], {}, {code: 0}, {code: 0, data: null},
    {code: 1, data: USER}, {code: '0', data: USER}, {data: USER},
    ...['', 'user-id', 'ou_x/../y', 'ou_', 42].map(open_id => ({code: 0, data: {...USER, open_id}})),
    ...['', null, 'bad\nname'].map(name => ({code: 0, data: {...USER, name}})),
    {code: 0, data: {...USER, tenant_key: ''}}]) {
    const f = fixture(); f.provider.info = () => response(body);
    await assert.rejects(f.login(), error => [401, 502].includes(error.status));
  }
});

test('token failures and malformed lifetimes fail closed without exposing provider details', async () => {
  for (const body of [null, [], {}, {code: 1, access_token: ACCESS, expires_in: 3600},
    {error: 'private-provider-detail', access_token: ACCESS, expires_in: 3600},
    ...[0, -1, '3600', null, 1.5, Infinity].map(expires_in => ({access_token: ACCESS, expires_in})),
    ...['', 'bad\r\ntoken', null].map(access_token => ({access_token, expires_in: 3600})),
    {access_token: ACCESS, expires_in: 3600, token_type: 'MAC'}]) {
    const f = fixture(); f.provider.token = () => response(body);
    await assert.rejects(f.login(), error => {
      assert.ok([401, 502].includes(error.status));
      return status(error.status)(error);
    });
    assert.equal(f.calls.length, 1);
  }
});

test('redirects, HTTP errors, malformed JSON and network errors are rejected at both endpoints', async () => {
  for (const endpoint of ['token', 'info']) {
    for (const [reply, expected] of [
      [() => response({}, 302), 502],
      [() => response({}, 200, {redirected: true}), 502],
      [() => response({}, 200, {url: 'https://attacker.invalid/'}), 502],
      [() => response({code: 0, access_token: ACCESS, expires_in: 3600, data: USER}, 401), 401],
      [() => response({code: 0, access_token: ACCESS, expires_in: 3600, data: USER}, 503), 502],
      [() => response({}, 200, {json: async () => { throw new Error(ACCESS); }}), 502],
      [() => { throw new Error('private-provider-detail ' + ENV.LARK_APP_SECRET); }, 502]
    ]) {
      const f = fixture(); f.provider[endpoint] = reply;
      await assert.rejects(f.login(), status(expected));
    }
  }
});

test('authenticate revalidates every request and provider revocation destroys the session', async () => {
  const f = fixture(), result = await f.login(), cookie = 'other=value; ' + pair(result.sessionCookie);
  assert.deepEqual(await f.auth.authenticate(cookie), IDENTITY);
  f.provider.info = () => response({code: 0, data: {...USER, name: 'Updated Name', access_token: ACCESS, admin: true}});
  assert.deepEqual(await f.auth.authenticate(cookie), {...IDENTITY, name: 'Updated Name'});
  assert.equal(f.calls.filter(call => call.url === USERINFO).length, 3);
  f.provider.info = () => response({code: 99991663, msg: 'private-provider-detail', data: USER});
  await assert.rejects(f.auth.authenticate(cookie), status(401));
  assert.equal(f.auth.valid(cookie), false);
  const count = f.calls.length;
  await assert.rejects(f.auth.authenticate(cookie), status(401));
  assert.equal(f.calls.length, count);
});

test('different verified user, tenant, or unavailable provider invalidates cached session', async () => {
  for (const [reply, expected] of [
    [() => response({code: 0, data: {...USER, open_id: 'ou_Other'}}), 403],
    [() => response({code: 0, data: {...USER, tenant_key: 'other'}}), 403],
    [() => response({}, 503), 502]
  ]) {
    const f = fixture(), result = await f.login(), cookie = pair(result.sessionCookie);
    f.provider.info = reply;
    await assert.rejects(f.auth.authenticate(cookie), status(expected));
    assert.equal(f.auth.valid(cookie), false);
  }
});

test('expiry uses the shorter provider lifetime, caps at one hour, and never slides', async () => {
  const f = fixture();
  f.provider.token = () => response({access_token: ACCESS, expires_in: 20});
  const result = await f.login(), cookie = pair(result.sessionCookie);
  assert.equal(result.expiresAt, 1020000);
  assert.match(result.sessionCookie, /Max-Age=20/);
  f.advance(19000);
  assert.deepEqual(await f.auth.authenticate(cookie), IDENTITY);
  f.advance(1000);
  assert.equal(f.auth.valid(cookie), false);
  await assert.rejects(f.auth.authenticate(cookie), status(401));
  const capped = fixture(), cappedResult = await capped.login();
  capped.advance(3600000);
  assert.equal(capped.auth.valid(pair(cappedResult.sessionCookie)), false);
  const slow = fixture();
  slow.provider.token = () => { slow.advance(3000); return response({access_token: ACCESS, expires_in: 2}); };
  await assert.rejects(slow.login(), status(401));
});

test('logout is synchronous and idempotent; missing or duplicate session cookies are denied', async () => {
  const f = fixture(), first = await f.login(), second = await f.login(), cookie = pair(first.sessionCookie);
  for (const malformed of [undefined, {}, '', 'wallet_lark_session=bad', cookie + '; ' + cookie]) {
    assert.equal(f.auth.valid(malformed), false);
    await assert.rejects(f.auth.authenticate(malformed), status(401));
  }
  const result = f.auth.logout(cookie);
  assert.deepEqual(result, {sessionCookie: 'wallet_lark_session=; HttpOnly; SameSite=Strict; Path=/__wallet; Max-Age=0'});
  assert.equal(f.auth.valid(cookie), false);
  assert.equal(f.auth.valid(pair(second.sessionCookie)), true);
  assert.deepEqual(f.auth.logout(cookie), result);
  assert.equal(fixture().auth.valid(pair(second.sessionCookie)), false);
});

test('in-flight authentication cannot resurrect logged out, expired or concurrently revoked sessions', async () => {
  for (const action of ['logout', 'expire', 'revoke']) {
    const f = fixture(), result = await f.login(), cookie = pair(result.sessionCookie);
    let resolve;
    f.provider.info = () => new Promise(done => { resolve = done; });
    const pending = f.auth.authenticate(cookie);
    if (action === 'logout') f.auth.logout(cookie);
    if (action === 'expire') f.advance(3600000);
    if (action === 'revoke') {
      f.provider.info = () => response({}, 401);
      await assert.rejects(f.auth.authenticate(cookie), status(401));
    }
    resolve(response({code: 0, data: USER}));
    await assert.rejects(pending, status(401));
    assert.equal(f.auth.valid(cookie), false);
  }
});

test('HTTPS cookies and clearing preserve attributes, and callback origin cannot contain a path or injection', async () => {
  const f = fixture({origin: 'https://wallet.example.test'}), start = f.auth.begin();
  assert.equal(f.auth.config().callback, 'https://wallet.example.test/__wallet/oauth/callback');
  assert.match(start.stateCookie, /; Secure$/);
  assert.match((await f.login()).sessionCookie, /; Secure$/);
  assert.match(f.auth.logout('').sessionCookie, /Max-Age=0; Secure$/);
  assert.equal(f.auth.clearStateCookie(), 'wallet_lark_oauth=; HttpOnly; SameSite=Lax; Path=/__wallet/oauth; Max-Age=0; Secure');
  for (const origin of ['https://wallet.test/', 'https://wallet.test/path', 'https://wallet.test?x=1',
    'https://user:pass@wallet.test', 'file:///tmp', 'http://wallet.test\r\n', 'invalid']) {
    assert.throws(() => fixture({origin}), status(400));
  }
});

test('pending states are bounded at 1000 and expired slots are reclaimed', async () => {
  const f = fixture(), first = f.start();
  for (let i = 1; i < 1000; i++) f.auth.begin();
  assert.throws(() => f.auth.begin(), status(429));
  await f.auth.complete(first);
  f.auth.begin();
  assert.throws(() => f.auth.begin(), status(429));
  f.advance(600000);
  assert.ok(f.auth.begin().url);
});

test('sessions are bounded at 1000 including racing callbacks; logout frees capacity', async () => {
  const f = fixture(), first = await f.login();
  for (let i = 1; i < 999; i++) await f.login();
  const results = await Promise.allSettled([f.login(), f.login()]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 429);
  await assert.rejects(f.login(), status(429));
  f.auth.logout(pair(first.sessionCookie));
  assert.ok((await f.login()).sessionCookie);
  f.advance(3600000);
  assert.ok((await f.login()).sessionCookie);
});

test('provider timeout aborts the request and consumes state without leaking credentials', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture(), args = f.start();
  f.provider.token = () => new Promise(() => {});
  const pending = f.auth.complete(args);
  const rejected = assert.rejects(pending, status(504));
  t.mock.timers.tick(15000);
  await rejected;
  assert.equal(f.calls[0].signal.aborted, true);
  await assert.rejects(f.auth.complete(args), status(401));
});
