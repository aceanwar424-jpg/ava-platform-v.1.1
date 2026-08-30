// ═══════════════════════════════════════════════════════════════════════════
// MODULE: Rekam Medis Elektronik (EMR) SOAP & CPPT Interaktif — AVA GLOBAL
// ---------------------------------------------------------------------------
// Fitur:
// - Antrian Pemeriksaan Dokter / Poli Rawat Jalan
// - SOAP Charting: Subjective, Objective (Vital Signs + Fisik), Assessment (ICD-10), Plan
// - Order Lab Langsung dari Lembar Konsultasi
// - E-Prescription Langsung ke Farmasi
// - Riwayat CPPT Terintegrasi
// ═══════════════════════════════════════════════════════════════════════════

let EMR_STATE = {
  pasienList: [
    { id: 'P-00124', nama: 'Ny. Siska Melani', nik: '3201889201990001', usia: '29 Thn', jk: 'Perempuan', no_rm: 'RM-2026-0041', status: 'Dalam Pemeriksaan' },
    { id: 'P-00128', nama: 'Nn. Aurelia Putri', nik: '3201773010010002', usia: '24 Thn', jk: 'Perempuan', no_rm: 'RM-2026-0055', status: 'Menunggu Dokter' },
    { id: 'P-00135', nama: 'Ibu Ratna Juwita', nik: '3201445012800003', usia: '48 Thn', jk: 'Perempuan', no_rm: 'RM-2026-0062', status: 'Selesai' }
  ],
  selectedPatient: null,
  cpptHistory: [
    {
      tanggal: '2026-07-15 09:30',
      dokter: 'dr. Siti Rahma, Sp.OG',
      s: 'Siklus haid tidak teratur (oligomenorrhea) 4 bulan terakhir, jerawat hormonal di rahang, kenaikan BB 6 kg.',
      o: 'TD: 120/80 mmHg, Nadi: 78x/m, IMT: 26.2 (Overweight). Hirsutisme ringan pada dagu.',
      a: 'E28.2 - Polycystic Ovarian Syndrome (PCOS) suspect resistensi insulin ovarium.',
      p: '1. Rujukan Lab: Panel Hormon Lengkap (LH, FSH, AMH, Estradiol, Insulin Puasa).\n2. Terapi: Metformin HCl 500mg 3x1, Queen HerBalance Elixir 1 shot pagi.'
    }
  ]
};

async function renderEmrSoap(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  if (!EMR_STATE.selectedPatient) {
    EMR_STATE.selectedPatient = EMR_STATE.pasienList[0];
  }

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1>📋 Rekam Medis Elektronik (EMR SOAP)</h1>
        <p>Catatan Perkembangan Pasien Terintegrasi (CPPT), Vital Signs &amp; Asesmen Klinis Dokter</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderEmrSoap()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="simpanSoapRecord()">💾 Simpan CPPT &amp; Rencana Medis</button>
      </div>
    </div>

    <div class="grid-2" style="grid-template-columns: 320px 1fr; gap: 20px; align-items: start;">
      <!-- Sidebar Antrian Pasien -->
      <div class="card" style="padding: 16px;">
        <div class="card-title" style="margin-bottom: 12px;">Antrian Pasien Hari Ini</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${EMR_STATE.pasienList.map(p => `
            <div onclick="pilihPasienEmr('${p.id}')" style="background:${p.id === EMR_STATE.selectedPatient.id ? 'rgba(0,210,180,0.1)' : 'var(--bg2)'}; border:1px solid ${p.id === EMR_STATE.selectedPatient.id ? 'var(--teal)' : 'rgba(255,255,255,0.06)'}; border-radius:10px; padding:12px; cursor:pointer;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <b>${p.nama}</b>
                <span class="badge ${p.status === 'Dalam Pemeriksaan' ? 'badge-warning' : p.status === 'Selesai' ? 'badge-success' : 'badge-info'}" style="font-size:10px;">${p.status}</span>
              </div>
              <div style="font-size:12px;color:var(--text3);margin-top:4px;">
                ${p.no_rm} · ${p.usia} (${p.jk})
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Form SOAP Terintegrasi -->
      <div style="display:flex;flex-direction:column;gap:18px;">
        <!-- Header Profil Pasien Terpilih -->
        <div class="card" style="border-left: 4px solid var(--teal); padding:16px 20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h2 style="font-size:18px;margin:0;">${EMR_STATE.selectedPatient.nama} <span style="font-size:14px;color:var(--text3);">(${EMR_STATE.selectedPatient.no_rm})</span></h2>
              <p style="font-size:12px;color:var(--text3);margin-top:4px;">NIK: ${EMR_STATE.selectedPatient.nik} · Usia: ${EMR_STATE.selectedPatient.usia} · Gol. Darah: O+ · Alergi: <b>Tidak Ada Alergi Obat</b></p>
            </div>
            <div>
              <span class="badge badge-teal">Poli Obgyn &amp; Hormon</span>
            </div>
          </div>
        </div>

        <!-- Vital Signs Card (Objective Input) -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px;">📊 Pemeriksaan Fisik &amp; Tanda Vital (Objective)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
            <div class="form-group">
              <label style="font-size:11px;">Tekanan Darah (mmHg)</label>
              <input type="text" id="emr-td" class="input" value="120/80">
            </div>
            <div class="form-group">
              <label style="font-size:11px;">Nadi (x/menit)</label>
              <input type="number" id="emr-nadi" class="input" value="78">
            </div>
            <div class="form-group">
              <label style="font-size:11px;">Laju Nafas (x/menit)</label>
              <input type="number" id="emr-rr" class="input" value="18">
            </div>
            <div class="form-group">
              <label style="font-size:11px;">Suhu (°C)</label>
              <input type="text" id="emr-suhu" class="input" value="36.5">
            </div>
            <div class="form-group">
              <label style="font-size:11px;">Tinggi / Berat (cm/kg)</label>
              <input type="text" id="emr-tb-bb" class="input" value="160 / 67">
            </div>
            <div class="form-group">
              <label style="font-size:11px;">IMT / BMI (kg/m²)</label>
              <input type="text" id="emr-bmi" class="input" value="26.2 (Overweight)" readonly style="background:rgba(255,255,255,0.05)">
            </div>
          </div>
        </div>

        <!-- Form SOAP Input -->
        <div class="card">
          <div class="card-title" style="margin-bottom:14px;">Catatan Medis SOAP Hari Ini</div>
          
          <!-- S: Subjective -->
          <div class="form-group">
            <label><b>[S] Anamnesa &amp; Keluhan Pasien (Subjective)</b></label>
            <textarea id="emr-s" class="input" style="height:70px;" placeholder="Keluhan utama, riwayat penyakit, keluhan haid/nyeri, gaya hidup...">Pasien mengeluhkan haid tidak teratur sejak 4 bulan terakhir, kram perut bagian bawah saat menstruasi, dan rasa mudah lelah di sore hari.</textarea>
          </div>

          <!-- O: Objective -->
          <div class="form-group">
            <label><b>[O] Temuan Klinis &amp; Status Lokalis (Objective)</b></label>
            <textarea id="emr-o" class="input" style="height:60px;" placeholder="Pemeriksaan fisik dokter, status generalis, palpasi abdomen...">Abdomen supel, nyeri tekan ringan suprapubik (-), tidak teraba massa organomegali, skin barrier wajah tampak inflamasi ringan.</textarea>
          </div>

          <!-- A: Assessment -->
          <div class="form-group">
            <label><b>[A] Diagnosis ICD-10 &amp; Asesmen Klinis (Assessment)</b></label>
            <div class="grid-2" style="gap:10px;">
              <select id="emr-icd" class="input">
                <option value="E28.2 - Polycystic Ovarian Syndrome (PCOS)">E28.2 - Polycystic Ovarian Syndrome (PCOS)</option>
                <option value="N80 - Endometriosis">N80 - Endometriosis</option>
                <option value="N94.6 - Dysmenorrhea, unspecified">N94.6 - Dysmenorrhea, unspecified</option>
                <option value="E11 - Type 2 diabetes mellitus">E11 - Type 2 diabetes mellitus</option>
                <option value="I10 - Essential (primary) hypertension">I10 - Essential (primary) hypertension</option>
                <option value="Z00.0 - General medical examination">Z00.0 - General medical examination</option>
              </select>
              <input type="text" id="emr-a-desc" class="input" value="Suspek resistensi insulin ovarium & disfungsi ovulasi" placeholder="Catatan asesmen diferensial...">
            </div>
          </div>

          <!-- P: Plan -->
          <div class="form-group">
            <label><b>[P] Rencana Tatalaksana Medis, R/ Resep &amp; Rujukan Lab (Plan)</b></label>
            <textarea id="emr-p" class="input" style="height:80px;" placeholder="Tindakan medis, resep obat, rujukan lab, edukasi diet...">1. Rujukan Lab: Female Hormone Panel (AMH, LH, FSH, Estradiol) & Profil Lipid.
2. E-Prescription: Queen HerBalance Elixir 30mL (10 shot) + Metformin HCl 500mg 3x1.
3. Rekomendasi Terapi: Empress Ratus & Lymphatic Spa di Queen Sanctuary.
4. Kontrol ulang 1 bulan setelah hasil lab selesai.</textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;">
            <button class="btn btn-ghost" onclick="buatRujukanLabLangsung()">🧪 Buat Order Lab</button>
            <button class="btn btn-teal" onclick="simpanSoapRecord()">💾 Simpan CPPT</button>
          </div>
        </div>

        <!-- Riwayat CPPT Sebelumnya -->
        <div class="card">
          <div class="card-title" style="margin-bottom:14px;">📜 Riwayat Rekam Medis (CPPT Historis)</div>
          <div style="display:flex;flex-direction:column;gap:14px;">
            ${EMR_STATE.cpptHistory.map(c => `
              <div style="background:var(--bg2);border-radius:10px;padding:16px;border-left:3px solid var(--accent);">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                  <b>${c.dokter}</b>
                  <span style="font-size:12px;color:var(--text3);">${c.tanggal}</span>
                </div>
                <div style="font-size:13px;line-height:1.6;color:var(--text2);">
                  <b>[S]:</b> ${c.s}<br>
                  <b>[O]:</b> ${c.o}<br>
                  <b>[A]:</b> <b style="color:var(--teal)">${c.a}</b><br>
                  <b>[P]:</b> ${c.p.replace(/\n/g, '<br>')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function pilihPasienEmr(id) {
  const p = EMR_STATE.pasienList.find(x => x.id === id);
  if (p) {
    EMR_STATE.selectedPatient = p;
    renderEmrSoap();
  }
}

function simpanSoapRecord() {
  const s = document.getElementById('emr-s')?.value || '';
  const o = document.getElementById('emr-o')?.value || '';
  const a = document.getElementById('emr-icd')?.value || '';
  const p = document.getElementById('emr-p')?.value || '';

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  EMR_STATE.cpptHistory.unshift({
    tanggal: dateStr,
    dokter: 'dr. Siti Rahma, Sp.OG',
    s, o, a, p
  });

  if (EMR_STATE.selectedPatient) {
    EMR_STATE.selectedPatient.status = 'Selesai';
  }

  toast('Catatan CPPT Rekam Medis berhasil disimpan!', 'ok');
  renderEmrSoap();
}

function buatRujukanLabLangsung() {
  toast('Rujukan pemeriksaan Lab Hormon berhasil dikirim ke antrian Lab Diagnostik!', 'ok');
}

window.renderEmrSoap = renderEmrSoap;
window.pilihPasienEmr = pilihPasienEmr;
window.simpanSoapRecord = simpanSoapRecord;
window.buatRujukanLabLangsung = buatRujukanLabLangsung;
