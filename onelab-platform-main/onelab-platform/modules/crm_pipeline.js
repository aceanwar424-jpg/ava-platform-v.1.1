// ═══════════════════════════════════════════════════════════════
// MODULE: CRM Pipeline & Pendapatan
//
// Masalah yang dipecahkan: CRM sudah punya partner, leads, deal, MOU, dan
// voucher — tetapi corong penjualannya TERPUTUS dari pendapatan nyata. Tidak
// ada yang bisa menjawab: dari sekian banyak leads, berapa yang benar-benar
// menjadi uang masuk?
//
// Aturan yang dipegang: angka "nyata" HANYA berasal dari faktur yang benar-benar
// terbit, bukan dari estimated_value yang diketik sales. Keduanya dibedakan
// jelas di layar — itu inti nilai modul ini.
//
// Rantai penelusurannya: leads → partners → corporates → admissions/invoices.
// Pasien korporat menempel lewat admissions.corporate_id, bukan partner_id.
//
// Seluruh nama global diawali `crm` untuk mencegah tabrakan antar modul.
// ═══════════════════════════════════════════════════════════════

let crmTab = 'pipeline';
let crmStages = [], crmDeals = [], crmPartners = [];
let crmFrom = '', crmTo = '';

async function renderCrmPipeline() {
  const now = new Date();
  crmTo = now.toISOString().split('T')[0];
  crmFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Pipeline &amp; Pendapatan</h1>
        <p>Menyambungkan corong penjualan ke pendapatan yang benar-benar masuk</p></div>
      <button class="btn btn-ghost btn-sm" onclick="crmOpenStages()">Tahapan</button>
    </div>
    <div id="crm-warn"></div>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <input type="date" class="table-filter" id="crm-from" value="${crmFrom}" onchange="crmReload()">
      <span style="align-self:center;color:var(--gray)">s/d</span>
      <input type="date" class="table-filter" id="crm-to" value="${crmTo}" onchange="crmReload()">
      <span id="crm-note" style="font-size:12px;color:var(--text3)"></span>
    </div>
    <div class="tabs" id="crm-tabs" style="margin-bottom:14px">
      <button class="tab-btn active" onclick="crmSwitchTab('pipeline',this)">Papan Pipeline</button>
      <button class="tab-btn" onclick="crmSwitchTab('corong',this)">🔻 Corong &amp; Konversi</button>
      <button class="tab-btn" onclick="crmSwitchTab('partner',this)">🏢 Nilai Pelanggan</button>
      <button class="tab-btn" onclick="crmSwitchTab('target',this)">🎯 Target vs Realisasi</button>
    </div>
    <div id="crm-content"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await crmLoadBase();
}

function crmSwitchTab(t, btn) {
  crmTab = t;
  document.querySelectorAll('#crm-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  crmPaint();
}

function crmReload() {
  crmFrom = document.getElementById('crm-from')?.value || crmFrom;
  crmTo = document.getElementById('crm-to')?.value || crmTo;
  crmPaint();
}

async function crmLoadBase() {
  try {
    const [stages, deals, partners] = await Promise.all([
      sbGet('crm_pipeline_stages', 'select=*&is_active=eq.true&order=sort_order.asc'),
      sbGet('partner_deals', 'select=*&order=updated_at.desc&limit=500').catch(() => []),
      sbGet('partners', 'select=id,partner_name&order=partner_name').catch(() => []),
    ]);
    crmStages = Array.isArray(stages) ? stages : [];
    crmDeals = Array.isArray(deals) ? deals : [];
    crmPartners = Array.isArray(partners) ? partners : [];
    document.getElementById('crm-warn').innerHTML = '';
    crmPaint();
  } catch (e) {
    document.getElementById('crm-warn').innerHTML =
      `<div class="status-box status-warn" style="margin-bottom:14px">
        Modul pipeline belum tersedia — jalankan <code>supabase_crm.sql</code> di Supabase SQL Editor.</div>`;
    document.getElementById('crm-content').innerHTML = '';
  }
}

function crmPaint() {
  const el = document.getElementById('crm-content'); if (!el) return;
  if (crmTab === 'pipeline') crmPaintBoard(el);
  else if (crmTab === 'corong') crmPaintFunnel(el);
  else if (crmTab === 'partner') crmPaintPartners(el);
  else crmPaintTarget(el);
}

// ══════════════════════════════════════════════════════════════
// PAPAN PIPELINE
// ══════════════════════════════════════════════════════════════
async function crmPaintBoard(el) {
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  const idle = await sbRpc('crm_idle_deals', {}).catch(() => []);
  const idleIds = new Set((idle || []).map(d => d.deal_id || d.id));

  const note = document.getElementById('crm-note');
  if (note) note.innerHTML = (idle || []).length
    ? `<span style="color:var(--warn-deep);font-weight:600">⚠ ${idle.length} deal menganggur</span>`
    : '';

  if (!crmStages.length) {
    el.innerHTML = `<div class="empty-state"><div class="ico"></div>
      <h3>Tahapan pipeline belum diatur</h3>
      <button class="btn btn-teal" style="margin-top:10px" onclick="crmOpenStages()">Atur Tahapan</button></div>`;
    return;
  }

  const byStage = {};
  crmStages.forEach(s => byStage[s.stage_key] = []);
  crmDeals.forEach(d => {
    const k = d.stage_key || d.stage || d.status;
    if (byStage[k]) byStage[k].push(d);
    else (byStage['_lain'] = byStage['_lain'] || []).push(d);
  });

  el.innerHTML = `
    <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px">
      ${crmStages.map(s => {
        const items = byStage[s.stage_key] || [];
        const total = items.reduce((a, d) => a + (+d.deal_value || +d.value || 0), 0);
        return `<div style="min-width:250px;flex:1;background:var(--bg2);border:1px solid var(--border);
          border-radius:10px;padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="width:9px;height:9px;border-radius:50%;background:${s.color || '#6B7A8B'}"></span>
              <b style="font-size:12.5px">${s.stage_name}</b>
            </div>
            <span style="font-size:11px;color:var(--gray)">${items.length}</span>
          </div>
          <div style="font-size:11.5px;color:var(--text3);margin-bottom:8px">
            Perkiraan ${formatCurrency(total)}${s.probability != null ? ` · ${s.probability}%` : ''}</div>
          ${items.slice(0, 12).map(d => `
            <div style="background:var(--white);border:1px solid var(--border);border-radius:7px;padding:8px 10px;
              margin-bottom:6px;${idleIds.has(d.id) ? 'border-left:3px solid var(--warn-deep)' : ''}">
              <div style="font-size:12.5px;font-weight:600">${d.deal_name || d.title || crmPartnerName(d.partner_id)}</div>
              <div style="font-size:11px;color:var(--gray)">${crmPartnerName(d.partner_id)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
                <span style="font-size:11.5px;font-variant-numeric:tabular-nums">${formatCurrency(d.deal_value || d.value || 0)}</span>
                <select onchange="crmMoveDeal(${d.id},this.value)"
                  style="font-size:10.5px;padding:2px 4px;border:1px solid var(--border);border-radius:4px">
                  ${crmStages.map(x => `<option value="${x.stage_key}"${x.stage_key === s.stage_key ? ' selected' : ''}>${x.stage_name}</option>`).join('')}
                </select>
              </div>
              ${idleIds.has(d.id) ? '<div style="font-size:10px;color:var(--warn-deep);margin-top:3px">⚠ menganggur</div>' : ''}
            </div>`).join('') || '<div style="font-size:11.5px;color:var(--gray);padding:6px 0">Kosong</div>'}
          ${items.length > 12 ? `<div style="font-size:11px;color:var(--gray)">+${items.length - 12} lainnya</div>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:11.5px;color:var(--text3);margin-top:10px">
      Nilai di papan ini adalah <b>perkiraan</b> yang diisi sales. Angka pendapatan nyata
      ada di tab Corong &amp; Konversi.
    </div>`;
}

function crmPartnerName(id) {
  return crmPartners.find(p => p.id === id)?.partner_name || '—';
}

async function crmMoveDeal(dealId, stageKey) {
  try {
    await sbPatch('partner_deals', dealId, { stage_key: stageKey, updated_at: new Date().toISOString() });
    await logActivity('crm_stage', 'partner_deals', dealId, `Deal dipindah ke tahap ${stageKey}`);
    toast('Tahap diperbarui', 'ok');
    await crmLoadBase();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

// ══════════════════════════════════════════════════════════════
// CORONG & KONVERSI
// ══════════════════════════════════════════════════════════════
async function crmPaintFunnel(el) {
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  const args = { p_from: crmFrom, p_to: crmTo };
  const [funnel, konversi, sumber] = await Promise.all([
    sbRpc('crm_funnel_summary', args).catch(() => null),
    sbRpc('crm_stage_conversion', args).catch(() => []),
    sbRpc('crm_source_performance', args).catch(() => []),
  ]);

  const f = Array.isArray(funnel) ? funnel[0] : funnel;
  if (!f) { el.innerHTML = '<div class="status-box status-warn">Data corong belum tersedia.</div>'; return; }

  const step = (label, nilai, sub, warna) => ({ label, nilai: +nilai || 0, sub, warna });
  const steps = [
    step('Leads masuk', f.total_leads, 'perkiraan', '#6B7A8B'),
    step('Jadi deal', f.total_deals, 'perkiraan', '#B45309'),
    step('Jadi partner aktif', f.total_partners, 'nyata', '#0E7C86'),
    step('Menghasilkan faktur', f.partners_with_revenue ?? f.total_invoiced, 'nyata', '#15803D'),
  ];
  const maks = Math.max(...steps.map(s => s.nilai), 1);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:18px">
      ${[{ l: 'Nilai perkiraan pipeline', v: f.pipeline_value, c: '#B45309', tag: 'perkiraan' },
         { l: 'Pendapatan nyata terkumpul', v: f.revenue_actual ?? f.total_revenue, c: '#15803D', tag: 'nyata' }]
        .map(k => `<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid ${k.c};
          border-radius:10px;padding:13px">
          <div style="font-size:10.5px;color:var(--gray);text-transform:uppercase;letter-spacing:.06em">${k.l}</div>
          <div style="font-size:18px;font-weight:800;color:${k.c};font-variant-numeric:tabular-nums">${formatCurrency(k.v)}</div>
          <div style="font-size:10px;color:${k.tag === 'nyata' ? '#15803D' : '#B45309'};font-weight:700">
            ${k.tag === 'nyata' ? '● dari faktur terbit' : '○ diisi sales'}</div>
        </div>`).join('')}
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title" style="margin-bottom:12px">Corong penjualan</div>
      ${steps.map(s => `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">
            <span>${s.label}
              <span style="font-size:10px;color:${s.sub === 'nyata' ? '#15803D' : '#B45309'};font-weight:700">
                ${s.sub === 'nyata' ? '● nyata' : '○ perkiraan'}</span></span>
            <b style="font-variant-numeric:tabular-nums">${s.nilai}</b>
          </div>
          <div style="height:9px;background:var(--border);border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${(s.nilai / maks * 100).toFixed(1)}%;background:${s.warna};border-radius:5px"></div>
          </div>
        </div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="card"><div class="card-title" style="margin-bottom:10px">Konversi antar tahap</div>
        ${(konversi || []).length ? `<table style="width:100%;font-size:12.5px"><tbody>
          ${konversi.map(k => `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:5px">${k.stage_name || k.stage_key}</td>
            <td style="padding:5px;text-align:right">${k.deal_count ?? k.jumlah ?? 0}</td>
            <td style="padding:5px;text-align:right;font-weight:700">${k.conversion_pct != null ? (+k.conversion_pct).toFixed(0) + '%' : '—'}</td>
            <td style="padding:5px;text-align:right;font-size:11px;color:var(--gray)">
              ${k.avg_days != null ? Math.round(k.avg_days) + ' hari' : ''}</td>
          </tr>`).join('')}</tbody></table>`
          : '<div style="color:var(--gray);font-size:12.5px">Belum ada riwayat perpindahan tahap</div>'}
      </div>
      <div class="card"><div class="card-title" style="margin-bottom:10px">Sumber leads paling menghasilkan</div>
        <div style="font-size:11.5px;color:var(--text3);margin-bottom:8px">
          Diurutkan menurut <b>pendapatan nyata</b>, bukan jumlah leads — keduanya sering berbeda.</div>
        ${(sumber || []).length ? `<table style="width:100%;font-size:12.5px"><tbody>
          ${sumber.map(s => `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:5px">${s.source || '—'}</td>
            <td style="padding:5px;text-align:right;color:var(--gray)">${s.lead_count ?? 0} leads</td>
            <td style="padding:5px;text-align:right;font-weight:700;color:var(--success-deep)">${formatCurrency(s.revenue ?? 0)}</td>
          </tr>`).join('')}</tbody></table>`
          : '<div style="color:var(--gray);font-size:12.5px">Belum ada data sumber</div>'}
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// NILAI PELANGGAN
// ══════════════════════════════════════════════════════════════
async function crmPaintPartners(el) {
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  const ltv = await sbRpc('crm_partner_ltv', { p_limit: 50 }).catch(() => []);
  if (!(ltv || []).length) {
    el.innerHTML = `<div class="empty-state"><div class="ico">🏢</div>
      <h3>Belum ada pendapatan dari partner</h3>
      <p>Nilai di sini dihitung dari faktur yang benar-benar terbit.</p></div>`;
    return;
  }
  const maks = Math.max(...ltv.map(p => +p.total_revenue || 0), 1);
  el.innerHTML = `
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      Nilai sepanjang hubungan kerja sama, dihitung dari <b>faktur yang benar-benar terbit</b>.
      Klik satu baris untuk melihat tren bulanannya.
    </div>
    <div class="table-wrap"><table><thead><tr>
      <th>Partner</th><th style="text-align:right">Total Pendapatan</th>
      <th style="text-align:right">Faktur</th><th style="text-align:right">Kunjungan Pasien</th><th>Porsi</th>
    </tr></thead><tbody>${ltv.map(p => `<tr style="cursor:pointer" onclick="crmOpenPartnerTrend(${p.partner_id},'${(p.partner_name || '').replace(/'/g, "\\'")}')">
      <td style="font-weight:600">${p.partner_name || '—'}</td>
      <td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:var(--success-deep)">${formatCurrency(p.total_revenue)}</td>
      <td style="text-align:right">${p.invoice_count ?? 0}</td>
      <td style="text-align:right">${p.visit_count ?? 0}</td>
      <td><div style="height:6px;background:var(--border);border-radius:3px;min-width:70px">
        <div style="height:100%;width:${((+p.total_revenue || 0) / maks * 100).toFixed(0)}%;background:var(--teal);border-radius:3px"></div>
      </div></td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function crmOpenPartnerTrend(partnerId, nama) {
  const rows = await sbRpc('crm_partner_monthly', { p_partner_id: partnerId, p_months: 12 }).catch(() => []);
  const maks = Math.max(...(rows || []).map(r => +r.revenue || 0), 1);
  openModal(`
    <div class="modal-header"><div class="modal-title">🏢 ${nama}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    ${(rows || []).length ? `<div style="display:flex;align-items:flex-end;gap:5px;height:150px;margin-bottom:12px">
      ${rows.map(r => `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%">
        <div style="width:100%;background:var(--teal);border-radius:3px 3px 0 0;
          height:${((+r.revenue || 0) / maks * 100).toFixed(0)}%" title="${formatCurrency(r.revenue)}"></div>
        <div style="font-size:9px;color:var(--gray);margin-top:3px;white-space:nowrap">${(r.period || '').slice(5)}</div>
      </div>`).join('')}
    </div>
    <table style="width:100%;font-size:12.5px"><tbody>${rows.map(r => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:5px">${r.period || '—'}</td>
      <td style="padding:5px;text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(r.revenue)}</td>
      <td style="padding:5px;text-align:right;color:var(--gray)">${r.visit_count ?? 0} kunjungan</td>
    </tr>`).join('')}</tbody></table>`
      : '<div style="color:var(--gray);font-size:12.5px">Belum ada pendapatan tercatat</div>'}
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');
}

// ══════════════════════════════════════════════════════════════
// TARGET VS REALISASI
// ══════════════════════════════════════════════════════════════
async function crmPaintTarget(el) {
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  const periode = (crmTo || new Date().toISOString()).slice(0, 7);
  const rows = await sbRpc('crm_target_achievement', { p_period: periode }).catch(() => []);
  if (!(rows || []).length) {
    el.innerHTML = `<div class="empty-state"><div class="ico">🎯</div>
      <h3>Belum ada target pada periode ${periode}</h3>
      <p>Isi target lewat menu OKR &amp; Target Sales.</p></div>`;
    return;
  }
  el.innerHTML = `
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      Periode ${periode}. Kolom <b>realisasi</b> berasal dari faktur yang benar-benar terbit,
      bukan dari perkiraan nilai deal.
    </div>
    <div class="table-wrap"><table><thead><tr>
      <th>Penanggung Jawab</th><th>Sasaran</th>
      <th style="text-align:right">Target</th><th style="text-align:right">Realisasi</th>
      <th style="text-align:right">Capaian</th><th>Grafik</th>
    </tr></thead><tbody>${rows.map(r => {
      const t = +r.target || 0, a = +r.actual || 0;
      const pct = t ? Math.round(a / t * 100) : 0;
      const warna = pct >= 100 ? '#15803D' : pct >= 70 ? '#B45309' : '#B91C1C';
      return `<tr>
        <td style="font-weight:600">${r.assigned_name || '—'}</td>
        <td style="font-size:12.5px">${r.objective || '—'}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(t)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--success-deep)">${formatCurrency(a)}</td>
        <td style="text-align:right;font-weight:800;color:${warna}">${pct}%</td>
        <td><div style="height:7px;background:var(--border);border-radius:4px;min-width:80px">
          <div style="height:100%;width:${Math.min(pct, 100)}%;background:${warna};border-radius:4px"></div></div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

// ══════════════════════════════════════════════════════════════
// PENGATURAN TAHAPAN
// ══════════════════════════════════════════════════════════════
async function crmOpenStages() {
  let rows = crmStages;
  if (!rows.length) rows = await sbGet('crm_pipeline_stages', 'select=*&order=sort_order').catch(() => []);
  openModal(`
    <div class="modal-header"><div class="modal-title">Tahapan Pipeline</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:10px">
      Tahapan disimpan sebagai data, sehingga bisa diubah tanpa menyentuh program.
      <b>Hari menganggur</b> menentukan kapan sebuah deal ditandai perlu ditindaklanjuti.
    </div>
    <div class="table-wrap" style="max-height:55vh;overflow:auto"><table><thead><tr>
      <th>Urut</th><th>Nama Tahap</th><th style="width:90px">Peluang %</th>
      <th style="width:110px">Hari menganggur</th>
    </tr></thead><tbody>${(rows || []).map(s => `<tr>
      <td style="width:50px"><input type="number" value="${s.sort_order || 0}" data-cs-id="${s.id}" data-cs-f="sort_order"
        style="width:46px;font-size:12px;padding:4px"></td>
      <td><input type="text" value="${s.stage_name || ''}" data-cs-id="${s.id}" data-cs-f="stage_name"
        style="width:100%;font-size:12px;padding:4px"></td>
      <td><input type="number" min="0" max="100" value="${s.probability ?? ''}" data-cs-id="${s.id}" data-cs-f="probability"
        style="width:100%;font-size:12px;padding:4px"></td>
      <td><input type="number" min="0" value="${s.idle_days ?? ''}" data-cs-id="${s.id}" data-cs-f="idle_days"
        style="width:100%;font-size:12px;padding:4px"></td>
    </tr>`).join('')}</tbody></table></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="crmSaveStages()">Simpan</button>
    </div>`, 'wide');
}

async function crmSaveStages() {
  const inputs = document.querySelectorAll('[data-cs-id]');
  const byId = {};
  inputs.forEach(i => {
    const id = i.getAttribute('data-cs-id');
    const f = i.getAttribute('data-cs-f');
    byId[id] = byId[id] || {};
    byId[id][f] = (f === 'stage_name') ? i.value.trim() : (i.value === '' ? null : parseFloat(i.value));
  });
  try {
    for (const [id, patch] of Object.entries(byId)) {
      await sbPatch('crm_pipeline_stages', id, { ...patch, updated_at: new Date().toISOString() });
    }
    toast('✅ Tahapan tersimpan', 'ok'); closeModalForce(); await crmLoadBase();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}