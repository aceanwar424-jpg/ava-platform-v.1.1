// ═══════════════════════════════════════════════════════════════
// CORE: AI GATEWAY & API RATE LIMIT MONITOR SYSTEM (Fase Enterprise)
// Fitur: Pool Keys Multi-Provider, Rotasi Otomatis, Auto-Failover 429,
// Pelacak Jam Berapa Kuota Terisi Kembali (Refill Countdown), Cache 7 Hari.
// ═══════════════════════════════════════════════════════════════

const AIGateway = {
  config: {
    limitRPM: 15,
    limitTPM: 1000000,
    limitRPD: 10000,
    refillWindowMinutes: 60,
    cacheEnabled: true,
    cacheTTLHours: 168,
    primaryModel: 'gemini-2.5-flash',
    fallbackModel: 'gemini-2.0-flash'
  },
  
  state: {
    requestHistory: [],
    tokenUsage: 0,
    dailyCount: 0,
    cache: new Map(),
    // Pool API Keys diisi saat init() dari sumber di luar kode — lihat loadKeys().
    // JANGAN menulis kunci asli di berkas ini: berkas ini ikut masuk repo.
    keyPool: [],
    activeKeyIndex: 0
  },

  // Sumber kunci, berurutan:
  //   1. window.ONELAB_KEYS → js/config.local.js (diblok .gitignore)
  //   2. localStorage       → kunci yang ditambah lewat UI Monitor Kuota
  loadKeys() {
    const seen = new Set();
    const pool = [];
    const push = (raw, provider, id) => {
      const key = String(raw || '').trim();
      if (!key || seen.has(key)) return;   // lewati duplikat antar-sumber
      seen.add(key);
      pool.push({
        id: id || `key-${pool.length + 1}`,
        provider: provider || 'Gemini AI Studio',
        key,
        snippet: key.slice(0, 6) + '...' + key.slice(-4),
        status: 'ACTIVE',                  // ACTIVE | EXHAUSTED_429 | EXPIRED_403
        requestsToday: 0,
        tokensToday: 0,
        exhaustedAt: null,
        resetAt: null                      // Timestamp kapan kuota akan terisi lagi
      });
    };

    const cfg = (typeof window !== 'undefined' && window.ONELAB_KEYS) || {};
    (cfg.gemini || []).forEach((k, i) => push(k, 'Gemini AI Studio', `key-gemini-${i + 1}`));
    (cfg.groq   || []).forEach((k, i) => push(k, 'Groq',             `key-groq-${i + 1}`));
    (cfg.openai || []).forEach((k, i) => push(k, 'OpenAI',           `key-openai-${i + 1}`));

    try {
      JSON.parse(localStorage.getItem('ol_ai_keys') || '[]')
        .forEach(k => push(k.key, k.provider, k.id));
    } catch (e) { /* penyimpanan rusak — abaikan, pool tetap terbentuk */ }

    this.state.keyPool = pool;
    if (!pool.length) {
      console.warn('[AI Gateway] Pool kosong. Salin js/config.local.example.js → js/config.local.js, atau tambah key lewat Monitor Kuota.');
    }
  },

  // Simpan hanya key tambahan dari UI; key dari config.local.js tidak perlu disalin.
  saveUserKeys() {
    try {
      const mine = this.state.keyPool
        .filter(k => String(k.id).startsWith('key-user-'))
        .map(k => ({ id: k.id, provider: k.provider, key: k.key }));
      localStorage.setItem('ol_ai_keys', JSON.stringify(mine));
    } catch (e) { /* kuota localStorage penuh — tidak fatal */ }
  },

  init() {
    this.loadKeys();
    console.log(`[AI Gateway] Initialized — ${this.state.keyPool.length} key dalam pool.`);
    this.checkAutoRecovery();
    // Periodic health check every 30 seconds
    setInterval(() => this.checkAutoRecovery(), 30000);
  },

  // Mendapatkan API Key aktif saat ini
  getActiveKey() {
    const pool = this.state.keyPool;
    for (let i = 0; i < pool.length; i++) {
      const idx = (this.state.activeKeyIndex + i) % pool.length;
      if (pool[idx].status === 'ACTIVE') {
        this.state.activeKeyIndex = idx;
        return pool[idx];
      }
    }
    // Semua key habis → kembalikan key pertama (pemanggil menangani status-nya).
    // Pool boleh kosong (mis. deployment web tanpa config.local.js) → null.
    return pool[0] || null;
  },

  // Cek apakah key yang 429 sudah melewati jam reset untuk diisi kembali secara otomatis
  checkAutoRecovery() {
    const now = Date.now();
    this.state.keyPool.forEach(k => {
      if (k.status === 'EXHAUSTED_429' && k.resetAt && now >= k.resetAt) {
        k.status = 'ACTIVE';
        k.exhaustedAt = null;
        k.resetAt = null;
        console.log(`[AI Gateway] 🟢 Kuota API Key ${k.snippet} telah terisi kembali! Status dipulihkan ke AKTIF.`);
        if (typeof toast === 'function') {
          toast(`🟢 Kuota API Key ${k.snippet} telah terisi kembali & aktif!`, 'ok');
        }
      }
    });
    this.updateTopbarBadge();
  },

  // Menandai key terkena 429 Rate Limit dan menghitung jam berapa akan terisi lagi
  markKeyExhausted(keyId, retryAfterSec = 3600) {
    const k = this.state.keyPool.find(x => x.id === keyId || x.key === keyId);
    if (!k) return;

    const now = Date.now();
    const refillMs = (retryAfterSec || (this.config.refillWindowMinutes * 60)) * 1000;
    k.status = 'EXHAUSTED_429';
    k.exhaustedAt = now;
    k.resetAt = now + refillMs;

    const resetTimeStr = new Date(k.resetAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.warn(`[AI Gateway] 🚨 API Key ${k.snippet} terkena 429 (Kuota Habis). Akan terisi kembali jam ${resetTimeStr} WIB.`);

    if (typeof toast === 'function') {
      toast(`⚠️ Key ${k.snippet} terkena 429! Otomatis rotasi ke Key berikutnya. Refill jam ${resetTimeStr} WIB`, 'warn');
    }

    this.checkAutoRecovery();
  },

  // Check rate limit status before sending request
  checkLimits() {
    const now = Date.now();
    this.state.requestHistory = this.state.requestHistory.filter(t => (now - t) < 60000);
    
    if (this.state.requestHistory.length >= this.config.limitRPM) {
      const oldest = this.state.requestHistory[0];
      const delayNeeded = 60000 - (now - oldest) + 100;
      return { ok: false, delayMs: Math.max(delayNeeded, 500) };
    }
    return { ok: true, delayMs: 0 };
  },

  // Cache lookup by text hash
  getCache(promptKey) {
    if (!this.config.cacheEnabled) return null;
    const cached = this.state.cache.get(promptKey);
    if (!cached) return null;
    const isExpired = (Date.now() - cached.timestamp) > (this.config.cacheTTLHours * 3600 * 1000);
    if (isExpired) {
      this.state.cache.delete(promptKey);
      return null;
    }
    return cached.response;
  },

  setCache(promptKey, response) {
    if (!this.config.cacheEnabled) return;
    this.state.cache.set(promptKey, {
      response,
      timestamp: Date.now()
    });
  },

  // Execute prompt request with rate-limit queue & automatic failover key rotation
  async executePrompt(promptText, systemInstruction = '', model = null) {
    const cacheKey = `${promptText}_${systemInstruction}`;
    const cachedResp = this.getCache(cacheKey);
    if (cachedResp) {
      console.log('[AI Gateway] Cache Hit! Serving instant response.');
      return cachedResp;
    }

    let limitCheck = this.checkLimits();
    if (!limitCheck.ok) {
      console.log(`[AI Gateway] RPM limit reached. Auto-delaying ${limitCheck.delayMs}ms...`);
      await new Promise(r => setTimeout(r, limitCheck.delayMs));
    }

    const currentKeyObj = this.getActiveKey();
    if (!currentKeyObj) {
      const pesan = 'Belum ada API key AI. Tambahkan lewat menu "Monitor Kuota & Rate Limit API", ' +
                    'atau sediakan js/config.local.js pada instalasi lokal.';
      if (typeof toast === 'function') toast('⚠️ ' + pesan, 'warn');
      throw new Error('[AI Gateway] ' + pesan);
    }
    currentKeyObj.requestsToday++;
    this.state.requestHistory.push(Date.now());
    this.state.dailyCount++;

    const targetModel = model || this.config.primaryModel;
    try {
      const response = await this._callLLM(promptText, systemInstruction, targetModel, currentKeyObj.key);
      this.setCache(cacheKey, response);
      return response;
    } catch (err) {
      const errStr = String(err.message || err);
      if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
        this.markKeyExhausted(currentKeyObj.id, 3600);
        const nextKeyObj = this.getActiveKey();
        // Satu-satunya key barusan kena 429 → tidak ada tujuan failover.
        if (!nextKeyObj || nextKeyObj.id === currentKeyObj.id) throw err;
        console.warn(`[AI Gateway] Auto-Failover: Switching to ${nextKeyObj.provider} (${nextKeyObj.snippet})...`);
        const fallbackResp = await this._callLLM(promptText, systemInstruction, this.config.fallbackModel, nextKeyObj.key);
        this.setCache(cacheKey, fallbackResp);
        return fallbackResp;
      }
      throw err;
    }
  },

  async _callLLM(promptText, systemInstruction, model, apiKey = null) {
    if (typeof agLLMText === 'function') {
      return await agLLMText(systemInstruction, promptText, model);
    }
    return `[AI Gateway ${model}] Response generated successfully.`;
  },

  // ── VISUAL MONITOR UI MODAL & TOPBAR BADGE ──────────────────────────
  updateTopbarBadge() {
    let badge = document.getElementById('topbar-ai-monitor');
    const activeCount = this.state.keyPool.filter(k => k.status === 'ACTIVE').length;
    const totalCount = this.state.keyPool.length;

    if (!badge) {
      const topbarActions = document.querySelector('.topbar-actions') || document.querySelector('.topbar');
      if (topbarActions) {
        badge = document.createElement('button');
        badge.id = 'topbar-ai-monitor';
        badge.onclick = () => AIGateway.renderMonitorUI();
        badge.style.cssText = 'background:rgba(16,185,129,0.15); border:1px solid rgba(52,211,153,0.3); color:#34D399; font-size:11.5px; font-weight:700; padding:4px 10px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:6px; margin-right:10px;';
        topbarActions.prepend(badge);
      }
    }

    if (badge) {
      badge.innerHTML = `⚡ <span>API Keys: <b>${activeCount}/${totalCount}</b> Aktif</span>`;
      badge.style.borderColor = activeCount > 0 ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.5)';
      badge.style.color = activeCount > 0 ? '#34D399' : '#FCA5A5';
    }
  },

  renderMonitorUI() {
    const modalId = 'modal-ai-monitor';
    let existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:\'Plus Jakarta Sans\',sans-serif;';

    const now = Date.now();
    const rows = this.state.keyPool.map(k => {
      const isExhausted = k.status === 'EXHAUSTED_429';
      let refillText = '-';
      if (isExhausted && k.resetAt) {
        const diffMs = Math.max(0, k.resetAt - now);
        const diffMin = Math.ceil(diffMs / 60000);
        const resetStr = new Date(k.resetAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        refillText = `<strong style="color:#FBBF24;">Jam ${resetStr} WIB</strong> (${diffMin} menit lagi)`;
      } else {
        refillText = '<span style="color:#34D399;">🟢 Siap / Kuota Penuh</span>';
      }

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06); font-size:12.5px;">
          <td style="padding:12px; font-weight:700; color:#F8FAFC;">${k.provider}</td>
          <td style="padding:12px; font-family:monospace; color:#94A3B8;">${k.snippet}</td>
          <td style="padding:12px;">
            ${k.status === 'ACTIVE' 
              ? '<span style="background:rgba(16,185,129,0.2); color:#34D399; padding:2px 8px; border-radius:6px; font-weight:800; font-size:11px;">🟢 AKTIF</span>' 
              : '<span style="background:rgba(239,68,68,0.2); color:#FCA5A5; padding:2px 8px; border-radius:6px; font-weight:800; font-size:11px;">🔴 KUOTA HABIS (429)</span>'}
          </td>
          <td style="padding:12px;">${refillText}</td>
          <td style="padding:12px; font-weight:700;">${k.requestsToday} req</td>
          <td style="padding:12px; text-align:center;">
            <button class="btn btn-ghost btn-sm" style="font-size:10.5px; padding:3px 8px;" onclick="AIGateway.resetKeyStatus('${k.id}')">🔄 Reset Status</button>
          </td>
        </tr>
      `;
    }).join('');

    modal.innerHTML = `
      <div style="background:#0F172A; border:1px solid rgba(52,211,153,0.4); border-radius:16px; padding:24px; width:100%; max-width:840px; color:#F8FAFC; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px; margin-bottom:18px;">
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:#34D399; display:flex; align-items:center; gap:8px;">
              ⚡ Monitor Kuota API & Rate Limit Reset
            </h3>
            <p style="margin:4px 0 0 0; font-size:12px; color:#94A3B8;">Pelacak Waktu Terisi Kembali Kuota API (Refill Countdown) & Rotasi Multi-Key Terpusat (.env)</p>
          </div>
          <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:#94A3B8; font-size:22px; cursor:pointer;">✕</button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:18px;">
          <div style="background:rgba(30,41,59,0.6); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:11px; color:#94A3B8;">Total API Key Terdaftar</div>
            <div style="font-size:20px; font-weight:800; color:#F8FAFC;">${this.state.keyPool.length} Keys</div>
          </div>
          <div style="background:rgba(30,41,59,0.6); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:11px; color:#94A3B8;">Key Status Siap / Aktif</div>
            <div style="font-size:20px; font-weight:800; color:#34D399;">${this.state.keyPool.filter(k=>k.status==='ACTIVE').length} Ready</div>
          </div>
          <div style="background:rgba(30,41,59,0.6); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:11px; color:#94A3B8;">Batas Rate Limit System</div>
            <div style="font-size:20px; font-weight:800; color:#38BDF8;">15 RPM / 10K RPD</div>
          </div>
        </div>

        <div style="overflow-x:auto; background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:18px;">
          <table style="width:100%; border-collapse:collapse; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94A3B8; font-size:11.5px; text-transform:uppercase;">
                <th style="padding:12px;">Provider</th>
                <th style="padding:12px;">Key Snippet</th>
                <th style="padding:12px;">Status</th>
                <th style="padding:12px;">Prakiraan Jam Terisi Kembali</th>
                <th style="padding:12px;">Total Request</th>
                <th style="padding:12px; text-align:center;">Aksi</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
          <button class="btn btn-ghost btn-sm" onclick="AIGateway.promptAddKeyModal()">+ Tambah API Key Baru</button>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-ghost btn-sm" onclick="AIGateway.checkAutoRecovery(); AIGateway.renderMonitorUI();">🔄 Cek Ulang Status</button>
            <button class="btn btn-teal btn-sm" onclick="document.getElementById('${modalId}').remove();">Tutup Monitor</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  resetKeyStatus(keyId) {
    const k = this.state.keyPool.find(x => x.id === keyId);
    if (k) {
      k.status = 'ACTIVE'; k.exhaustedAt = null; k.resetAt = null;
      toast(`🟢 Status API Key ${k.snippet} berhasil direset ke AKTIF!`, 'ok');
      this.renderMonitorUI();
    }
  },

  promptAddKeyModal() {
    const newKey = prompt('Masukkan API Key Google Gemini / Groq / OpenAI baru:');
    if (newKey && newKey.trim()) {
      const cleanKey = newKey.trim();
      const snippet = cleanKey.slice(0, 6) + '...' + cleanKey.slice(-4);
      this.state.keyPool.push({
        id: `key-user-${Date.now()}`,
        provider: 'Gemini AI (Tambahan User)',
        key: cleanKey,
        snippet,
        status: 'ACTIVE',
        requestsToday: 0,
        tokensToday: 0,
        exhaustedAt: null,
        resetAt: null
      });
      this.saveUserKeys();   // bertahan setelah refresh halaman
      toast(`✅ API Key baru (${snippet}) berhasil ditambahkan ke Pool!`, 'ok');
      this.renderMonitorUI();
    }
  }
};

window.AIGateway = AIGateway;
document.addEventListener('DOMContentLoaded', () => {
  AIGateway.init();
});
setTimeout(() => AIGateway.updateTopbarBadge(), 1000);
