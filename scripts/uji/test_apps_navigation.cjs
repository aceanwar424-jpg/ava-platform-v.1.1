// OWNED_BY: ava. Read-only structure checks and synthetic role contracts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../ava-platform/apps');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'navigation.js'), 'utf8');
function navigation(role = 'patient', corpRole = 'requestor') {
  const context = { currentUserProfile: { role }, currentCorpRole: corpRole };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.pages = APPS_PAGES; this.groups = APPS_MENU_GROUPS;', context);
  return context;
}
test('every registered page has exactly one HTML target', () => {
  const { pages } = navigation();
  for (const id of Object.keys(pages)) {
    assert.equal([...html.matchAll(new RegExp('id="' + id + '"', 'g'))].length, 1, id);
  }
});
test('view panels are not hidden inside another view panel', () => {
  const markup = html.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>/gi, '');
  const stack = [];
  for (const match of markup.matchAll(/<\/?div\b[^>]*>/gi)) {
    const tag = match[0];
    if (tag.startsWith('</')) { stack.pop(); continue; }
    const isView = /class="[^"]*\bview-panel\b/.test(tag);
    const id = tag.match(/id="([^"]+)"/)?.[1];
    if (isView) assert.equal(stack.some(entry => entry.isView), false, 'Nested page: ' + id);
    stack.push({ isView, id });
  }
});
test('each role has distinct valid menu targets and readable labels', () => {
  const context = navigation();
  for (const [role, groups] of Object.entries(context.groups)) {
    const ids = groups.flatMap(([, list]) => list);
    assert.equal(new Set(ids).size, ids.length, role);
    for (const id of ids) {
      assert.ok(context.pages[id], role + ': ' + id);
      assert.ok(context.pages[id][0].length > 3);
    }
  }
});
test('corporate menu respects maker and approver roles', () => {
  const ids = context => context.appsMenuItems('corporate').flatMap(([, pages]) => pages);
  const maker = ids(navigation('corporate', 'requestor'));
  const approver = ids(navigation('corporate', 'approver'));
  const unknown = ids(navigation('corporate', null));
  assert.ok(maker.includes('book-examination-view'));
  assert.ok(!maker.includes('examination-approval-view'));
  assert.ok(approver.includes('examination-approval-view'));
  assert.ok(!approver.includes('book-examination-view'));
  assert.ok(!unknown.includes('book-examination-view') && !unknown.includes('examination-approval-view'));
});
test('new menu assets remain local to the patient portal', () => {
  for (const filename of ['navigation.js', 'login.css', 'app.js', 'style.css']) {
    assert.ok(fs.existsSync(path.join(root, filename)));
    assert.ok(html.includes(filename));
  }
  assert.ok(html.indexOf('src="navigation.js') < html.indexOf('src="app.js'));
  assert.ok(!html.includes('serve_apps_ui'));
});
test('profile text is escaped instead of interpreted as markup', () => {
  const c = navigation();
  assert.equal(c.appsEscape('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});
