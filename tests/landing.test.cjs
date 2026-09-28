const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'js/auth.js'), 'utf8');

function gateHarness() {
  const document = {activeElement: null, addEventListener() {}};
  function element(id) {
    const classes = new Set(), attrs = {}, listeners = {};
    return {id, style: {}, inert: false, isConnected: true, visible: true, disabled: false, hidden: false,
      classList: {add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value),
        toggle(value, on) { if(on) classes.add(value); else classes.delete(value); }},
      setAttribute: (key, value) => { attrs[key] = value; }, getAttribute: key => attrs[key],
      removeAttribute: key => { delete attrs[key]; },
      addEventListener: (type, callback) => { listeners[type] = callback; }, listeners,
      getClientRects() { return this.visible ? [{}] : []; }, focus() { document.activeElement = this; }};
  }
  const ids = ['authGate','g_email','g_pass','g_pass2','g_name','ag_tab_login','ag_tab_reg','ag_submit','ag_msg','g_reg_extra'];
  const nodes = Object.fromEntries(ids.map(id => [id, element(id)]));
  const landing = element('landing'), close = element('close'), hint = element('hint'), toggle = element('toggle'), opener = element('opener');
  const box = element('box');
  box.querySelectorAll = () => [close, nodes.g_email, nodes.g_pass, nodes.ag_submit, hint];
  nodes.authGate.querySelector = selector => ({'.landing-page': landing, '.auth-box': box, '.landing-menu-toggle': toggle}[selector]);
  document.getElementById = id => nodes[id] || null;
  document.activeElement = opener;
  const timers = [], Auth = {googleStatus() {}, renderGoogleButton() {}};
  const context = vm.createContext({document, Auth, setTimeout: fn => { timers.push(fn); }});
  vm.runInContext(auth.slice(auth.indexOf('Auth.gateEl = null;'), auth.indexOf('Auth.gateSubmit = async')), context);
  const wireStart = auth.indexOf('(function wireGate()');
  vm.runInContext(auth.slice(wireStart, auth.indexOf('})();', wireStart) + 5), context);
  return {Auth, document, nodes, landing, box, close, hint, opener, toggle, flush: () => { while(timers.length) timers.shift()(); }};
}

test('landing keeps existing branding and real product proof without fictional plans', () => {
  const page = html.slice(html.indexOf('class="landing-page"'), html.indexOf('<div class="auth-box"'));
  assert.match(page, /src="logo.jpg"/);
  assert.match(page, /images\/landing-app.webp/);
  assert.match(page, /ข้อมูลตัวอย่าง/);
  assert.match(page, /id="trials"/);
  assert.doesNotMatch(page, /price-card|landing-pricing|lp-window|24\/7|เริ่มใช้ฟรี/);
  for (const match of page.matchAll(/(?:src|srcset)="((?:images\/|logo\.jpg)[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
  }
});

test('authentication fields and dialogs have accessible labels and live status', () => {
  for (const id of ['g_email','g_pass','g_pass2','g_name']) assert.match(html, new RegExp('<label for="' + id + '">'));
  assert.match(html, /class="auth-box" role="dialog" aria-modal="true" aria-labelledby="ag_dialog_title"/);
  assert.match(html, /id="ag_msg"[^>]*aria-live="polite"/);
  for (const id of ['privacy','terms','product-preview']) assert.match(html, new RegExp('<dialog id="' + id + '"'));
});

test('opening and closing authentication restores focus and background interaction', () => {
  const h = gateHarness();
  h.Auth.openGateForm('register'); h.flush();
  assert.equal(h.landing.inert, true);
  assert.equal(h.landing.getAttribute('aria-hidden'), 'true');
  assert.equal(h.document.activeElement, h.nodes.g_email);
  assert.equal(h.nodes.authGate.classList.contains('show-auth'), true);
  h.Auth.closeGateForm();
  assert.equal(h.landing.inert, false);
  assert.equal(h.landing.getAttribute('aria-hidden'), undefined);
  assert.equal(h.document.activeElement, h.opener);
  assert.equal(h.nodes.authGate.classList.contains('show-auth'), false);
});

test('a delayed focus callback cannot steal focus after the dialog closes', () => {
  const h = gateHarness(); h.Auth.openGateForm('login'); h.Auth.closeGateForm(); h.flush();
  assert.equal(h.document.activeElement, h.opener);
});

test('registration mode updates pressed state and password manager semantics', () => {
  const h = gateHarness(); h.Auth.gateMode('register');
  assert.equal(h.nodes.ag_tab_reg.getAttribute('aria-pressed'), 'true');
  assert.equal(h.nodes.ag_tab_login.getAttribute('aria-pressed'), 'false');
  assert.equal(h.nodes.g_pass.getAttribute('autocomplete'), 'new-password');
  assert.equal(h.nodes.g_reg_extra.style.display, '');
  h.Auth.gateMode('login');
  assert.equal(h.nodes.g_pass.getAttribute('autocomplete'), 'current-password');
  assert.equal(h.nodes.g_reg_extra.style.display, 'none');
});

test('Escape closes authentication and Tab stays within visible form controls', () => {
  const h = gateHarness(); h.Auth.openGateForm('login'); h.flush();
  const key = (key, shiftKey = false) => {
    let prevented = false;
    h.nodes.authGate.listeners.keydown({key, shiftKey, preventDefault() { prevented = true; }});
    return prevented;
  };
  h.close.focus(); assert.equal(key('Tab', true), true); assert.equal(h.document.activeElement, h.hint);
  assert.equal(key('Tab'), true); assert.equal(h.document.activeElement, h.close);
  assert.equal(key('Escape'), true); assert.equal(h.document.activeElement, h.opener);
  assert.equal(h.landing.inert, false);
});

test('closing a form opened in a collapsed mobile menu focuses the menu toggle', () => {
  const h = gateHarness(); h.Auth.openGateForm('login'); h.opener.visible = false;
  h.Auth.closeGateForm(); assert.equal(h.document.activeElement, h.toggle);
});

test('successful authentication hides the gate without leaving landing content inert', () => {
  const h = gateHarness(); h.Auth.openGateForm('login'); h.Auth.hideGate(); h.flush();
  assert.equal(h.nodes.authGate.style.display, 'none');
  assert.equal(h.landing.inert, false);
  assert.equal(h.Auth._gateReturnFocus, null);
});

test('public policy deep links stay available to users with an existing session', () => {
  const source = auth.slice(auth.indexOf('function landingPreviewFromUrl()'), auth.indexOf('/* โหลดเซสชัน'));
  for(const [url, expected] of [['https://example.invalid/#privacy', true], ['https://example.invalid/#terms', true], ['https://example.invalid/?landing=1', true], ['https://example.invalid/', false]]) {
    const ctx = vm.createContext({URL, location: {href:url}});
    vm.runInContext(source, ctx);
    assert.equal(vm.runInContext('landingPreviewFromUrl()', ctx), expected);
  }
});
