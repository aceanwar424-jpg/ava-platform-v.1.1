// OWNED_BY: ava. Synthetic regression tests; no production account or service.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('ava-platform/js/auth.js', 'utf8');

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

function fixture({ profile = [{ id: 'staff-id', role: 'staff' }], token = 'old.token.value' } = {}) {
  const sessionStorage = storage({ ol_token: token, ol_refresh: 'refresh.synthetic' });
  const nodes = {
    'login-email': { value: 'synthetic@example.invalid' },
    'login-pass': { value: 'synthetic-password' },
    'btn-login': { textContent: 'Masuk', disabled: false },
    'login-err': { style: {}, textContent: '' },
  };
  const document = {
    body: { innerHTML: '' },
    getElementById: id => nodes[id],
  };
  const location = { reload: () => { throw new Error('unexpected reload'); } };
  const context = {
    window: {}, document, location, sessionStorage,
    SUPABASE_URL: 'https://auth.example.invalid', SUPABASE_RUNTIME_KEY: 'synthetic',
    SB_HEADERS: { apikey: 'synthetic' },
    sbGetStrict: async () => profile,
    sbGet: async () => profile,
    fetch: async url => ({
      ok: true,
      json: async () => String(url).includes('/auth/v1/user')
        ? { id: 'staff-id' }
        : { access_token: 'new.token.value', refresh_token: 'new.refresh.value', user: { id: 'staff-id' } },
    }),
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, sessionStorage, nodes, document };
}

test('missing profile after a valid login keeps the Auth session and shows a clear failure', async () => {
  const f = fixture({ profile: [] });
  await f.context.doLogin();
  assert.equal(f.sessionStorage.getItem('ol_token'), 'new.token.value');
  assert.match(f.nodes['login-err'].textContent, /Profil akses akun ini belum tersedia/);
  assert.equal(f.nodes['btn-login'].disabled, false);
});

test('valid Auth session with a blocked profile opens access explanation instead of a login loop', async () => {
  const f = fixture({ profile: [] });
  await f.context.initAuth();
  assert.equal(f.sessionStorage.getItem('ol_token'), 'old.token.value');
  assert.match(f.document.body.innerHTML, /AKSES PERLU DIVERIFIKASI/);
  assert.doesNotMatch(f.document.body.innerHTML, /Email Akun/);
});

test('root boot includes refresh recovery and does not clear an otherwise valid profile failure', () => {
  const html = fs.readFileSync('ava-platform/index.html', 'utf8');
  assert.match(html, /typeof sbRefreshSession === 'function'/);
  assert.match(html, /profileLoader\('user_profiles'/);
  assert.doesNotMatch(html, /catch\(e\) \{ clearStoredToken\(\); window\.currentUser = null; showLoginScreen\(\); return; \}/);
});
