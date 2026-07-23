// ═══════════════════════════════════════════════════════════════
// MODULE: Family Registry — Membership Keluarga & Skema Diskon
// Dipakai oleh Registrasi Klinik untuk diskon "Family Member".
// Tabel: families, family_members (lihat supabase_registration_discount.sql)
// ═══════════════════════════════════════════════════════════════

let famAll=[], famSearch='';

async function renderConfigFamily(){
  document.getElementById('main-content').innerHTML=`
    <div class="page-header">
      <div><h1>👨‍👩‍👧 Family Registry</h1>
        <p>Data keluarga & anggota untuk skema diskon Family Member di registrasi klinik</p></div>
      <div class="btn-row">
        <button class="btn btn-teal" onclick="openFamilyForm()">+ Keluarga Baru</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <input class="table-search" id="fam-q" placeholder="Cari nama keluarga / PIC / kode..." oninput="famSearch=this.value;renderFamilyList()" style="flex:1">
    </div>
    <div id="fam-list"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await loadFamilies();
}

async function loadFamilies(){
  try {
    famAll=await sbGet('families','select=*&order=created_at.desc')||[];
    // hitung jumlah anggota
    const counts=await sbGet('family_members','select=family_id').catch(()=>[]);
    const byFam={}; (counts||[]).forEach(m=>byFam[m.family_id]=(byFam[m.family_id]||0)+1);
    famAll.forEach(f=>f._members=byFam[f.id]||0);
    renderFamilyList();
  } catch(e){
    document.getElementById('fam-list').innerHTML=`<div class="status-box status-err" style="margin:16px">
      ❌ ${e.message}<br><span style="font-size:12px">Jalankan <code>supabase_registration_discount.sql</code> dulu.</span></div>`;
  }
}

function famDiscLabel(f){
  if(!f.discount_value) return '—';
  return f.discount_type==='fixed'?formatCurrency(f.discount_value):`${f.discount_value}%`;
}

function renderFamilyList(){
  const el=document.getElementById('fam-list'); if(!el) return;
  const q=famSearch.toLowerCase();
  const data=famAll.filter(f=>!q||`${f.family_name} ${f.pic_name||''} ${f.family_code||''}`.toLowerCase().includes(q));
  if(!data.length){ el.innerHTML=`<div class="empty-state"><div class="ico">👨‍👩‍👧</div>
    <h3>${famAll.length?'Tidak ada hasil':'Belum ada data keluarga'}</h3>
    <button class="btn btn-teal" style="margin-top:12px" onclick="openFamilyForm()">+ Keluarga Baru</button></div>`; return; }

  el.innerHTML=`<div class="table-wrap"><table><thead><tr>
    <th>Kode</th><th>Nama Keluarga</th><th>PIC</th><th>Anggota</th><th>Diskon</th><th>Berlaku s/d</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
  ${data.map(f=>{
    const st=f.status==='Aktif'?'#22C55E':'#94A3B8';
    return `<tr>
      <td style="font-family:monospace;font-size:11px;font-weight:700">${f.family_code||'—'}</td>
      <td><div style="font-weight:600">${f.family_name}</div>
          <div style="font-size:10px;color:var(--gray)">${f.membership_no?'No. '+f.membership_no:''}</div></td>
      <td style="font-size:12px">${f.pic_name||'—'}<div style="font-size:10px;color:var(--gray)">${f.pic_phone||''}</div></td>
      <td><button class="btn btn-ghost btn-xs" onclick="openFamilyMembers(${f.id})">${f._members||0} anggota</button></td>
      <td style="font-weight:700;color:var(--teal)">${famDiscLabel(f)}</td>
      <td style="font-size:12px;color:var(--gray)">${f.valid_until?new Date(f.valid_until).toLocaleDateString('id-ID'):'—'}</td>
      <td><span style="background:${st}20;color:${st};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${f.status||'—'}</span></td>
      <td><div class="act-row">
        <button class="act-btn edit" onclick="openFamilyForm(${f.id})">${icon('edit', 12)}</button>
        <button class="act-btn del" onclick="deleteFamily(${f.id})">${icon('trash', 12)}</button>
      </div></td>
    </tr>`;
  }).join('')}
  </tbody></table></div>`;
}

async function openFamilyForm(id=null){
  let f={};
  if(id){ const d=await sbGet('families',`select=*&id=eq.${id}`); f=d[0]||{}; }
  const code=id?(f.family_code||''):`FAM-${Date.now().toString().slice(-6)}`;
  openModal(`
    <div class="modal-header"><div class="modal-title">${id?'Edit':'+'} Keluarga</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div class="form-row">
      <div class="form-group"><label>Kode Keluarga</label><input id="ff-code" value="${code}" ${id?'readonly style="background:var(--lgray)"':''}></div>
      <div class="form-group" style="grid-column:2/-1"><label>Nama Keluarga *</label><input id="ff-name" value="${f.family_name||''}" placeholder="Keluarga Budi Santoso"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>PIC / Kepala Keluarga</label><input id="ff-pic" value="${f.pic_name||''}"></div>
      <div class="form-group"><label>No. HP PIC</label><input id="ff-phone" value="${f.pic_phone||''}"></div>
      <div class="form-group"><label>No. Membership</label><input id="ff-memno" value="${f.membership_no||''}"></div>
    </div>
    <div class="form-group"><label>Alamat</label><textarea id="ff-addr" rows="2">${f.address||''}</textarea></div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:6px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">Skema Diskon Anggota</div>
      <div class="form-row">
        <div class="form-group"><label>Tipe Diskon</label>
          <select id="ff-disctype"><option value="percent" ${f.discount_type!=='fixed'?'selected':''}>Persen (%)</option><option value="fixed" ${f.discount_type==='fixed'?'selected':''}>Nominal (Rp)</option></select></div>
        <div class="form-group"><label>Nilai Diskon</label><input type="number" id="ff-discval" value="${f.discount_value||0}" step="any"></div>
        <div class="form-group"><label>Berlaku s/d</label><input type="date" id="ff-valid" value="${f.valid_until||''}"></div>
        <div class="form-group"><label>Status</label>
          <select id="ff-status"><option ${f.status!=='Non-Aktif'?'selected':''}>Aktif</option><option ${f.status==='Non-Aktif'?'selected':''}>Non-Aktif</option></select></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveFamily(${id||'null'})">Simpan</button>
    </div>`,'wide');
}

async function saveFamily(id){
  const name=document.getElementById('ff-name').value.trim();
  if(!name){ toast('Nama keluarga wajib','err'); return; }
  const payload={
    family_code:document.getElementById('ff-code').value.trim()||null,
    family_name:name,
    pic_name:document.getElementById('ff-pic').value.trim()||null,
    pic_phone:document.getElementById('ff-phone').value.trim()||null,
    membership_no:document.getElementById('ff-memno').value.trim()||null,
    address:document.getElementById('ff-addr').value.trim()||null,
    discount_type:document.getElementById('ff-disctype').value,
    discount_value:parseFloat(document.getElementById('ff-discval').value)||0,
    valid_until:document.getElementById('ff-valid').value||null,
    status:document.getElementById('ff-status').value,
    updated_at:new Date().toISOString(),
  };
  try {
    if(id) await sbPatch('families',id,payload);
    else { payload.created_by=getUserName?getUserName():'User'; await sbPost('families',payload); }
    toast('✅ Keluarga tersimpan','ok'); closeModalForce(); loadFamilies();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function deleteFamily(id){
  if(!confirm('Hapus keluarga ini beserta anggotanya?')) return;
  try { await sbDelete('families',id); toast('Terhapus','warn'); loadFamilies(); }
  catch(e){ toast('❌ '+e.message,'err'); }
}

// ── Anggota keluarga ─────────────────────────────────────────────
async function openFamilyMembers(familyId){
  const fam=famAll.find(f=>f.id==familyId)||{};
  let members=[];
  try { members=await sbGet('family_members',`select=*&family_id=eq.${familyId}&order=is_primary.desc,id.asc`)||[]; } catch(e){}
  openModal(`
    <div class="modal-header"><div class="modal-title">Anggota — ${fam.family_name||''}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn btn-teal btn-sm" onclick="openMemberForm(${familyId})">+ Tambah Anggota</button></div>
    <div class="table-wrap"><table><thead><tr>
      <th>Nama</th><th>Hubungan</th><th>Gender</th><th>Tgl Lahir</th><th>HP</th><th>Aksi</th>
    </tr></thead><tbody>
    ${members.length?members.map(m=>`<tr>
      <td style="font-weight:600">${m.is_primary?'':''}${m.member_name}</td>
      <td style="font-size:12px">${m.relationship||'—'}</td>
      <td style="font-size:12px">${m.gender==='F'?'Perempuan':m.gender==='M'?'Laki-laki':'—'}</td>
      <td style="font-size:12px;color:var(--gray)">${m.birth_date?new Date(m.birth_date).toLocaleDateString('id-ID'):'—'}</td>
      <td style="font-size:12px">${m.phone||'—'}</td>
      <td><div class="act-row">
        <button class="act-btn edit" onclick="openMemberForm(${familyId},${m.id})">${icon('edit', 12)}</button>
        <button class="act-btn del" onclick="deleteMember(${m.id},${familyId})">${icon('trash', 12)}</button>
      </div></td>
    </tr>`).join(''):`<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--gray)">Belum ada anggota</td></tr>`}
    </tbody></table></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`,'wide');
}

async function openMemberForm(familyId, memberId=null){
  const fam=famAll.find(f=>f.id==familyId)||{};
  let m={};
  if(memberId){ const d=await sbGet('family_members',`select=*&id=eq.${memberId}`); m=d[0]||{}; }
  openModal(`
    <div class="modal-header"><div class="modal-title">${memberId?'Edit':'+'} Anggota — ${fam.family_name||''}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label>Nama Anggota *</label><input id="fm-name" value="${m.member_name||''}"></div>
      <div class="form-group"><label>Hubungan</label>
        <select id="fm-rel">${['Kepala Keluarga','Istri','Suami','Anak','Orang Tua','Saudara','Lainnya'].map(r=>`<option ${m.relationship===r?'selected':''}>${r}</option>`).join('')}</select></div>
      <div class="form-group"><label>Gender</label>
        <select id="fm-gender"><option value="M" ${m.gender==='M'?'selected':''}>Laki-laki</option><option value="F" ${m.gender==='F'?'selected':''}>Perempuan</option></select></div>
      <div class="form-group"><label>Tgl Lahir</label><input type="date" id="fm-dob" value="${m.birth_date||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>NIK</label><input id="fm-nik" value="${m.id_number||''}"></div>
      <div class="form-group"><label>No. HP</label><input id="fm-phone" value="${m.phone||''}"></div>
      <div class="form-group"><label><input type="checkbox" id="fm-primary" ${m.is_primary?'checked':''}> Anggota utama</label></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="openFamilyMembers(${familyId})">← Kembali</button>
      <button class="btn btn-teal" onclick="saveMember(${familyId},${memberId||'null'})">Simpan</button>
    </div>`,'wide');
}

async function saveMember(familyId, memberId){
  const name=document.getElementById('fm-name').value.trim();
  if(!name){ toast('Nama anggota wajib','err'); return; }
  const fam=famAll.find(f=>f.id==familyId)||{};
  const payload={
    family_id:familyId, family_name:fam.family_name||null, member_name:name,
    relationship:document.getElementById('fm-rel').value,
    gender:document.getElementById('fm-gender').value,
    birth_date:document.getElementById('fm-dob').value||null,
    id_number:document.getElementById('fm-nik').value.trim()||null,
    phone:document.getElementById('fm-phone').value.trim()||null,
    is_primary:document.getElementById('fm-primary').checked,
  };
  try {
    if(memberId) await sbPatch('family_members',memberId,payload);
    else await sbPost('family_members',payload);
    toast('✅ Anggota tersimpan','ok');
    openFamilyMembers(familyId);
    loadFamilies();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function deleteMember(memberId, familyId){
  if(!confirm('Hapus anggota ini?')) return;
  try { await sbDelete('family_members',memberId); toast('Terhapus','warn'); openFamilyMembers(familyId); loadFamilies(); }
  catch(e){ toast('❌ '+e.message,'err'); }
}