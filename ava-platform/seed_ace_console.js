// ════════════════════════════════════════════════════════════════════════
// DATA UJI — Ace Darojatun Anwar
// Tempel SELURUH isi ini di Console peramban (F12 → Console) SAAT SUDAH LOGIN
// di AVA, lalu tekan Enter. Berjalan memakai sesi Anda sehingga RLS terhormat
// persis seperti input manual dari layar.
//
// Membuat 5 kunjungan, tiap kunjungan diparkir di tahap berbeda:
//   1 BARU DAFTAR (sampel Pending)  2 SIAP VALIDASI  3 SIAP VALIDASI-KRITIS
//   4 SIAP APPROVAL (Validated)     5 SUDAH RILIS (Approved)
// Ditambah 3 order radiologi di tahap Dijadwalkan / Dikerjakan / Selesai.
// ════════════════════════════════════════════════════════════════════════
(async () => {
  if (typeof sbPost !== 'function') { alert('Buka AVA & login dulu, baru tempel skrip ini.'); return; }
  const nowISO = () => new Date().toISOString();
  const stamp  = Date.now().toString().slice(-6);
  const one = r => Array.isArray(r) ? r[0] : r;

  const PANEL = [
    { pid:1,   name:'Gula Darah Puasa (GDP)', unit:'mg/dL', min:70,   max:99,  cl:40, ch:500 },
    { pid:41,  name:'HEMOGLOBIN',             unit:'g/dL',  min:13.0, max:17.0, cl:7,  ch:20  },
    { pid:142, name:'TOTAL KOLESTEROL',       unit:'mg/dL', min:0,    max:200, cl:null, ch:null },
    { pid:145, name:'TRIGLISERIDA',           unit:'mg/dL', min:0,    max:150, cl:null, ch:null },
    { pid:37,  name:'JUMLAH RETIKULOSIT',     unit:'%',     min:2.5,  max:6.5, cl:null, ch:null },
  ];
  const VALUES = {
    validasi: ['92','15.2','235','180','3.1'],   // KOL & TRIG tinggi (flag H)
    kritis:   ['560','6.4','190','120','4.0'],   // GDP & HGB KRITIS
    approval: ['88','16.1','175','110','5.2'],   // normal
    released: ['101','14.8','198','145','2.8'],  // batas normal
  };
  const fields = (p, v) => {
    const num = parseFloat(v);
    const high = p.max!=null && num>p.max, low = p.min!=null && num<p.min;
    const crit = (p.cl!=null && num<=p.cl) || (p.ch!=null && num>=p.ch);
    return { result_value:String(v), result_numeric:isNaN(num)?null:num,
      normal_min:p.min, normal_max:p.max, critical_low:p.cl, critical_high:p.ch, unit:p.unit,
      interpretation: crit?'Nilai kritis':high?'Tinggi':low?'Rendah':'Normal',
      color_code: crit?'red':(high||low)?'amber':'green',
      condition_name: crit?'Kritis':high?'Tinggi':low?'Rendah':'Normal',
      condition_type: crit?'critical':'normal', is_critical:crit, is_auto:false };
  };

  async function admission(mr, label, status) {
    const visit = `VISIT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${stamp}-${label}`;
    return one(await sbPost('admissions', {
      mr_number:mr, visit_number:visit, patient_name:'Ace Darojatun Anwar',
      patient_gender:'Male', patient_age:41, patient_dob:'1985-03-12', patient_blood_type:'O',
      patient_phone:'081200000041', patient_category:'WNI', discount_scheme:'umum',
      payment_status:'Paid', status, registered_by:'DATA UJI',
      visit_date:nowISO(), created_at:nowISO(), updated_at:nowISO(),
    }));
  }

  async function seed(adm, stage, values) {
    const base = { admission_id:adm.id, visit_number:adm.visit_number, patient_name:adm.patient_name };
    for (let i=0;i<PANEL.length;i++) {
      const p = PANEL[i];
      const sample = one(await sbPost('lab_samples', {
        barcode:`BC-${stamp}-${adm.id}-${p.pid}`, ...base,
        product_id:p.pid, product_name:p.name, sampel_type:'Darah Vena',
        received_at:nowISO(), collected_at:nowISO(),
        status: stage==='pending'?'Pending':'Done', created_at:nowISO(), updated_at:nowISO(),
      }));
      const row = { ...base, sample_id:sample.id, product_id:p.pid, product_name:p.name,
        item_name:p.name, unit:p.unit, entered_by:'DATA UJI', entered_at:nowISO(),
        created_at:nowISO(), updated_at:nowISO() };
      if (stage==='pending') { row.status='Draft'; }
      else {
        Object.assign(row, fields(p, values[i]));
        if (stage==='draft')     row.status='Draft';
        if (stage==='validated'){ row.status='Validated'; row.validated_by='DATA UJI'; row.validated_at=nowISO(); }
        if (stage==='approved') { row.status='Approved'; row.validated_by='DATA UJI'; row.validated_at=nowISO();
                                  row.approved_by='DATA UJI'; row.approved_at=nowISO(); row.released_at=nowISO(); }
        if (row.is_critical && stage==='draft') row.critical_ack_at=nowISO();
      }
      await sbPost('lab_results', row);
    }
  }

  try {
    let mr;
    const ex = await sbGet('admissions', `select=mr_number&patient_name=ilike.*ace*darojatun*&mr_number=not.is.null&limit=1`);
    mr = ex?.[0]?.mr_number || `MR-${stamp}41`;

    const log = [];
    const v1 = await admission(mr,'A','Registered');    await seed(v1,'pending');            log.push(`1 BARU DAFTAR      ${v1.visit_number}`);
    const v2 = await admission(mr,'B','In Progress');   await seed(v2,'draft',VALUES.validasi); log.push(`2 SIAP VALIDASI    ${v2.visit_number}`);
    const v3 = await admission(mr,'C','In Progress');   await seed(v3,'draft',VALUES.kritis);   log.push(`3 VALIDASI-KRITIS  ${v3.visit_number}`);
    const v4 = await admission(mr,'D','In Progress');   await seed(v4,'validated',VALUES.approval); log.push(`4 SIAP APPROVAL    ${v4.visit_number}`);
    const v5 = await admission(mr,'E','Completed');     await seed(v5,'approved',VALUES.released);  log.push(`5 SUDAH RILIS      ${v5.visit_number}`);

    const rads = [
      { proc:'Thorax PA',      mod:4, code:'CR', st:'Dijadwalkan' },
      { proc:'USG Abdomen',    mod:5, code:'US', st:'Dikerjakan', done:true },
      { proc:'CT Scan Kepala', mod:1, code:'CT', st:'Selesai', done:true },
    ];
    let ri=0;
    for (const r of rads) {
      const acc = `ACC-${stamp}-${++ri}`;
      const b = { accession_no:acc, mr_number:mr, patient_name:'Ace Darojatun Anwar',
        patient_gender:'Male', patient_dob:'1985-03-12', modality_id:r.mod, modality_code:r.code,
        procedure_name:r.proc, clinical_info:'Data uji — rutin', referring_doctor:'dr. Seed',
        priority:'Rutin', status:r.st, scheduled_at:nowISO(),
        created_by:'DATA UJI', created_at:nowISO(), updated_at:nowISO() };
      if (r.done) { b.performed_at=nowISO(); b.performed_by='DATA UJI'; }
      await sbPost('radiology_orders', b);
      log.push(`RIS ${r.st.padEnd(12)} ${acc} — ${r.proc}`);
    }

    console.log('%c✅ DATA UJI DIBUAT — MR '+mr, 'color:#0E7C86;font-weight:800;font-size:14px');
    log.forEach(l => console.log('  • '+l));
    if (typeof toast==='function') toast('✅ Data uji Ace dibuat — buka menu Lab','ok',5000);
    if (typeof labRefresh==='function') await labRefresh();
  } catch (e) {
    console.error('GAGAL:', e.message);
    if (typeof toast==='function') toast('❌ '+e.message,'err',6000);
  }
})();
