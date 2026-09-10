// OWNED_BY: ava. Synthetic regression tests; no network or production data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../ava-platform/apps/app.js'), 'utf8');
const start = source.indexOf('const PORTAL_ROLES =');
const end = source.indexOf('// INSTANT ROLE SWITCHER', start);
const authSource = source.slice(start, end);
function fixture(options = {}) {
  const storage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v), removeItem: k => m.delete(k) }; };
  const els = {
    username: { value: 'synthetic@example.invalid' }, password: { value: 'synthetic-password' },
    'login-corp-code': { value: options.code || '' }, 'login-error': { hidden: true, textContent: '' }
  };
  const btn = { disabled: false, textContent: 'Masuk' };
  let requests = 0;
  const c = {
    currentUserProfile: null, currentUserEmail: '', currentUsername: '', currentCorporateId: null,
    currentCorporateName: '', currentCorpRole: null, currentRole: '',
    localStorage: storage(), sessionStorage: storage(), SUPABASE_URL: 'https://auth.example.invalid', SUPABASE_RUNTIME_KEY: 'synthetic',
    document: { getElementById: id => els[id], querySelector: s => s.includes('button') ? btn : { value: options.role || 'patient' } },
    fetch: async () => { requests++; if (options.networkError) throw new TypeError('offline'); return { ok: !options.denied, json: async () => options.denied ? {} : { access_token: 'synthetic.jwt.token', user: { id: 'synthetic-user', email: els.username.value } } }; },
    sbGet: async () => options.noProfile ? [] : [{ id: 'synthetic-user', role: options.profileRole || 'patient', full_name: 'Synthetic User' }],
    sbRpc: async () => options.corpDenied ? { error: 'denied' } : { id: 'synthetic-company', nama: 'Synthetic Company', corp_role: 'requestor' },
    applyRoleUIState: async role => { c.appliedRole = role; }, switchTimelinePhase: () => {},
    showScreen: screen => { c.screen = screen; }, TypeError
  };
  vm.createContext(c); vm.runInContext(authSource, c);
  return { c, els, btn, requests: () => requests, login: () => c.handleLogin({ preventDefault() {} }) };
}
test('invalid password fails closed and clears stale credentials', async () => {
  const f = fixture({ denied: true }); f.c.localStorage.setItem('ol_token', 'mock_token_patient');
  await f.login(); assert.equal(f.c.screen, 'login-screen'); assert.equal(f.c.localStorage.getItem('ol_token'), null);
  assert.equal(f.c.sessionStorage.getItem('AVA_IS_LOGGED_IN'), null); assert.equal(f.btn.disabled, false); assert.equal(f.els['login-error'].hidden, false);
});
test('network failure never creates mock login', async () => {
  const f = fixture({ networkError: true }); await f.login(); assert.equal(f.c.screen, 'login-screen'); assert.equal(f.c.localStorage.getItem('ol_token'), null);
});
test('verified patient enters patient portal', async () => {
  const f = fixture(); await f.login(); assert.equal(f.c.screen, 'dashboard-screen'); assert.equal(f.c.appliedRole, 'patient'); assert.equal(f.els.password.value, '');
});
test('patient cannot select staff privileges', async () => {
  const f = fixture({ role: 'staff' }); await f.login(); assert.equal(f.c.screen, 'login-screen'); assert.equal(f.c.appliedRole, undefined); assert.equal(f.c.localStorage.getItem('ol_token'), null);
});
test('missing profile fails closed', async () => {
  const f = fixture({ noProfile: true }); await f.login(); assert.equal(f.c.screen, 'login-screen'); assert.equal(f.c.localStorage.getItem('ol_token'), null);
});
test('corporate requires code before any request', async () => {
  const f = fixture({ role: 'corporate', profileRole: 'corporate' }); await f.login(); assert.equal(f.requests(), 0);
});
test('corporate server denial prevents dashboard access', async () => {
  const f = fixture({ role: 'corporate', profileRole: 'corporate', code: 'SYNTHETIC', corpDenied: true }); await f.login(); assert.equal(f.c.screen, 'login-screen'); assert.equal(f.c.currentCorporateId, null);
});
test('corporate access derives from server verification', async () => {
  const f = fixture({ role: 'corporate', profileRole: 'corporate', code: 'SYNTHETIC' }); await f.login(); assert.equal(f.c.screen, 'dashboard-screen'); assert.equal(f.c.currentCorporateId, 'synthetic-company'); assert.equal(f.c.currentCorpRole, 'requestor');
});
test('old demo email has no password bypass', async () => {
  const f = fixture({ denied: true }); f.els.username.value = 'admin@avahealth.sbs'; f.els.password.value = '12345678'; await f.login(); assert.equal(f.requests(), 1); assert.equal(f.c.screen, 'login-screen');
});
test('unavailable financial and clinical actions do not mutate data', () => {
  for (const name of ['processInvoicePayment', 'processWithdrawFee', 'simulateBiosensorPulse', 'simulateAgeReversal', 'syncWearableData', 'toggleAmbientScribeRecording', 'generateLaasApiKey']) {
    const body = source.match(new RegExp('^function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?^\\}', 'm'))?.[0];
    assert.ok(body, name);
    const notices = [];
    const c = { alert: text => notices.push(text) };
    vm.createContext(c); vm.runInContext(body, c);
    let prevented = false;
    c[name]({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true); assert.equal(notices.length, 1);
    // No DOM, storage, network, or account balances are supplied: accessing them fails.
  }
});
test('role switch ignores escalation from a patient account', async () => {
  const f = fixture();
  await f.login();
  const switcher = source.match(/^async function switchActiveRole\([^)]*\) \{[\s\S]*?^\}/m)[0];
  vm.runInContext(switcher, f.c);
  await f.c.switchActiveRole('tech');
  assert.equal(f.c.currentRole, 'patient');
  assert.equal(f.c.localStorage.getItem('AVA_CURRENT_USER_ROLE'), 'patient');
});
test('page load refuses stored flags and removes URL credentials', () => {
  const f = fixture();
  let initialize;
  f.c.document.addEventListener = (_, fn) => { initialize = fn; };
  f.c.URL = URL;
  f.c.window = { location: { href: 'https://portal.example.invalid/apps/?access_token=synthetic&refresh=synthetic#corp' }, history: { replaceState: (_, __, url) => { f.c.cleanedUrl = url; } } };
  f.c.updateLoginFormUI = () => {};
  f.c.localStorage.setItem('ol_token', 'mock_token_patient');
  f.c.sessionStorage.setItem('AVA_IS_LOGGED_IN', 'true');
  const init = source.slice(source.indexOf('// Page load initialization'), source.indexOf('// UNIFIED B2C SUPER-APP CART'));
  vm.runInContext(init, f.c); initialize();
  assert.equal(f.c.screen, 'login-screen');
  assert.equal(f.c.localStorage.getItem('ol_token'), null);
  assert.equal(f.c.cleanedUrl, '/apps/#corp');
});
