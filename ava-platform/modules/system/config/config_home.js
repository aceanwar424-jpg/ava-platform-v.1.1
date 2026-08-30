// ═══════════════════════════════════════════════════════════════
// MODULE: Configuration Home — landing kartu berkelompok (ala Virtu)
// ═══════════════════════════════════════════════════════════════
const CONFIG_GROUPS = [
  { icon:'🧬', title:'Master Laboratorium', desc:'Tes, analit, rujukan, alat', items:[
    { label:'Master Tes / Produk', page:'product' },
    { label:'Reference Range', page:'refrange' },
    { label:'Package & Panel', page:'package' },
    { label:'Master Alat (Analyzer)', action:"navigate('lab',{tab:'qc'})" },
  ]},
  { icon:'🏢', title:'Master Data', desc:'Korporat & keluarga', items:[
    { label:'Corporate', page:'corporate' },
    { label:'Family Registry', page:'family' },
  ]},
  { icon:'🖨️', title:'Output & Setting', desc:'Hasil PDF, pengaturan, user', items:[
    { label:'Setting Hasil PDF', page:'labreport' },
    { label:'Pengaturan Umum', page:'settings' },
    { label:'User Management', page:'users' },
  ]},
  { icon:'', title:'Data Tools', desc:'Impor massal', items:[
    { label:'Bulk Upload (Import Excel/CSV)', page:'import' },
  ]},
];

function renderConfigHome(targetId = 'main-content'){
  const isSettingsSub = targetId !== 'main-content';

  const headerHtml = isSettingsSub ? `
    <div style="margin-bottom: 16px;">
      <h2 style="font-size:16px; font-weight:800; color:var(--navy)">🗄️ Master Data Hub</h2>
      <p style="font-size:12px; color:var(--text3)">Pusat konfigurasi master data &amp; pengaturan sistem</p>
    </div>
  ` : `
    <div class="page-header">
      <div><h1>Configuration</h1><p>Pusat konfigurasi master data &amp; pengaturan sistem</p></div>
    </div>
  `;

  document.getElementById(targetId).innerHTML = `
    ${headerHtml}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
      ${CONFIG_GROUPS.map(g=>`
        <div class="card" style="border-top:3px solid var(--teal)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <span style="font-size:22px">${g.icon}</span>
            <div><div style="font-weight:800;color:var(--navy)">${g.title}</div>
              <div style="font-size:10.5px;color:var(--text3)">${g.desc}</div></div>
          </div>
          <div style="border-top:1px solid var(--border);margin:8px 0;"></div>
          <div style="display:flex;flex-direction:column;gap:3px">
            ${g.items.map(it=>`<button class="btn btn-ghost btn-sm" style="justify-content:flex-start;text-align:left;font-weight:600"
              onclick="${it.action||`navigate('${it.page}')`}">▸ ${it.label}</button>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}