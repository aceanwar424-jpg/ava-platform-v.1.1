// ═══════════════════════════════════════════
// MODULE: Executive Dashboard v2
// - KPI: Partner, Leads, Revenue, Pipeline
// - Follow-up Reminder widget
// - Team Performance
// - Pipeline bar + recent activity
// ═══════════════════════════════════════════

async function renderDashboard() {
  const user = getUserName ? getUserName() : 'User';
  const now  = new Date();
  const greeting = now.getHours() < 12 ? 'Selamat Pagi' : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Sore';
  const dateStr = now.toLocaleDateString('id-ID', {weekday:'long',day:'numeric',month:'long',year:'numeric'});

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>${greeting}, ${user}! 👋</h1>
        <p>${dateStr} · Ringkasan performa OneLab hari ini</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderDashboard()">↻ Refresh</button>
        <button class="btn btn-teal" onclick="navigate('leads');setTimeout(openLeadForm,300)">+ Tambah Lead</button>
      </div>
    </div>
    <div id="dash-reminder"></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:14px;margin-bottom:20px" id="dash-kpi">
      ${[1,2,3,4,5,6].map(()=>`
        <div class="kpi-card">
          <div class="kpi-icon" style="background:var(--lgray)"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div></div>
          <div><div class="kpi-val" style="font-size:20px;color:#ccc">—</div><div class="kpi-label">Memuat...</div></div>
        </div>`).join('')}
    </div>
    <div class="card" style="margin-bottom:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="card-title">📊 Sales Pipeline</div>
        <span style="font-size:12px;color:var(--text3)" id="dash-pipeline-total"></span>
      </div>
      <div id="dash-pipeline-bar" style="display:flex;gap:3px;height:10px;border-radius:10px;overflow:hidden;margin-bottom:12px;background:var(--bg2)"></div>
      <div id="dash-pipeline-legend" style="display:flex;gap:14px;flex-wrap:wrap"></div>
    </div>
    <div class="grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">⏰ Follow-up Hari Ini</div>
        <div id="dash-followup"><div class="loading-row" style="padding:24px"><div class="spinner"></div></div></div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">🤝 Output Kerjasama Terbaru</div>
        <div id="dash-deals"><div class="loading-row" style="padding:24px"><div class="spinner"></div></div></div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">👥 Team Performance (Bulan Ini)</div>
        <div id="dash-team"><div class="loading-row" style="padding:24px"><div class="spinner"></div></div></div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">📋 Aktivitas Terbaru</div>
        <div id="dash-activity" style="max-height:280px;overflow-y:auto">
          <div class="loading-row" style="padding:24px"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;

  await loadDashboardData();
}

async function loadDashboardData() {
  const now    = new Date();
  const today  = now.toISOString().split('T')[0];
  const month  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  try {
    const [partners, leads, deals, invoices, activity] = await Promise.all([
      sbGet('partners','select=id,status,assigned_name,created_at').catch(()=>[]),
      sbGet('leads','select=id,status,estimated_value,assigned_name,followup_date,lead_name,company').catch(()=>[]),
      sbGet('partner_deals','select=id,deal_name,deal_type,value,status,partner_id,created_at,created_by_name').catch(()=>[]),
      sbGet('invoices','select=id,total_amount,status,created_at').catch(()=>[]),
      sbGet('activity_logs','select=*&order=created_at.desc&limit=20').catch(()=>[]),
    ]);

    // ── KPI Cards ──────────────────────────
    const totalPartners   = (partners||[]).length;
    const activePartners  = (partners||[]).filter(p=>p.status==='Aktif').length;
    const newPartnersMonth= (partners||[]).filter(p=>p.created_at?.startsWith(month)).length;

    const totalLeads  = (leads||[]).length;
    const wonLeads    = (leads||[]).filter(l=>l.status==='Won').length;
    const activeLeads = (leads||[]).filter(l=>!['Won','Lost'].includes(l.status)).length;
    const pipelineVal = (leads||[]).filter(l=>!['Won','Lost'].includes(l.status))
                          .reduce((s,l)=>s+(l.estimated_value||0),0);

    const totalRev   = (invoices||[]).filter(i=>i.status==='Dibayar').reduce((s,i)=>s+(i.total_amount||0),0);
    const monthRev   = (invoices||[]).filter(i=>i.status==='Dibayar'&&i.created_at?.startsWith(month))
                          .reduce((s,i)=>s+(i.total_amount||0),0);

    const activeDeals= (deals||[]).filter(d=>d.status==='Active').length;

    const convRate = totalLeads > 0 ? Math.round(wonLeads/totalLeads*100) : 0;

    const kpiData = [
      { icon:'🤝', val:totalPartners,         sub:`${activePartners} aktif · +${newPartnersMonth} bulan ini`, label:'Total Partner',       color:'#0EA5E9' },
      { icon:'🎯', val:activeLeads,            sub:`${wonLeads} won · Conv ${convRate}%`,                     label:'Leads Aktif',          color:'#8B5CF6' },
      { icon:'💰', val:formatCurrency(monthRev), sub:`YTD: ${formatCurrency(totalRev)}`,                      label:'Revenue Bulan Ini',    color:'#22C55E' },
      { icon:'📊', val:formatCurrency(pipelineVal), sub:`${activeLeads} leads potensial`,                     label:'Pipeline Value',       color:'#F59E0B' },
      { icon:'🔥', val:activeDeals,            sub:`Deal kerjasama aktif`,                                    label:'Deal Aktif',           color:'#EF4444' },
      { icon:'📈', val:`${convRate}%`,         sub:`${wonLeads} dari ${totalLeads} leads`,                    label:'Conversion Rate',      color:'#00897B' },
    ];

    document.getElementById('dash-kpi').innerHTML = kpiData.map(k=>`
      <div class="kpi-card" style="border-left-color:${k.color}">
        <div class="kpi-icon" style="background:${k.color}15;font-size:20px">${k.icon}</div>
        <div style="min-width:0">
          <div class="kpi-val" style="color:${k.color}">${k.val}</div>
          <div class="kpi-label">${k.label}</div>
          <div style="font-size:10px;color:var(--gray);margin-top:2px">${k.sub}</div>
        </div>
      </div>`).join('');

    // ── Pipeline Bar ────────────────────────
    const STATUS_COLORS = {
      'Prospect':'#F59E0B','Dihubungi':'#0EA5E9','Meeting':'#8B5CF6',
      'Proposal Dikirim':'#F97316','MOU':'#06B6D4','Aktif':'#22C55E',
      'Tidak Berminat':'#EF4444'
    };
    const pCounts = {};
    Object.keys(STATUS_COLORS).forEach(s=>pCounts[s]=0);
    (partners||[]).forEach(p=>{if(pCounts[p.status]!==undefined)pCounts[p.status]++;});
    const pTotal = Math.max(totalPartners, 1);

    document.getElementById('dash-pipeline-bar').innerHTML = Object.entries(STATUS_COLORS)
      .filter(([s])=>pCounts[s]>0)
      .map(([s,c])=>`<div style="flex:${pCounts[s]};background:${c};min-width:4px" title="${s}: ${pCounts[s]}"></div>`)
      .join('');
    document.getElementById('dash-pipeline-legend').innerHTML = Object.entries(STATUS_COLORS)
      .map(([s,c])=>`<div style="display:flex;align-items:center;gap:4px">
        <div style="width:10px;height:10px;border-radius:2px;background:${c}"></div>
        <span style="font-size:11px;color:var(--gray)">${s} <strong>${pCounts[s]}</strong></span>
      </div>`).join('');

    // ── Follow-up Reminder ──────────────────
    const overdueLeads = (leads||[]).filter(l =>
      l.followup_date && l.followup_date <= today && !['Won','Lost'].includes(l.status)
    ).sort((a,b)=>a.followup_date.localeCompare(b.followup_date));

    const fuEl = document.getElementById('dash-followup');
    if (fuEl) {
      if (!overdueLeads.length) {
        fuEl.innerHTML = `<div class="empty-state" style="padding:20px">
          <div style="font-size:24px">✅</div>
          <p style="margin-top:8px">Tidak ada follow-up tertunda!</p>
        </div>`;
      } else {
        fuEl.innerHTML = overdueLeads.slice(0,6).map(l=>{
          const isToday = l.followup_date === today;
          const isOverdue = l.followup_date < today;
          return `
            <div onclick="navigate('leads')"
              style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
              <div style="width:8px;height:8px;border-radius:50%;background:${isOverdue?'#EF4444':'#F59E0B'};flex-shrink:0"></div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${l.lead_name||l.company||'—'}
                </div>
                <div style="font-size:11px;color:${isOverdue?'#EF4444':'#F59E0B'}">
                  ${isOverdue?'⚠️ Terlambat':'📅 Hari ini'} · ${l.followup_date}
                </div>
              </div>
              <button onclick="event.stopPropagation();window.open('https://wa.me/${''}')"
                style="background:none;border:none;font-size:16px;cursor:pointer;color:#25D366;flex-shrink:0">💬</button>
            </div>`;
        }).join('');
        if (overdueLeads.length > 6) {
          fuEl.innerHTML += `<div style="text-align:center;padding:8px;font-size:12px;color:var(--teal);cursor:pointer" onclick="navigate('leads')">
            +${overdueLeads.length-6} lainnya →
          </div>`;
        }
      }
    }

    // ── Recent Deals ────────────────────────
    const dealsEl = document.getElementById('dash-deals');
    const recentDeals = (deals||[]).slice(0,6);
    if (dealsEl) {
      if (!recentDeals.length) {
        dealsEl.innerHTML = `<div class="empty-state" style="padding:20px"><p>Belum ada output kerjasama</p></div>`;
      } else {
        const dealColors = {
          'MCU':'#0EA5E9','HealthDay':'#6366F1','Screening':'#F59E0B',
          'Wellness':'#22C55E','Branding':'#8B5CF6','OfficeCare':'#F97316',
          'HomeCare':'#EF4444','Lainnya':'#94A3B8'
        };
        dealsEl.innerHTML = recentDeals.map(d=>{
          const c = dealColors[d.deal_type]||'#94A3B8';
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="width:8px;height:32px;border-radius:2px;background:${c};flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.deal_name||'—'}</div>
              <div style="font-size:10px;color:var(--gray)">${d.deal_type||''} · ${d.created_by_name||'—'}</div>
            </div>
            ${d.value?`<div style="font-size:12px;font-weight:700;color:var(--teal);white-space:nowrap">${formatCurrency(d.value)}</div>`:''}
          </div>`;
        }).join('');
      }
    }

    // ── Team Performance ────────────────────
    const teamEl = document.getElementById('dash-team');
    if (teamEl) {
      const teamStats = {};
      (leads||[]).forEach(l => {
        if (!l.assigned_name) return;
        if (!teamStats[l.assigned_name]) teamStats[l.assigned_name] = {total:0,won:0,active:0,value:0};
        teamStats[l.assigned_name].total++;
        if (l.status==='Won') teamStats[l.assigned_name].won++;
        if (!['Won','Lost'].includes(l.status)) {
          teamStats[l.assigned_name].active++;
          teamStats[l.assigned_name].value += l.estimated_value||0;
        }
      });

      const sorted = Object.entries(teamStats).sort((a,b)=>b[1].won-a[1].won).slice(0,6);
      if (!sorted.length) {
        teamEl.innerHTML = `<div class="empty-state" style="padding:20px"><p>Belum ada data tim</p></div>`;
      } else {
        const maxWon = Math.max(...sorted.map(([,s])=>s.won), 1);
        teamEl.innerHTML = sorted.map(([name,s],i)=>`
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:22px;height:22px;border-radius:50%;background:var(--navy);color:#fff;
                  display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">
                  ${i+1}
                </div>
                <span style="font-size:12px;font-weight:600;color:var(--navy)">${name}</span>
              </div>
              <span style="font-size:11px;color:var(--gray)">${s.won} won · ${s.active} aktif</span>
            </div>
            <div style="background:var(--lgray);border-radius:4px;height:6px;overflow:hidden">
              <div style="height:100%;width:${Math.round(s.won/maxWon*100)}%;background:var(--teal);border-radius:4px"></div>
            </div>
          </div>`).join('');
      }
    }

    // ── Activity Feed ───────────────────────
    const actEl = document.getElementById('dash-activity');
    if (actEl) {
      const actIcons = {
        'create':'✨','update':'✏️','delete':'🗑','convert':'🔄',
        'call':'📞','whatsapp':'💬','meeting':'🤝','email':'📧',
        'status_change':'🔄','note':'📝','bulk_delete':'🗑'
      };
      if (!(activity||[]).length) {
        actEl.innerHTML = `<div class="empty-state" style="padding:20px"><p>Belum ada aktivitas</p></div>`;
      } else {
        actEl.innerHTML = (activity||[]).map(a=>`
          <div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid #F1F5F9">
            <div style="width:26px;height:26px;border-radius:50%;background:var(--lgray);
              display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">
              ${actIcons[a.action]||'📌'}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;color:var(--text);line-height:1.4">${a.description||a.action||'—'}</div>
              <div style="font-size:10px;color:var(--gray);margin-top:2px">${a.user_name||'—'} · ${timeAgo(a.created_at)}</div>
            </div>
          </div>`).join('');
      }
    }

    // ── Reminder Banner ─────────────────────
    const banner = document.getElementById('dash-reminder');
    if (banner && overdueLeads.length > 0) {
      banner.innerHTML = `
        <div style="background:linear-gradient(135deg,#FFF8E1,#FEF3C7);border:1.5px solid #FCD34D;
          border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;cursor:pointer"
          onclick="navigate('leads')">
          <span style="font-size:24px">⏰</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:#92400E">
              ${overdueLeads.length} lead membutuhkan follow-up hari ini!
            </div>
            <div style="font-size:11px;color:#B45309;margin-top:2px">
              ${overdueLeads.slice(0,3).map(l=>l.lead_name||l.company).join(', ')}
              ${overdueLeads.length>3?` +${overdueLeads.length-3} lainnya`:''}
            </div>
          </div>
          <span style="font-size:18px;color:#92400E">→</span>
        </div>`;
    }

  } catch(e) {
    console.error('Dashboard error:', e);
    const kpiEl = document.getElementById('dash-kpi');
    if (kpiEl) kpiEl.innerHTML = `<div class="status-box status-err">❌ ${e.message}</div>`;
  }
}
