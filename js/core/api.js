// ═══════════════════════════════════════════
// CORE: Supabase API helpers
// ═══════════════════════════════════════════
const SUPABASE_URL = 'https://rmyqzyfvlmjxtatpctks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXF6eWZ2bG1qeHRhdHBjdGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDQzNzIsImV4cCI6MjA5NjgyMDM3Mn0.tBVQBNH-yi9bmcpY7MRf5w-diwonMTDqwfAOs3t7YK8';

const SB_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function sbGet(table, query='') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: SB_HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.hint || JSON.stringify(data));
  return data;
}
async function sbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method:'POST', headers: SB_HEADERS, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.hint || JSON.stringify(data));
  return data;
}
async function sbPatch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method:'PATCH', headers: SB_HEADERS, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}
async function sbDelete(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method:'DELETE', headers: { ...SB_HEADERS, 'Prefer':'return=minimal' } });
  return res.ok;
}
async function sbCount(table, query='') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}&select=count`, {
    headers: { ...SB_HEADERS, 'Prefer':'count=exact' }
  });
  const count = res.headers.get('content-range')?.split('/')[1];
  return parseInt(count)||0;
}
async function logActivity(action, tableName, recordId, description, name='') {
  try {
    await sbPost('activity_logs', {
      action, table_name: tableName, record_id: String(recordId),
      description, record_name: name, created_at: new Date().toISOString(),
      user_name: window.currentUser?.profile?.full_name || ''
    });
  } catch(e) {}
}
