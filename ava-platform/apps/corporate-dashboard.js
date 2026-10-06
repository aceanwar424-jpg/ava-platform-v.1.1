/* ═══════════════════════════════════════════════════════════════
   AVA HEALTH — CORPORATE HEALTH DASHBOARD ENGINE
   OWNED_BY: generic | Multi-tenant safe with real database data
   ═══════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = v => v != null && Number.isFinite(Number(v)) ? Number(v).toLocaleString('id-ID') : '—';
  const known = v => v != null && Number.isFinite(Number(v));
  
  const colors = ['#00865a', '#2676cc', '#d94055', '#697b91'];
  const statuses = ['Approved', 'Requested', 'Rejected', 'Lainnya'];
  const labels = ['Disetujui', 'Menunggu persetujuan', 'Ditolak', 'Status lainnya'];
  let sequence = 0;

  // ── AGGREGATE REAL STATS & TIMELINES ───────────────────────────
  function aggregate(requests, employees, filter) {
    const departments = new Map(employees.map(e => [String(e.id), e.department || 'Belum tercatat']));
    
    const rows = (requests || []).map(r => ({
      ...r,
      department: r.department || departments.get(String(r.corporate_employee_id)) || 'Belum tercatat',
      date: String(r.requested_at || '').slice(0, 10)
    })).filter(r => 
      (!filter.from || r.date >= filter.from) &&
      (!filter.to || (r.date && r.date <= filter.to)) &&
      (!filter.branch || (r.branch || 'Belum tercatat') === filter.branch) &&
      (!filter.department || r.department === filter.department) &&
      (!filter.type || (r.type_of_test || 'Belum tercatat') === filter.type)
    );

    const counts = statuses.map(s => rows.filter(r => s === 'Lainnya' ? !statuses.slice(0, 3).includes(r.exam_status) : r.exam_status === s).length);
    
    const byDept = {}, months = {};
    rows.forEach(r => {
      byDept[r.department] = (byDept[r.department] || 0) + 1;
      if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
        months[r.date.slice(0, 7)] = (months[r.date.slice(0, 7)] || 0) + 1;
      }
    });

    const keys = Object.keys(months).sort();
    if (keys.length) {
      let date = new Date(keys[0] + '-01T00:00:00Z');
      const end = keys[keys.length - 1];
      while (date.toISOString().slice(0, 7) <= end) {
        const key = date.toISOString().slice(0, 7);
        months[key] ||= 0;
        date.setUTCMonth(date.getUTCMonth() + 1);
        if (Object.keys(months).length > 240) break;
      }
    }

    return {
      rows,
      counts,
      departments: Object.entries(byDept).sort((a, b) => b[1] - a[1]),
      months: Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]))
    };
  }

  const empty = text => `<p class="cd-empty">${esc(text)}</p>`;

  function bars(items, color = '#2676cc', denominator = 0) {
    if (!items || !items.length) return empty('Belum ada data untuk ditampilkan.');
    const max = Math.max(1, denominator, ...items.map(x => x[1]));
    return items.map(([label, value]) => `
      <div class="cd-bar">
        <div class="cd-bar-label">
          <span>${esc(label)}</span>
          <b>${number(value)}</b>
        </div>
        <div class="cd-track" aria-hidden="true">
          <span style="width:${(value / max) * 100}%; background:${color}"></span>
        </div>
      </div>
    `).join('');
  }

  // ── DONUT SVG ──────────────────────────────────────────────────
  function donut(counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) return empty('Belum ada data permintaan pemeriksaan pada filter ini.');
    
    let offset = 0;
    const segments = counts.map((v, i) => {
      const length = (v / total) * 100;
      const out = `<circle cx="90" cy="90" r="68" fill="none" stroke="${colors[i]}" stroke-width="22" pathLength="100" stroke-dasharray="${length} ${100 - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"/>`;
      offset += length;
      return out;
    }).join('');

    return `
      <svg class="cd-donut" viewBox="0 0 180 180" role="img" aria-label="${total} permintaan; rincian status di bawah">
        ${segments}
        <text x="90" y="86" text-anchor="middle" font-size="28" font-weight="800" fill="#102c54">${total}</text>
        <text x="90" y="106" text-anchor="middle" font-size="11.5" font-weight="500" fill="#52657b">Permintaan</text>
      </svg>
      <div class="cd-legend">
        ${counts.map((n, i) => `
          <div>
            <i class="cd-dot" style="background:${colors[i]}" aria-hidden="true"></i>
            <span>${labels[i]}</span>
            <b>${number(n)} · ${total ? Math.round((n / total) * 100) : 0}%</b>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── TREND LINE CHART SVG ───────────────────────────────────────
  function trend(months) {
    if (!months.length) return empty('Belum ada permintaan bertanggal untuk ditampilkan.');
    const max = Math.max(1, ...months.map(x => x[1]));
    const step = Math.max(1, Math.ceil(max / 4));
    const top = step * 4;
    const point = (v, i) => [46 + (i * 360) / Math.max(1, months.length - 1), 180 - (v / top) * 145];
    const grid = Array.from({ length: 5 }, (_, i) => `
      <line x1="46" x2="414" y1="${180 - i * 36.25}" y2="${180 - i * 36.25}" stroke="#e2ebf3"/>
      <text x="36" y="${184 - i * 36.25}" text-anchor="end" font-size="11" fill="#52657b">${i * step}</text>
    `).join('');

    return `
      <svg class="cd-chart" viewBox="0 0 450 224" role="img" aria-label="Tren jumlah permintaan bulanan. Rincian tersedia pada tabel.">
        ${grid}
        <polyline points="${months.map((x, i) => point(x[1], i).join(',')).join(' ')}" fill="none" stroke="#2676cc" stroke-width="3"/>
        ${months.map(([m, v], i) => {
          const [x, y] = point(v, i);
          return `
            <circle cx="${x}" cy="${y}" r="4.5" fill="#2676cc">
              <title>${m}: ${v}</title>
            </circle>
            ${months.length <= 12 ? `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="11" font-weight="700" fill="#102c54">${v}</text>` : ''}
            ${i % Math.max(1, Math.ceil(months.length / 5)) === 0 || i === months.length - 1 ? `<text x="${x}" y="207" text-anchor="middle" font-size="11" fill="#52657b">${m}</text>` : ''}
          `;
        }).join('')}
      </svg>
      <details>
        <summary>► Lihat tabel tren bulanan</summary>
        <table>
          <thead><tr><th>Bulan</th><th>Permintaan</th></tr></thead>
          <tbody>${months.map(([m, v]) => `<tr><td>${m}</td><td>${v}</td></tr>`).join('')}</tbody>
        </table>
      </details>
    `;
  }

  async function fetchAll(table, fields, corporateId) {
    if (typeof sbGetStrict !== 'function' && typeof sbGet !== 'function') throw new Error('No fetcher');
    const loader = typeof sbGetStrict === 'function' ? sbGetStrict : sbGet;
    const rows = [];
    for (let offset = 0; offset < 10000; offset += 500) {
      const page = await loader(table, `select=${fields}&corporate_id=eq.${encodeURIComponent(corporateId)}&order=id.asc&limit=500&offset=${offset}`);
      if (!Array.isArray(page)) throw new Error('Invalid data');
      rows.push(...page);
      if (page.length < 500) return rows;
    }
    return rows;
  }

  // ── MAIN RENDER ────────────────────────────────────────────────
  async function render(context = {}) {
    const host = document.getElementById('corporate-dashboard');
    if (!host) return;
    const ticket = ++sequence;

    host.innerHTML = '<p class="cd-state" role="status">Memuat dashboard perusahaan dari database…</p>';

    let corporateId = context.corporateId || window.currentCorporateId || null;
    let corpName = context.corporateName || window.currentCorporateName || null;

    // If no corporateId provided, attempt to lookup the active company from Supabase
    if (!corporateId && typeof sbGet === 'function') {
      try {
        const corps = await sbGet('corporates', 'select=id,corporate_name&status=eq.Aktif&order=corporate_name.asc&limit=1');
        if (Array.isArray(corps) && corps.length) {
          corporateId = corps[0].id;
          corpName = corps[0].corporate_name;
          window.currentCorporateId = corporateId;
          window.currentCorporateName = corpName;
        }
      } catch (_) {}
    }

    if (!corporateId) {
      host.innerHTML = `
        <div class="cd-empty" style="padding:40px 20px;text-align:center">
          <div style="font-size:32px;margin-bottom:8px">🏢</div>
          <h3 style="font-size:16px;color:var(--cd-ink);margin-bottom:6px">Akun belum ditautkan ke data perusahaan</h3>
          <p class="cd-note" style="max-width:440px;margin:0 auto">Pilih atau daftarkan perusahaan di master data korporat untuk melihat metrik operasional dan kesehatan karyawan.</p>
        </div>
      `;
      return;
    }

    let employees = [], requests = [], programs = [];
    let loadErrors = false;
    let employeesOk = false, requestsOk = false;

    try {
      const results = await Promise.allSettled([
        fetchAll('corporate_employees', 'id,department,branch,full_name', corporateId),
        fetchAll('corp_exam_requests', 'id,corporate_employee_id,requested_at,branch,type_of_test,exam_status', corporateId),
        typeof sbRpc === 'function' ? sbRpc('wellness_corporate_dashboard', { p_corporate_id: corporateId }) : Promise.reject()
      ]);
      
      if (ticket !== sequence) return;

      if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
        employees = results[0].value;
        employeesOk = true;
      } else if (results[0].status === 'rejected') {
        loadErrors = true;
      }

      if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) {
        requests = results[1].value;
        requestsOk = true;
      } else if (results[1].status === 'rejected') {
        loadErrors = true;
      }

      if (results[2].status === 'fulfilled' && results[2].value?.programs?.length) {
        programs = results[2].value.programs;
      }
    } catch (e) {
      loadErrors = true;
    }

    const filter = { from: '', to: '', branch: '', department: '', type: '' };
    let programId = String(programs[0]?.id || '');
    let summary;

    const branchesList = [...new Set(requests.map(r => r.branch).filter(Boolean))];
    const deptsList = [...new Set(employees.map(e => e.department).filter(Boolean))];
    const typesList = [...new Set(requests.map(r => r.type_of_test).filter(Boolean))];

    const options = (values, title) =>
      `<option value="">${title}</option>` +
      values.sort().map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');

    host.innerHTML = `
      <header class="cd-header">
        <div>
          <p class="cd-eyebrow">AVA · CORPORATE HEALTH</p>
          <h2>Dashboard Perusahaan</h2>
          <p class="cd-subtitle">${esc(corpName || 'Portal Layanan Perusahaan')} · Pemeriksaan, pemantauan, dan tindak lanjut.</p>
        </div>
        <div class="cd-actions">
          <button data-action="refresh">Muat ulang</button>
          <button data-action="export" class="cd-primary" ${!requestsOk ? 'disabled' : ''}>Unduh ringkasan ↓</button>
        </div>
      </header>

      ${loadErrors ? '<div class="cd-warning" role="status">Sebagian tabel data belum dapat dibaca dari server. Nilai yang belum ada ditandai —. Gunakan Muat Ulang untuk mencoba kembali.</div>' : ''}

      <div class="cd-filters">
        <label>Dari tanggal<input type="date" data-filter="from"></label>
        <label>Sampai tanggal<input type="date" data-filter="to"></label>
        <label>Lokasi<select data-filter="branch">${options(branchesList, 'Semua lokasi')}</select></label>
        <label>Departemen<select data-filter="department" ${!employeesOk ? 'disabled' : ''}>${options(deptsList, 'Semua departemen')}</select></label>
        <label>Jenis pemeriksaan<select data-filter="type">${options(typesList, 'Semua jenis')}</select></label>
      </div>
      <p class="cd-note">Filter berlaku untuk permintaan berdasarkan tanggal pengajuan. Karyawan dan wellness merupakan data real-time database.</p>

      <div id="cd-results" aria-live="polite"></div>
      <p class="cd-meta">Diperbarui ${esc(new Date().toLocaleString('id-ID'))} · Data asli sesuai akses akun perusahaan.</p>
    `;

    function paint() {
      const target = host.querySelector('#cd-results');
      if (filter.from && filter.to && filter.from > filter.to) {
        target.innerHTML = '<p class="cd-warning">Tanggal akhir harus sama atau setelah tanggal awal.</p>';
        host.querySelector('[data-action="export"]').disabled = true;
        return;
      }
      host.querySelector('[data-action="export"]').disabled = !requestsOk;

      summary = aggregate(requests, employees, filter);
      const p = programs.find(prg => String(prg.id) === programId) || programs[0];
      const high = known(p?.risk_l3_count) && known(p?.risk_l4_count) ? Number(p.risk_l3_count) + Number(p.risk_l4_count) : null;
      const coverage = known(p?.screened_count) && Number(p?.enrolled) > 0 ? Math.round((p.screened_count / p.enrolled) * 100) + '%' : '—';

      const kpi = (label, value, note) => `
        <article class="cd-card cd-kpi">
          <span>${label}</span>
          <strong>${value}</strong>
          <p class="cd-note">${note}</p>
        </article>
      `;

      target.innerHTML = `
        <div class="cd-kpis">
          ${kpi('Karyawan terdaftar', employeesOk ? number(employees.length) : '—', 'Seluruh karyawan perusahaan di database')}
          ${kpi('Permintaan disetujui', requestsOk ? number(summary.counts[0]) : '—', 'Sesuai filter · bukan hasil selesai')}
          ${kpi('Cakupan skrining', coverage, 'Peserta terskrining / peserta program')}
          ${kpi('Risiko tinggi · L3 + L4', high != null ? number(high) : '—', 'Klasifikasi server · program terpilih')}
        </div>

        <div class="cd-grid">
          <article class="cd-card">
            <h3>Status permintaan</h3>
            ${requests.length ? donut(summary.counts) : empty('Belum ada permintaan pemeriksaan tercatat.')}
          </article>
          <article class="cd-card">
            <h3>Tren permintaan pemeriksaan</h3>
            <p class="cd-note">Jumlah pengajuan per bulan</p>
            ${summary.months.length ? trend(summary.months) : empty('Belum ada data permintaan bertanggal.')}
          </article>
          <article class="cd-card">
            <h3>Permintaan per departemen</h3>
            ${summary.departments.length ? bars(summary.departments) : empty('Belum ada data departemen pada filter ini.')}
            <p class="cd-note" style="margin-top:12px">Jumlah permintaan, bukan jumlah karyawan unik.</p>
          </article>
        </div>

        <div class="cd-grid cd-bottom">
          <article class="cd-card">
            <h3>Profil risiko program</h3>
            <label class="cd-program">
              Program wellness
              <select id="cd-program" ${!programs.length ? 'disabled' : ''}>
                ${programs.length ? programs.map(prg => `<option value="${esc(prg.id)}" ${String(prg.id) === programId ? 'selected' : ''}>${esc(prg.name)}</option>`).join('') : '<option>Belum ada program tersedia</option>'}
              </select>
            </label>
            ${p ? ['L1 · Pemantauan rutin', 'L2 · Perhatian', 'L3 · Risiko tinggi', 'L4 · Risiko sangat tinggi'].map((name, i) =>
                known(p['risk_l' + (i + 1) + '_count']) ? bars([[name, Number(p['risk_l' + (i + 1) + '_count'])]], ['#00865a', '#b45309', '#d94055', '#8c365e'][i], Number(p.enrolled) || 0) : `<p class="cd-note">${name}: —</p>`
              ).join('') : empty('Belum ada program wellness aktif untuk perusahaan ini.')}
            <p class="cd-note" style="margin-top:14px">Snapshot program terpilih; tidak mengikuti filter permintaan. — berarti data belum tersedia atau dibatasi untuk privasi.</p>
          </article>

          <article class="cd-card">
            <h3>Tindak lanjut</h3>
            <p class="cd-note">Lanjutkan pekerjaan melalui alur perusahaan yang tersedia.</p>
            <div class="cd-links">
              <button type="button" data-view="corporate-wellness-view">
                <span>Monitoring Wellness →</span>
                <small>Pantau program, hasil skrining, dan tindak lanjut sesuai wewenang.</small>
              </button>
              <button type="button" data-view="examination-history-view">
                <span>Riwayat Pemeriksaan →</span>
                <small>Tinjau permintaan dan status persetujuan pemeriksaan.</small>
              </button>
              <button type="button" data-view="corporate-employees-view">
                <span>Kelola Karyawan →</span>
                <small>Perbarui peserta dan departemen perusahaan.</small>
              </button>
            </div>
            <p class="cd-note" style="margin-top:16px">TAT laboratorium dan tren diagnosis bersumber dari data verifikasi laboratorium.</p>
          </article>
        </div>
      `;
    }

    host.onchange = e => {
      if (e.target.dataset.filter) {
        filter[e.target.dataset.filter] = e.target.value;
        paint();
      }
      if (e.target.id === 'cd-program') {
        programId = e.target.value;
        paint();
      }
    };

    host.onclick = e => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.dataset.action === 'refresh') {
        render(context);
      }
      if (button.dataset.view && typeof showView === 'function') {
        showView(button.dataset.view);
      }
      if (button.dataset.action === 'export') {
        const safe = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
        const rows = [
          ['Ringkasan permintaan', 'Jumlah'],
          ['Dari', filter.from || 'Semua'],
          ['Sampai', filter.to || 'Semua'],
          ['Lokasi', filter.branch || 'Semua'],
          ['Departemen', filter.department || 'Semua'],
          ['Jenis', filter.type || 'Semua'],
          ...labels.map((label, i) => [label, summary.counts[i]]),
          ...summary.months,
          ...summary.departments
        ];
        const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `ringkasan-corporate-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    };

    paint();
  }

  root.CorporateDashboard = { render, aggregate };
})(typeof window === 'undefined' ? globalThis : window);
