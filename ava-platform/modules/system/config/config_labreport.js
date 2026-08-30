// ═══════════════════════════════════════════════════════════════
// MODULE: Setting Hasil PDF Laboratorium
// Mengatur kop, logo, kontak, akreditasi, tanda tangan, opsi & warna
// untuk output cetak (printLabReport). Disimpan di localStorage
// key 'ol_lab_report_cfg' (dibaca oleh labReportCfg() di lab/report.js).
// ═══════════════════════════════════════════════════════════════

function renderLabReportConfig(targetId = 'main-content'){
  const cfg = (typeof labReportCfg=== 'function') ? labReportCfg() : {};
  const g=(k,d)=> (cfg[k]!=null?cfg[k]:(d!=null?d:''));
  const chk=(k)=> cfg[k]?'checked':'';
  const isSettingsSub = targetId !== 'main-content';

  const headerHtml = isSettingsSub ? `
    <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <h2 style="font-size:16px; font-weight:800; color:var(--navy)">🖨️ Setting Hasil PDF</h2>
        <p style="font-size:12px; color:var(--text3)">Pengaturan kop, logo, tanda tangan, dan kustomisasi kertas cetak hasil laboratorium</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="previewLabReport()">Preview</button>
        <button class="btn btn-teal btn-sm" onclick="saveLabReportCfg()">Simpan</button>
      </div>
    </div>
  ` : `
    <div class="page-header">
      <div><h1>🖨️ Setting Hasil PDF</h1>
        <p>Kop surat, logo, kontak, akreditasi, tanda tangan &amp; opsi penyelarasan tata letak cetak hasil lab</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="previewLabReport()">Preview</button>
        <button class="btn btn-teal" onclick="saveLabReportCfg()">Simpan</button>
      </div>
    </div>
  `;

  document.getElementById(targetId).innerHTML = `
    ${headerHtml}

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));gap:16px;align-items:start">
      
      <!-- CARD 1: IDENTITAS LABORATORIUM -->
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
        <div class="form-group"><label>Logo Laboratorium</label>
          <div style="display:flex;gap:8px;align-items:center">
            <img id="lr-logo-prev" src="${g('logo_url')}" style="max-height:44px;max-width:120px;${g('logo_url')?'':'display:none'};border:1px solid var(--border);border-radius:6px;background:var(--white);object-fit:contain">
            <input type="file" id="lr-logo-file" accept="image/*" onchange="lrLogoUpload(this)" style="font-size:12px">
            ${g('logo_url')?`<button class="btn btn-ghost btn-xs" onclick="lrLogoClear()" style="color:var(--danger)">Hapus</button>`:''}
          </div>
          <input type="hidden" id="lr-logo" value="${g('logo_url')}">
          <div style="font-size:10.5px;color:var(--gray);margin-top:4px">PNG/JPG, disimpan sebagai data URI di browser.</div>
        </div>
      </div>

      <!-- CARD 2: TANDA TANGAN & OPTION -->
      <div class="card">
        <div style="font-size:11px;font-weight:800;color:var(--gray);text-transform:uppercase;margin-bottom:10px">Tanda Tangan &amp; Opsi Tampilan</div>
        
        <div style="background:var(--bg);padding:10px;border-radius:8px;margin-bottom:14px;border:1px solid var(--border)">
          <div style="font-weight:700;font-size:11.5px;margin-bottom:8px">Konfigurasi Tanda Tangan (Kolom):</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div>
              <label style="font-weight:600;font-size:11.5px;display:flex;align-items:center;gap:6px">
                <input type="checkbox" id="lr-show-s1" ${cfg.show_sign1 !== false ? 'checked' : ''}> Kolom 1 (Analis / Pemeriksa)
              </label>
              <div class="form-row" style="margin-top:4px">
                <div class="form-group" style="margin-bottom:0"><input id="lr-s1r" value="${g('sign1_role')}" placeholder="Peran, ex: Pemeriksa"></div>
                <div class="form-group" style="margin-bottom:0"><input id="lr-s1n" value="${g('sign1_name')}" placeholder="Nama (Opsional)"></div>
              </div>
            </div>
            <hr style="border:0;border-top:1px solid var(--border);margin:4px 0">
            <div>
              <label style="font-weight:600;font-size:11.5px;display:flex;align-items:center;gap:6px">
                <input type="checkbox" id="lr-show-s2" ${cfg.show_sign2 !== false ? 'checked' : ''}> Kolom 2 (Validator / Divalidasi oleh)
              </label>
              <div class="form-row" style="margin-top:4px">
                <div class="form-group" style="margin-bottom:0"><input id="lr-s2r" value="${g('sign2_role')}" placeholder="Peran, ex: Validator"></div>
                <div class="form-group" style="margin-bottom:0"><input id="lr-s2n" value="${g('sign2_name')}" placeholder="Nama (Opsional)"></div>
              </div>
            </div>
            <hr style="border:0;border-top:1px solid var(--border);margin:4px 0">
            <div>
              <label style="font-weight:600;font-size:11.5px;display:flex;align-items:center;gap:6px">
                <input type="checkbox" id="lr-show-s3" ${cfg.show_sign3 !== false ? 'checked' : ''}> Kolom 3 (Penanggung Jawab / Dokter PJ)
              </label>
              <div class="form-row" style="margin-top:4px">
                <div class="form-group" style="margin-bottom:0"><input id="lr-s3r" value="${g('sign3_role')}" placeholder="Peran, ex: Penanggung Jawab"></div>
                <div class="form-group" style="margin-bottom:0"><input id="lr-s3n" value="${g('sign3_name')}" placeholder="Nama (Opsional)"></div>
              </div>
            </div>
          </div>
        </div>

        <div style="font-size:11px;font-weight:800;color:var(--gray);text-transform:uppercase;margin:10px 0">Opsi Pewarnaan</div>
        <div class="form-row">
          <div class="form-group"><label>Ukuran Kertas</label>
            <select id="lr-paper" onchange="toggleCustomPaperSize()">${['A4','A5','Letter','Custom'].map(p=>`<option ${g('paper','A4')===p?'selected':''}>${p}</option>`).join('')}</select></div>
          <div class="form-group"><label>Warna Header</label><input type="color" id="lr-hc" value="${g('header_color','#0A2342')}" style="height:38px;padding:2px"></div>
          <div class="form-group"><label>Warna Aksen</label><input type="color" id="lr-ac" value="${g('accent_color','#00897B')}" style="height:38px;padding:2px"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
          <label style="font-weight:400"><input type="checkbox" id="lr-loinc" ${chk('show_loinc')}> Tampilkan kolom LOINC</label>
          <label style="font-weight:400"><input type="checkbox" id="lr-method" ${chk('show_method')}> Tampilkan metode pemeriksaan</label>
          <label style="font-weight:400"><input type="checkbox" id="lr-legend" ${cfg.show_flag_legend!==false?'checked':''}> Tampilkan legenda flag (H/L/kritis)</label>
        </div>
        <div class="form-group" style="margin-top:12px"><label>Catatan Kaki / Disclaimer</label>
          <textarea id="lr-footer" rows="2">${g('footer_note')}</textarea></div>
      </div>

      <!-- CARD 3: TEMPLATE BACKGROUND & ABSOLUTE OFFSETS -->
      <div class="card">
        <div style="font-size:11px;font-weight:800;color:var(--gray);text-transform:uppercase;margin-bottom:10px">Template Kertas &amp; Penyelarasan Layout</div>
        
        <div class="form-group" style="margin-bottom:12px"><label>Latar Belakang / Kertas Kop (Gambar / PDF Template)</label>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
            <img id="lr-bg-prev" src="${g('bg_image_url')}" style="max-height:60px;max-width:120px;${g('bg_image_url')?'':'display:none'};border:1px solid var(--border);border-radius:6px;background:var(--white);object-fit:contain">
            <input type="file" id="lr-bg-file" accept="image/*" onchange="lrBgUpload(this)" style="font-size:12px">
            ${g('bg_image_url')?`<button class="btn btn-ghost btn-xs" onclick="lrBgClear()" style="color:var(--danger)">Hapus Latar</button>`:''}
          </div>
          <input type="hidden" id="lr-bg-url" value="${g('bg_image_url')}">
          <div style="font-size:10.5px;color:var(--gray);line-height:1.3">Gunakan kertas kop kosong atau file layout. Format PNG/JPG, maks 800KB.</div>
        </div>

        <div id="custom-paper-row" class="form-row" style="${g('paper','A4')==='Custom'?'':'display:none'}">
          <div class="form-group"><label>Lebar Kertas</label><input id="lr-pw" value="${g('paper_width','210mm')}" placeholder="ex: 210mm atau 800px"></div>
          <div class="form-group"><label>Tinggi Kertas</label><input id="lr-ph" value="${g('paper_height','297mm')}" placeholder="ex: 297mm atau 1120px"></div>
        </div>

        <div class="form-row">
          <div class="form-group"><label>Margin Atas</label><input id="lr-mt" value="${g('margin_top','20mm')}"></div>
          <div class="form-group"><label>Margin Bawah</label><input id="lr-mb" value="${g('margin_bottom','20mm')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Margin Kiri</label><input id="lr-ml" value="${g('margin_left','15mm')}"></div>
          <div class="form-group"><label>Margin Kanan</label><input id="lr-mr" value="${g('margin_right','15mm')}"></div>
        </div>

        <div style="font-size:11px;font-weight:800;color:var(--gray);text-transform:uppercase;margin:14px 0 10px">Penyelarasan Letak Element (Absolute Offsets)</div>
        <div class="form-row">
          <div class="form-group"><label>Posisi Info Pasien Y</label><input id="lr-pinfo-y" value="${g('patient_info_y','55mm')}" placeholder="ex: 55mm atau 220px"></div>
          <div class="form-group"><label>Posisi Tabel Hasil Y</label><input id="lr-table-y" value="${g('table_y','90mm')}" placeholder="ex: 90mm atau 360px"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Posisi Tanda Tangan Y (Bottom)</label><input id="lr-sign-y" value="${g('signature_y','20mm')}" placeholder="ex: 20mm atau 80px"></div>
          <div class="form-group"><label>Ukuran Font Tabel</label><input id="lr-table-fs" value="${g('table_font_size','12px')}"></div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
          <label style="font-weight:400;display:flex;align-items:center;gap:6px">
            <input type="checkbox" id="lr-hide-hdr" ${chk('hide_default_header')}> Sembunyikan Kop Surat Default (Gunakan Kop di Gambar Latar)
          </label>
          <label style="font-weight:400;display:flex;align-items:center;gap:6px">
            <input type="checkbox" id="lr-hide-ftr" ${chk('hide_default_footer')}> Sembunyikan Footer / Disclaimer Default
          </label>
          <label style="font-weight:400;display:flex;align-items:center;gap:6px">
            <input type="checkbox" id="lr-show-code" ${chk('show_test_code')}> Tampilkan Kode Item internal samping nama tes
          </label>
        </div>
      </div>

    </div>`;
}

function toggleCustomPaperSize() {
  const p = document.getElementById('lr-paper')?.value;
  const row = document.getElementById('custom-paper-row');
  if (row) row.style.display = p === 'Custom' ? '' : 'none';
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

function lrBgUpload(input){
  const f=input.files?.[0]; if(!f) return;
  if(f.size>800000){ toast('Gambar latar terlalu besar (maks 800KB)','warn'); return; }
  const rd=new FileReader();
  rd.onload=e=>{ 
    document.getElementById('lr-bg-url').value=e.target.result;
    const p=document.getElementById('lr-bg-prev'); if(p) { p.src=e.target.result; p.style.display=''; }
    toast('✅ Gambar latar berhasil dimuat','ok');
  };
  rd.readAsDataURL(f);
}
function lrBgClear(){ 
  document.getElementById('lr-bg-url').value=''; 
  const p=document.getElementById('lr-bg-prev'); if(p){p.src='';p.style.display='none';}
  toast('Gambar latar dihapus','info');
}

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
    show_sign1:c('lr-show-s1'), show_sign2:c('lr-show-s2'), show_sign3:c('lr-show-s3'),

    // Layout
    bg_image_url:v('lr-bg-url'),
    paper_width:v('lr-pw'),
    paper_height:v('lr-ph'),
    margin_top:v('lr-mt'),
    margin_bottom:v('lr-mb'),
    margin_left:v('lr-ml'),
    margin_right:v('lr-mr'),
    hide_default_header:c('lr-hide-hdr'),
    hide_default_footer:c('lr-hide-ftr'),
    patient_info_y:v('lr-pinfo-y'),
    table_y:v('lr-table-y'),
    table_font_size:v('lr-table-fs'),
    show_test_code:c('lr-show-code'),
    signature_y:v('lr-sign-y'),
  };
}

function saveLabReportCfg(){
  const cfg=collectLabReportCfg();
  if(!cfg.org_name.trim()){ toast('Nama laboratorium wajib','err'); return; }
  localStorage.setItem('ol_lab_report_cfg', JSON.stringify(cfg));
  // kompatibilitas
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