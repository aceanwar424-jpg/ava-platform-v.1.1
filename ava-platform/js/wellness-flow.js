// OWNED_BY: generic. Shared external portal/HIS workflow; permissions enforced by RPC.
(function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = value => value ? new Date(value).toLocaleString('id-ID') : 'Belum dijadwalkan';
  const tierLabel = ['Belum dapat dinilai', 'L1 · Pemantauan rutin', 'L2 · Perhatian', 'L3 · Risiko tinggi', 'L4 · Risiko sangat tinggi'];
  const states = {pending:'Diminta',accepted:'Diterima admin',in_progress:'Sedang berjalan',completed:'Selesai',cancelled:'Dibatalkan',scheduled:'Terjadwal',reported:'Sudah dilaporkan'};
  const attendance = {present:'Hadir',late:'Terlambat',absent:'Tidak hadir',excused:'Izin'};
  const adherence = {followed:'Mengikuti arahan',partial:'Sebagian mengikuti',not_followed:'Tidak mengikuti',not_assessed:'Belum dapat dinilai'};
  const treatments = {konsultasi_dokter:'Konsultasi dokter',followup_ihc:'Pemeriksaan lanjutan',program_diet:'Diet & nutrisi',program_olahraga:'Olahraga terstruktur',monitoring_ketat:'Pemantauan berkala',psikologis:'Pendampingan psikologis',rehab_gaya_hidup:'Pendampingan gaya hidup',tindak_darurat:'Rujukan fasilitas kesehatan'};
  const call = (name,args={}) => sbRpc(name,args);
  const options = map => Object.entries(map).map(([v,l])=>`<option value="${escape(v)}">${escape(l)}</option>`).join('');
  const badge = tier => `<span class="wf-tier wf-tier-${Number(tier)||0}">${escape(tierLabel[tier] || 'Menunggu persetujuan')}</span>`;
  const button = (action,id,label) => `<button type="button" data-action="${action}" data-id="${escape(id)}">${label}</button>`;
  function dialog(title,body) {
    document.querySelector('#wf-dialog')?.remove();
    const d=document.createElement('dialog'); d.id='wf-dialog'; d.className='wf-dialog wf';
    d.innerHTML=`<header><h2>${escape(title)}</h2><button type="button" data-close aria-label="Tutup">×</button></header>${body}<p class="wf-error" role="alert"></p>`;
    d.querySelector('[data-close]').onclick=()=>d.close();
    d.addEventListener('close',()=>d.remove()); document.body.appendChild(d); d.showModal(); return d;
  }
  function submit(d,handler) {
    d.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault(); const b=event.submitter; if(b.disabled)return; b.disabled=true;
      d.querySelector('.wf-error').textContent='';
      try { await handler(Object.fromEntries(new FormData(event.target))); d.close(); }
      catch(e){d.querySelector('.wf-error').textContent=e.message || 'Penyimpanan gagal. Coba lagi.';}
      finally { b.disabled=false; }
    });
  }
  function sessionHtml(s) {
    return `<article class="wf-session"><strong>Sesi ${escape(s.session_no)} · ${escape(time(s.scheduled_at))}</strong>
      <p>${escape(states[s.status]||s.status)}${s.attendance?' · '+escape(attendance[s.attendance]):''}${s.adherence?' · '+escape(adherence[s.adherence]):''}</p>
      ${s.report?`<p class="wf-report">${escape(s.report)}</p>`:''}${s.follow_up?`<p>Tindak lanjut: ${escape(s.follow_up)}</p>`:''}
      ${s.reported_at?`<small>Dilaporkan ${escape(time(s.reported_at))}</small>`:''}</article>`;
  }
  function requestHtml(t,canExecute=false) {
    const sessions=t.sessions||[]; const reported=sessions.filter(s=>s.status==='reported');
    const attended=reported.filter(s=>['present','late'].includes(s.attendance)).length;
    const open=!['completed','cancelled'].includes(t.status);
    return `<article class="wf-request"><header><div><strong>${escape(t.treatment_label)}</strong><p>${escape(t.participant_name||'')} · ${escape(states[t.status]||t.status)}</p></div>${badge(t.risk_tier)}</header>
      <small>Level saat request · ${escape(time(t.created_at))}</small>
      <p>${escape(t.notes||'')} ${t.scheduled_at?' · Usulan jadwal: '+escape(time(t.scheduled_at)):''}</p>
      <p>${reported.length} sesi dilaporkan · ${attended} hadir/terlambat · ${reported.filter(s=>s.attendance==='absent').length} tidak hadir · ${reported.filter(s=>s.attendance==='excused').length} izin</p>
      ${sessions.map(s=>sessionHtml(s)+(canExecute&&open&&s.status==='scheduled'?`<div class="wf-actions">${button('report',s.id,'Laporan sesi '+escape(s.session_no))}${button('reschedule',s.id,'Ubah jadwal')}${button('cancel_session',s.id,'Batalkan sesi')}</div>`:'')).join('')}
      ${t.closure_report?`<p class="wf-report"><strong>Kesimpulan:</strong> ${escape(t.closure_report)}</p>`:''}
      ${canExecute&&open?`<div class="wf-actions">${t.status==='pending'?button('accept',t.id,'Terima request'):button('schedule',t.id,'Jadwalkan sesi')+button('complete',t.id,'Selesaikan treatment')}${button('cancel',t.id,'Batalkan')}</div>`:''}</article>`;
  }
  async function history(enrollmentId,offset=0,d=null) {
    if(!d)d=dialog('Riwayat peserta','<div data-history>Memuat riwayat…</div>');
    try {
      const data=await call('wellness_participant_detail',{p_enrollment_id:enrollmentId,p_offset:offset});
      const container=d.querySelector('[data-history]');
      container.innerHTML=`<h3>Hasil pemeriksaan</h3><div class="wf-scroll"><table><thead><tr><th>Waktu</th><th>Pemeriksaan</th><th>Hasil</th><th>Konteks & sumber</th></tr></thead><tbody>${(data.observations||[]).map(o=>`<tr><td>${escape(time(o.measured_at))}</td><td>${escape(o.code)}</td><td>${escape(o.value)} ${escape(o.unit)}</td><td>${escape(o.measurement_context||'—')} · ${escape(o.source)} · ${escape(o.verification_status)}</td></tr>`).join('')||'<tr><td colspan="4">Belum ada hasil.</td></tr>'}</tbody></table></div>
      <div class="wf-actions">${offset?button('prev',enrollmentId,'Sebelumnya'):''}<span>${Math.min(offset+1,data.total||0)}–${Math.min(offset+100,data.total||0)} dari ${data.total||0} hasil</span>${offset+100<data.total?button('next',enrollmentId,'Berikutnya'):''}</div>
      <h3>Treatment & laporan sesi</h3>${(data.requests||[]).map(t=>requestHtml(t)).join('')||'<p>Belum ada treatment.</p>'}`;
      container.querySelector('[data-action="prev"]')?.addEventListener('click',()=>history(enrollmentId,Math.max(0,offset-100),d));
      container.querySelector('[data-action="next"]')?.addEventListener('click',()=>history(enrollmentId,offset+100,d));
    } catch(e){d.querySelector('.wf-error').textContent=e.message;}
  }
  async function workspace(target,programId) {
    const loadId=String(Number(target.dataset.wfLoad||0)+1);target.dataset.wfLoad=loadId;
    target.classList.add('wf'); target.innerHTML='<p role="status">Memuat peserta dan treatment…</p>';
    let data;
    try {data=await call('wellness_program_workspace',{p_program_id:programId});}
    catch(e){if(target.dataset.wfLoad===loadId)target.innerHTML=`<p class="wf-error" role="alert">${escape(e.message)}</p><p>Hubungi pengelola jika data tetap belum dapat dimuat.</p>`;return;}
    if(!target.isConnected||target.dataset.wfLoad!==loadId)return;
    const participants=data.tiers||[], requests=data.requests||[], canExecute=data.can_execute===true;
    target.innerHTML=`<header><div><h3>Peserta & level terbaru</h3><p>Level operasional v1, bukan diagnosis. Hasil nonpuasa perlu tinjauan petugas; tanggal dan sumber tetap terlihat.</p></div>${button('refresh','','Perbarui')}</header>
      <div class="wf-filters"><label>Cari peserta<input data-search type="search" placeholder="Nama atau ID karyawan"></label><label>Level<select data-tier><option value="all">Semua level</option>${tierLabel.map((l,i)=>`<option value="${i}">${escape(l)}</option>`).join('')}<option value="pending">Menunggu persetujuan</option></select></label></div>
      <div class="wf-summary">${tierLabel.map((l,i)=>`<span>${badge(i)} <b>${participants.filter(p=>p.processing_allowed&&p.risk_tier===i).length}</b></span>`).join('')}</div>
      <p data-count></p><div class="wf-scroll"><table><thead><tr><th>Pilih</th><th>Peserta</th><th>Level terbaru</th><th>Hasil terbaru</th><th>Riwayat</th></tr></thead><tbody data-participants></tbody></table></div>
      <div class="wf-actions">${button('select','','Pilih yang terlihat')}${button('clear','','Hapus pilihan')}${button('request','','Request treatment untuk pilihan')}</div>
      <h3>Permintaan & pelaksanaan treatment</h3><p>${canExecute?'Admin HIS menerima, menjadwalkan, dan melaporkan sesi.':'Pelaksanaan dan laporan sesi dikelola admin HIS. Anda dapat mengevaluasi progres di sini.'}</p>
      <div class="wf-actions">${button('export','','Unduh laporan sesi CSV')}<span>${requests.filter(t=>t.status==='pending').length} request menunggu · ${requests.flatMap(t=>t.sessions||[]).filter(s=>s.status==='scheduled'&&new Date(s.scheduled_at)<new Date()).length} sesi lewat jadwal, belum dilaporkan</span></div>
      <div data-requests>${requests.map(t=>requestHtml(t,canExecute)).join('')||'<p>Belum ada permintaan treatment.</p>'}</div>
      ${canExecute?`<details><summary>Akses pemasok hasil IHC</summary><p>Akun IHC hanya mengirim hasil untuk program yang diberikan.</p><ul>${(data.providers||[]).map(p=>`<li>${escape(p.user_id)} · ${p.active?'Aktif':'Nonaktif'} ${button(p.active?'revoke-provider':'grant-provider',p.user_id,p.active?'Cabut':'Aktifkan')}</li>`).join('')}</ul>${button('provider','','Tambahkan akun IHC')}</details>`:''}<p class="wf-error" data-error role="alert"></p>`;
    const selected=new Set();
    function renderRows(){
      const search=target.querySelector('[data-search]').value.toLowerCase(),level=target.querySelector('[data-tier]').value;
      const rows=participants.filter(p=>`${p.participant_name} ${p.employee_code}`.toLowerCase().includes(search)&&
        (level==='all'||(level==='pending'?!p.processing_allowed:p.processing_allowed&&String(p.risk_tier)===level)));
      target.querySelector('[data-count]').textContent=`${rows.length} dari ${participants.length} peserta · ${selected.size} dipilih`;
      target.querySelector('[data-participants]').innerHTML=rows.map(p=>`<tr><td><input type="checkbox" data-enrollment="${escape(p.enrollment_id)}" aria-label="Pilih ${escape(p.participant_name)}" ${selected.has(p.enrollment_id)?'checked':''} ${p.processing_allowed?'':'disabled'}></td>
      <td><strong>${escape(p.participant_name)}</strong><br>${escape(p.employee_code)}<br><small>${escape(p.enrollment_status)}</small></td>
      <td>${p.processing_allowed?badge(p.risk_tier):'<span>Menunggu persetujuan / tidak aktif</span>'}${p.glucose_needs_review?'<p>Gula nonpuasa: perlu tinjauan</p>':''}</td>
      <td>${p.processing_allowed?`Tensi: ${escape(p.sys??'—')}/${escape(p.dia??'—')} mmHg<br><small>${escape(p.bp_at?time(p.bp_at):'Belum ada data')} · ${escape(p.bp_verification||'')}</small><br>Gula: ${escape(p.glu??'—')} mg/dL (${escape(p.glucose_context||'—')})<br><small>${escape(p.glu_at?time(p.glu_at):'Belum ada data')} · ${escape(p.glucose_verification||'')}</small>`:'Hasil menunggu dasar pemrosesan aktif.'}</td>
      <td>${p.processing_allowed?button('history',p.enrollment_id,'Hasil & sesi'):'—'}</td></tr>`).join('')||'<tr><td colspan="5">Tidak ada peserta sesuai filter.</td></tr>';
    }
    renderRows();target.querySelector('[data-search]').oninput=renderRows;target.querySelector('[data-tier]').onchange=renderRows;
    target.onchange=e=>{if(e.target.matches('[data-enrollment]')){e.target.checked?selected.add(e.target.dataset.enrollment):selected.delete(e.target.dataset.enrollment);renderRows();}};
    target.onclick=async event=>{
      const b=event.target.closest('[data-action]');if(!b||!target.contains(b))return;
      const {action,id}=b.dataset;const err=target.querySelector('[data-error]');err.textContent='';
      const refresh=()=>workspace(target,programId);
      try {
        if(action==='refresh')return refresh();
        if(action==='history')return history(id);
        if(action==='export'){
          const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,'\'$&').replace(/"/g,'""')+'"';
          const rows=[['Peserta','Treatment','Status treatment','Sesi','Jadwal','Status sesi','Kehadiran','Kedisiplinan','Laporan','Tindak lanjut','Kesimpulan']];
          requests.forEach(t=>{const sessions=t.sessions?.length?t.sessions:[{}];sessions.forEach(s=>rows.push([t.participant_name,t.treatment_label,states[t.status],s.session_no,s.scheduled_at,states[s.status],attendance[s.attendance],adherence[s.adherence],s.report,s.follow_up,t.closure_report]));});
          const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
          const a=document.createElement('a');a.href=url;a.download='laporan-treatment.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
        }
        if(action==='select'){target.querySelectorAll('[data-enrollment]:not(:disabled)').forEach(x=>selected.add(x.dataset.enrollment));renderRows();return;}
        if(action==='clear'){selected.clear();renderRows();return;}
        if(action==='request'){
          if(!selected.size)throw Error('Pilih peserta yang aktif dan sudah menyetujui pemberitahuan.');
          const key=crypto.randomUUID(), ids=[...selected];
          const d=dialog(`Request treatment · ${ids.length} peserta`,`<form><label>Jenis<select name="type" required>${options(treatments)}</select></label><label>Nama treatment<input name="label" required maxlength="200"></label><label>Usulan jadwal<input name="schedule" type="datetime-local"></label><label>Catatan<textarea name="notes" maxlength="4000"></textarea></label><button type="submit">Kirim request ke admin HIS</button></form>`);
          submit(d,async f=>{await call('wellness_request_treatment',{p_program_id:programId,p_enrollment_ids:ids,p_treatment_type:f.type,p_treatment_label:f.label,p_notes:f.notes,p_scheduled_at:f.schedule?new Date(f.schedule).toISOString():null,p_request_key:key});await refresh();});return;
        }
        if(action==='provider'){
          const d=dialog('Tambahkan pemasok hasil',`<form><p>Gunakan ID akun dengan peran IHC. Akun harus berada pada tenant yang sama.</p><label>ID akun IHC<input name="user" required pattern="[0-9a-fA-F-]{36}"></label><button type="submit">Berikan akses program</button></form>`);
          submit(d,async f=>{await call('wellness_set_result_provider',{p_program_id:programId,p_user_id:f.user,p_active:true});await refresh();});return;
        }
        if(['revoke-provider','grant-provider'].includes(action)){b.disabled=true;await call('wellness_set_result_provider',{p_program_id:programId,p_user_id:id,p_active:action==='grant-provider'});return refresh();}
        if(action==='accept'){b.disabled=true;await call('wellness_manage_treatment',{p_request_id:id,p_action:'accept'});return refresh();}
        if(action==='schedule'){
          const request=requests.find(t=>t.id===id), next=Math.max(0,...(request.sessions||[]).map(s=>s.session_no))+1;
          const d=dialog('Jadwalkan sesi',`<form><label>Sesi ke<input name="number" type="number" min="1" value="${next}" required></label><label>Jadwal<input name="schedule" type="datetime-local" required></label><label>Admin pelaksana<select name="staff" required><option value="">Pilih admin</option>${(data.staff||[]).map(s=>`<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('')}</select></label><button type="submit">Simpan sesi</button></form>`);
          submit(d,async f=>{await call('wellness_manage_treatment',{p_request_id:id,p_action:'schedule',p_payload:{session_no:Number(f.number),scheduled_at:new Date(f.schedule).toISOString(),assigned_to:f.staff}});await refresh();});return;
        }
        if(['reschedule','cancel_session'].includes(action)){
          const request=requests.find(t=>(t.sessions||[]).some(s=>s.id===id));
          const d=dialog(action==='reschedule'?'Ubah jadwal sesi':'Batalkan sesi',`<form>${action==='reschedule'?'<label>Jadwal baru<input name="schedule" type="datetime-local" required></label>':''}<label>Alasan<textarea name="report" required maxlength="4000"></textarea></label><button type="submit">Simpan perubahan sesi</button></form>`);
          submit(d,async f=>{await call('wellness_manage_treatment',{p_request_id:request.id,p_action:action,p_payload:{session_id:id,report:f.report,scheduled_at:f.schedule?new Date(f.schedule).toISOString():null}});await refresh();});return;
        }
        if(action==='report'){
          const request=requests.find(t=>(t.sessions||[]).some(s=>s.id===id));
          const d=dialog('Laporan pelaksanaan sesi',`<form><label>Kehadiran<select name="attendance" required>${options(attendance)}</select></label><label>Kedisiplinan mengikuti treatment<select name="adherence" required><option value="not_assessed">Belum dapat dinilai</option>${options({followed:adherence.followed,partial:adherence.partial,not_followed:adherence.not_followed})}</select></label><label>Laporan / bukti pelaksanaan<textarea name="report" required maxlength="4000"></textarea></label><label>Rencana tindak lanjut<textarea name="follow_up" maxlength="4000"></textarea></label><p>Laporan tersimpan sebagai catatan audit dan tidak ditimpa.</p><button type="submit">Simpan laporan sesi</button></form>`);
          submit(d,async f=>{await call('wellness_manage_treatment',{p_request_id:request.id,p_action:'report',p_payload:{...f,session_id:id}});await refresh();});return;
        }
        if(['complete','cancel'].includes(action)){
          const d=dialog(action==='complete'?'Selesaikan treatment':'Batalkan treatment',`<form><label>${action==='complete'?'Kesimpulan dan evaluasi':'Alasan pembatalan'}<textarea name="report" required maxlength="4000"></textarea></label><button type="submit">Simpan penutupan</button></form>`);
          submit(d,async f=>{await call('wellness_manage_treatment',{p_request_id:id,p_action:action,p_payload:f});await refresh();});
        }
      } catch(e){err.textContent=e.message;b.disabled=false;}
    };
  }
  async function corporate(target){
    target.classList.add('wf');target.innerHTML='<p>Memuat program perusahaan…</p>';
    try {
      const data=await call('wellness_corporate_dashboard');
      target.innerHTML=`<h2>Program kesehatan karyawan</h2><p>HR berwenang mengevaluasi hasil dan meminta treatment. Admin HIS mengatur pelaksanaan dan melaporkan setiap sesi.</p><label>Program<select data-program><option value="">Pilih program</option>${(data.programs||[]).map(p=>`<option value="${escape(p.id)}">${escape(p.name)} · ${escape(p.status)}</option>`).join('')}</select></label><div data-workspace></div>`;
      const select=target.querySelector('[data-program]');select.onchange=()=>select.value?workspace(target.querySelector('[data-workspace]'),select.value):target.querySelector('[data-workspace]').replaceChildren();
      if(data.programs?.length){select.value=data.programs[0].id;await select.onchange();}
      else target.querySelector('[data-workspace]').textContent='Belum ada program untuk perusahaan akun ini.';
    }catch(e){target.innerHTML=`<p class="wf-error">${escape(e.message)}</p>`;}
  }
  async function personal(target,programs){
    target.classList.add('wf');target.innerHTML='<h3>Treatment & laporan sesi saya</h3><div data-personal-treatments>Memuat…</div>';
    const slot=target.querySelector('[data-personal-treatments]');slot.replaceChildren();
    for(const p of programs){
      const section=document.createElement('section');slot.appendChild(section);
      try{
        const data=await call('wellness_participant_detail',{p_enrollment_id:p.enrollment_id});
        section.innerHTML=`<h4>${escape(p.name)}</h4>${(data.requests||[]).map(t=>requestHtml(t)).join('')||'<p>Belum ada treatment. Jadwal dan laporan akan tampil di sini.</p>'}${button('history',p.enrollment_id,'Seluruh riwayat pemeriksaan')}${p.consent_status==='granted'?button('withdraw',p.id,'Tarik persetujuan program'):''}`;
        section.querySelector('[data-action="history"]').onclick=()=>history(p.enrollment_id);
        section.querySelector('[data-action="withdraw"]')?.addEventListener('click',()=>{
          const d=dialog('Tarik persetujuan',`<form><p>Pencatatan dan treatment aktif akan dihentikan. Riwayat serta jejak audit tetap disimpan.</p><button type="submit">Tarik persetujuan saya</button></form>`);
          submit(d,async()=>{await call('wellness_withdraw_consent',{p_program_id:p.id});await window.renderPersonalWellness();});
        });
      }catch(e){section.textContent=e.message;}
    }
  }
  window.WellnessFlow={workspace,corporate,personal,history,escape};
})();
