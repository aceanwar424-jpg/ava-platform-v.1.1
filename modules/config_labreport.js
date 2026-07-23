// ═══════════════════════════════════════════════════════════════
// MODULE: Setting Hasil PDF Laboratorium
// Mengatur kop, logo, kontak, akreditasi, tanda tangan, opsi & warna
// untuk output cetak (printLabReport). Disimpan di localStorage
// key 'ol_lab_report_cfg' (dibaca oleh labReportCfg() di lab/report.js).
// ═══════════════════════════════════════════════════════════════

function renderLabReportConfig(){
  const cfg = (typeof labReportCfg==='function') ? labReportCfg() : {};
  const g=(k,d)=> (cfg[k]!=null?cfg[k]:(d!=null?d:''));
  const chk=(k)=> cfg[k]?'checked':'';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>🖨️ Setting Hasil PDF</h1>
        <p>Kop surat, logo, kontak, akreditasi, tanda tangan &amp; opsi untuk cetak hasil lab</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="previewLabReport()">Preview</button>
        <button class="btn btn-teal" onclick="saveLabReportCfg()">Simpan</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
      <div class="card">
        <div style="font-size:11px;font-weight:800;color:var(--gray);text-transform:uppercase;margin-bottom:10px">Identitas Laboratorium (Kop)</div>
        <div class="form-group"><label>Nama Laboratorium *</label><input id="lr-org" value="${g('org_name')}"></div>
        <div class="form-group"><label>Alamat</label><textarea id="lr-addr" rows="2">${g('address')}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Telepon</label><input id="lr-phone" value="${g('phone')}"></div>
          <div class="form-group"><label>Email</label><input id="lr-email" value="${g('email')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Website</label><input id="lr-web" value="${g('website')}"></div>
          <div class="form-group"><label>Akreditasi</label><input id="lr-acc" value="${g('accreditation')}" placeholder="Terakreditasi KAN ISO 15189"></div>
        </div>
        <div class="form-group"><label>Logo</label>
          <div style="display:flex;gap:8px;align-items:center">
            <img id="lr-logo-prev" src="${g('logo_url')}" style="max-height:44px;max-width:120px;${g('logo_url')?'':'display:none'};border:1px solid var(--border);border-radius:6px;background:#fff">
            <input type="file" id="lr-logo-file" accept="image/*" onchange="lrLogoUpload(this)" style="font-size:12px">
            ${g('logo_url')?`<button class="btn btn-ghost btn-xs" onclick="lrLogoClear()" style="color:#EF4444">Hapus</button>`:''}
          </div>
          <input type="hidden" id="lr-logo" value="${g('logo_url')}">
          <div style="font-size:10.5px;color:var(--gray);margin-top:4px">PNG/JPG, disimpan sebagai data URI di browser.</div>
        </div>
      </div>

      <div class="card">
        <div style="font-size:11px;font-weight:800;color:var(--gray);text-transform:uppercase;margin-bottom:10px">Tanda Tangan</div>
        <div class="form-row">
          <div class="form-group"><label>Peran 1</label><input id="lr-s1r" value="${g('sign1_role')}"></div>
          <div class="form-group"><label>Nama 1 (opsional)</label><input id="lr-s1n" value="${g('sign1_name')}" placeholder="otomatis dari analis"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Peran 2</label><input id="lr-s2r" value="${g('sign2_role')}"></div>
          <div class="form-group"><label>Nama 2 (opsional)</label><input id="lr-s2n" value="${g('sign2_name')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Peran 3</label><input id="lr-s3r" value="${g('sign3_role')}"></div>
          <div class="form-group"><label>Nama 3 (opsional)</label><input id="lr-s3n" value="${g('sign3_name')}"></div>
        </div>

        <div style="font-size:11px;font-weight:800;color:var(--gray);text-transform:uppercase;margin:14px 0 10px">Opsi &amp; Tampilan</div>
        <div class="form-row">
          <div class="form-group"><label>Ukuran Kertas</label>
            <select id="lr-paper">${['A4','A5','Letter'].map(p=>`<option ${g('paper','A4')===p?'selected':''}>${p}</option>`).join('')}</select></div>
          <div class="form-group"><label>Warna Header</label><input type="color" id="lr-hc" value="${g('header_color','#0A2342')}" style="height:38px;padding:2px"></div>
          <div class="form-group"><label>Warna Aksen</label><input type="color" id="lr-ac" value="${g('accent_color','#00897B')}" style="height:38px;padding:2px"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
          <label style="font-weight:400"><input type="checkbox" id="lr-loinc" ${chk('show_loinc')}> Tampilkan kolom LOINC</label>
          <label style="font-weight:400"><input type="checkbox" id="lr-method" ${chk('show_method')}> Tampilkan metode pemeriksaan</label>
          <label style="font-weight:400"><input type="checkbox" id="lr-legend" ${cfg.show_flag_legend!==false?'checked':''}> Tampilkan legenda flag (H/L/kritis)</label>
        </div>
        <div class="form-group" style="margin-top:12px"><label>Catatan Kaki / Disclaimer</label>
          <textarea id="lr-footer" rows="3">${g('footer_note')}</textarea></div>
      </div>
    </div>`;
}

function lrLogoUpload(input){
  const f=input.files?.[0]; if(!f) return;
  if(f.size>500000){ toast('Logo terlalu besar (maks 500KB)','warn'); return; }
  const rd=new FileReader();
  rd.onload=e=>{ document.getElementById('lr-logo').value=e.target.result;
    const p=document.getElementById('lr-logo-prev'); p.src=e.target.result; p.style.display=''; };
  rd.readAsDataURL(f);
}
function lrLogoClear(){ document.getElementById('lr-logo').value=''; const p=document.getElementById('lr-logo-prev'); if(p){p.src='';p.style.display='none';} }

function collectLabReportCfg(){
  const v=id=>document.getElementById(id)?.value||'';
  const c=id=>!!document.getElementById(id)?.checked;
  return {
    org_name:v('lr-org'), address:v('lr-addr'), phone:v('lr-phone'), email:v('lr-email'),
    website:v('lr-web'), accreditation:v('lr-acc'), logo_url:v('lr-logo'),
    header_color:v('lr-hc'), accent_color:v('lr-ac'), paper:v('lr-paper'),
    footer_note:v('lr-footer'),
    show_loinc:c('lr-loinc'), show_method:c('lr-method'), show_flag_legend:c('lr-legend'),
    sign1_role:v('lr-s1r'), sign1_name:v('lr-s1n'),
    sign2_role:v('lr-s2r'), sign2_name:v('lr-s2n'),
    sign3_role:v('lr-s3r'), sign3_name:v('lr-s3n'),
  };
}

function saveLabReportCfg(){
  const cfg=collectLabReportCfg();
  if(!cfg.org_name.trim()){ toast('Nama laboratorium wajib','err'); return; }
  localStorage.setItem('ol_lab_report_cfg', JSON.stringify(cfg));
  // kompat lama
  localStorage.setItem('ol_org_name', cfg.org_name);
  localStorage.setItem('ol_org_addr', cfg.address);
  toast('✅ Setting hasil PDF tersimpan','ok');
}

function previewLabReport(){
  saveLabReportCfg();
  const sample=[
    {product_name:'Darah Lengkap', item_name:'Hemoglobin (HB)', result_value:'14.2', unit:'g/dL', result_numeric:14.2, normal_min:13, normal_max:17, color_code:'green', interpretation:'Normal', loinc_code:'718-7', method:'SLS', _cat:'HEMATOLOGI', entered_by:'Analis Contoh', validated_by:'Validator Contoh', approved_by:'dr. Contoh, Sp.PK', mr_number:'MR-000123', visit_number:'VISIT-CONTOH-001'},
    {product_name:'Darah Lengkap', item_name:'Leukosit (WBC)', result_value:'12.8', unit:'10^3/µL', result_numeric:12.8, normal_min:4, normal_max:11, color_code:'red', interpretation:'Tinggi', loinc_code:'6690-2', method:'Flow', _cat:'HEMATOLOGI'},
    {product_name:'Darah Lengkap', item_name:'Trombosit (PLT)', result_value:'250', unit:'10^3/µL', result_numeric:250, normal_min:150, normal_max:450, color_code:'green', interpretation:'Normal', loinc_code:'777-3', _cat:'HEMATOLOGI'},
    {product_name:'Glukosa Darah Puasa', result_value:'135', unit:'mg/dL', result_numeric:135, normal_min:70, normal_max:99, color_code:'yellow', interpretation:'Prediabetik', loinc_code:'1558-6', method:'Hexokinase', _cat:'KIMIA KLINIK'},
  ];
  if(typeof printLabReport==='function') printLabReport('CONTOH PASIEN', 'VISIT-CONTOH-001', sample);
  else toast('Modul cetak lab belum termuat','warn');
}