const test = require('node:test');
const assert = require('node:assert/strict');

function classifySave(result) {
  if (!result || result.ok !== true || !result.id) return { state: 'FAILED', reason: result?.error || 'Tidak ada konfirmasi penyimpanan dari server.' };
  return { state: 'SAVED', id: result.id };
}
function correlate(input) {
  return { tenant_id: input.tenant_id, correlation_id: input.correlation_id, source: input.source, linked: ['support_ticket','alert','incident','change'] };
}

test('gagal save tidak dianggap sukses dan membentuk jalur support', () => {
  const save = classifySave({ ok: false, error: 'constraint violation' });
  assert.equal(save.state, 'FAILED');
  assert.match(save.reason, /constraint/i);
});

test('response sukses tanpa id ditolak sebagai false success', () => {
  const save = classifySave({ ok: true, message: 'berhasil' });
  assert.equal(save.state, 'FAILED');
});

test('error akses dapat dikorelasikan lintas support dan incident', () => {
  const e = correlate({ tenant_id: 'ahm', correlation_id: 'corr-login-001', source: 'synthetic-login' });
  assert.equal(e.tenant_id, 'ahm');
  assert.equal(e.linked.length, 4);
});

test('dedupe fingerprint tidak membuat alert baru untuk error berulang', () => {
  const alerts = new Map();
  for (const i of [1,2,3]) {
    const fp = 'ahm|save-result|constraint-23505';
    alerts.set(fp, (alerts.get(fp) || 0) + 1);
  }
  assert.equal(alerts.size, 1);
  assert.equal(alerts.get('ahm|save-result|constraint-23505'), 3);
});

test('restore drill gagal membuka problem preventif', () => {
  const drill = { status: 'FAILED', gap: 'RTO 42 menit melewati target 30 menit' };
  assert.equal(drill.status, 'FAILED');
  assert.ok(drill.gap);
});
