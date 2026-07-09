// ═══════════════════════════════════════════════════════════════
// MODULE: Attendance — Clock In/Out GPS + Cloudinary Photo
// ═══════════════════════════════════════════════════════════════

// Cloudinary config — set via Settings
function getCloudinaryConfig() {
  return {
    cloudName:    localStorage.getItem('ol_cloudinary_name')||'',
    uploadPreset: localStorage.getItem('ol_cloudinary_preset')||'',
  };
}

let attendState = {
  locations: [],      // work locations from settings
  mySchedule: null,
  todayRecord: null,
  cameraStream: null,
  capturedPhoto: null,
  gpsCoords: null,
  gpsDistance: null,
  nearestLocation: null,
};

// ── RENDER UTAMA ──────────────────────────────────────────────
async function renderAttendance() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>⏰ Absensi & Clock In/Out</h1>
        <p>Presensi harian dengan validasi GPS dan foto selfie</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderAttendance()">↻ Refresh</button>
      </div>
    </div>
    <div class="ms-topbar" style="margin-bottom:18px">
      <button class="ms-tab active" onclick="switchAttTab('clock',this)">⏰ Clock In/Out</button>
      <button class="ms-tab" onclick="switchAttTab('history',this)">📋 Riwayat</button>
      <button class="ms-tab" onclick="switchAttTab('team',this)">👥 Tim (SPV)</button>
      <button class="ms-tab" onclick="switchAttTab('config',this)">⚙️ Konfigurasi</button>
    </div>
    <div id="att-main"><div class="loading-row"><div class="spinner"></div></div></div>`;

  await loadAttendanceData();
  renderClockPanel();
}

async function loadAttendanceData() {
  const user  = getUserName?getUserName():'';
  const today = new Date().toISOString().split('T')[0];
  const [locs, sched, rec] = await Promise.all([
    sbGet('work_locations','select=*&is_active=eq.true').catch(()=>[]),
    getMySchedule().catch(()=>null),
    sbGet('attendance',`select=*&employee_name=eq.${encodeURIComponent(user)}&tanggal=eq.${today}&limit=1`).catch(()=>[]),
  ]);
  attendState.locations   = Array.isArray(locs) ? locs : [];
  attendState.mySchedule  = sched;
  attendState.todayRecord = rec?.[0]||null;
}

function switchAttTab(tab, btn) {
  document.querySelectorAll('.ms-topbar .ms-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if (tab==='clock')   renderClockPanel();
  if (tab==='history') renderAttHistory();
  if (tab==='team')    renderTeamAttendance();
  if (tab==='config')  renderAttConfig();
}

// ── CLOCK PANEL ───────────────────────────────────────────────
function renderClockPanel() {
  const el = document.getElementById('att-main'); if (!el) return;
  const rec    = attendState.todayRecord;
  const sched  = attendState.mySchedule;
  const user   = getUserName?getUserName():'';
  const today  = new Date().toISOString().split('T')[0];
  const now    = new Date();
  const timeStr= now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const dateStr= now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  const canClockIn  = !rec?.clock_in_at;
  const canClockOut = rec?.clock_in_at && !rec?.clock_out_at;
  const isComplete  = rec?.clock_in_at && rec?.clock_out_at;

  el.innerHTML = `
    <!-- Status card -->
    <div class="card" style="max-width:500px;margin:0 auto;text-align:center;padding:24px">
      <div style="font-size:36px;font-weight:800;color:var(--teal);letter-spacing:-1px;margin-bottom:4px">
        ${timeStr}
      </div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px">${dateStr}</div>

      ${sched?`
      <div style="background:var(--bg2);border-radius:var(--r);padding:10px 14px;margin-bottom:16px;
        display:flex;gap:16px;justify-content:center;font-size:12.5px">
        <span>🕐 Shift: <strong>${sched.shift_name}</strong></span>
        <span>⏱ ${sched.jam_masuk_weekday?.slice(0,5)} – ${sched.jam_pulang_weekday?.slice(0,5)}</span>
        <span>💪 ${sched.kapasitas_jam||7}j</span>
      </div>`:''}

      <!-- Today status -->
      ${isComplete ? `
        <div style="background:#DCFCE7;border-radius:var(--r-md);padding:16px;margin-bottom:16px">
          <div style="font-size:15px;font-weight:800;color:#15803D;margin-bottom:8px">✅ Hadir Hari Ini</div>
          <div style="display:flex;gap:20px;justify-content:center;font-size:13px">
            <div><div style="color:var(--text3);font-size:11px">CLOCK IN</div><strong>${rec.clock_in_at?.slice(11,16)||'—'}</strong></div>
            <div><div style="color:var(--text3);font-size:11px">CLOCK OUT</div><strong>${rec.clock_out_at?.slice(11,16)||'—'}</strong></div>
            <div><div style="color:var(--text3);font-size:11px">TOTAL</div><strong>${rec.total_jam_kerja?.toFixed(1)||'—'}j</strong></div>
          </div>
          ${rec.clock_in_foto_url?`
          <div style="margin-top:10px">
            <img src="${rec.clock_in_foto_url}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #22C55E">
            <span style="font-size:11px;color:var(--text3);margin-left:8px">Foto clock in</span>
          </div>`:''}
        </div>` :
      rec?.clock_in_at ? `
        <div style="background:#FFF7ED;border-radius:var(--r-md);padding:14px;margin-bottom:16px">
          <div style="font-weight:700;color:#C2410C">🔵 Sedang Bekerja</div>
          <div style="font-size:13px;margin-top:6px">Clock in: <strong>${rec.clock_in_at?.slice(11,16)}</strong>
            <span class="badge ${rec.clock_in_status==='OnTime'?'badge-green':'badge-red'}" style="margin-left:8px;font-size:10px">
              ${rec.clock_in_status==='OnTime'?'Tepat Waktu':'Terlambat'}
            </span>
          </div>
        </div>` :
        `<div style="background:var(--bg2);border-radius:var(--r-md);padding:14px;margin-bottom:16px;color:var(--text3)">
          Belum clock in hari ini
        </div>`}

      <!-- Action buttons -->
      ${canClockIn ? `
        <button class="btn btn-teal btn-lg" style="width:100%;font-size:15px" onclick="startClock('in')">
          📍 Clock In Sekarang
        </button>` : ''}
      ${canClockOut ? `
        <button class="btn btn-lg" style="width:100%;font-size:15px;background:#7C3AED;color:#fff" onclick="startClock('out')">
          🏠 Clock Out Sekarang
        </button>` : ''}
      ${isComplete ? `
        <div style="font-size:12px;color:var(--text3);margin-top:12px">
          Jika ada koreksi, hubungi SPV atau Admin
        </div>` : ''}
    </div>`;
}

// ── CLOCK IN/OUT FLOW ─────────────────────────────────────────
async function startClock(type) {
  const cfg = getCloudinaryConfig();
  if (!cfg.cloudName || !cfg.uploadPreset) {
    toast('⚠️ Konfigurasi Cloudinary belum diset di tab Konfigurasi','warn',5000);
    return;
  }

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📍 ${type==='in'?'Clock In':'Clock Out'}</div>
      <button class="modal-close" onclick="stopCamera();closeModalForce()">✕</button>
    </div>

    <!-- Step 1: GPS -->
    <div id="clock-step-gps">
      <div style="text-align:center;padding:20px">
        <div style="font-size:40px;margin-bottom:12px">📍</div>
        <div style="font-weight:700;font-size:14px;margin-bottom:8px">Mendapatkan Lokasi GPS...</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px">
          Pastikan GPS aktif dan izin lokasi diperbolehkan
        </div>
        <div class="spinner" style="margin:0 auto"></div>
      </div>
    </div>

    <!-- Step 2: Camera (hidden until GPS ok) -->
    <div id="clock-step-camera" style="display:none">
      <div style="margin-bottom:12px">
        <div id="gps-result-banner" style="padding:10px 14px;border-radius:var(--r);font-size:13px;margin-bottom:12px"></div>
        <video id="clock-video" style="width:100%;max-width:400px;border-radius:var(--r-md);
          display:block;margin:0 auto;background:#000" autoplay playsinline></video>
        <canvas id="clock-canvas" style="display:none"></canvas>
      </div>
      <div id="photo-preview" style="display:none;text-align:center;margin-bottom:12px">
        <img id="photo-preview-img" style="width:200px;height:200px;object-fit:cover;
          border-radius:var(--r-md);border:3px solid var(--teal)">
        <div style="margin-top:8px">
          <button class="btn btn-ghost btn-sm" onclick="retakePhoto()">↩️ Ambil Ulang</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn btn-teal" id="btn-capture" onclick="capturePhoto()">📸 Ambil Foto</button>
        <button class="btn btn-accent" id="btn-submit-clock" style="display:none"
          onclick="submitClock('${type}')">
          ✅ ${type==='in'?'Konfirmasi Clock In':'Konfirmasi Clock Out'}
        </button>
      </div>
    </div>

    <!-- Uploading -->
    <div id="clock-step-uploading" style="display:none;text-align:center;padding:20px">
      <div class="spinner" style="margin:0 auto 12px"></div>
      <div style="font-weight:700">Mengirim data...</div>
      <div style="font-size:12px;color:var(--text3)" id="upload-status-text">Mengupload foto...</div>
    </div>`);

  // Start GPS
  await getGPSAndValidate(type);
}

async function getGPSAndValidate(type) {
  if (!navigator.geolocation) {
    showGPSError('Browser tidak mendukung GPS');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      attendState.gpsCoords = {lat, lng};

      // Find nearest work location
      if (attendState.locations.length === 0) {
        // No locations configured - allow with warning
        attendState.gpsDistance    = 0;
        attendState.nearestLocation= null;
        showCameraStep(type, null, 0, true);
        return;
      }

      let minDist = Infinity, nearest = null;
      attendState.locations.forEach(loc => {
        const d = calcDistance(lat, lng, parseFloat(loc.latitude), parseFloat(loc.longitude));
        if (d < minDist) { minDist = d; nearest = loc; }
      });

      attendState.gpsDistance     = Math.round(minDist);
      attendState.nearestLocation = nearest;

      if (minDist > 10) {
        showGPSError(`Anda berada ${Math.round(minDist)}m dari ${nearest?.name||'lokasi kerja'} (maks 10m)`);
        return;
      }

      showCameraStep(type, nearest, Math.round(minDist), false);
    },
    (err) => {
      const msgs = {
        1: 'Izin GPS ditolak. Aktifkan di pengaturan browser.',
        2: 'GPS tidak tersedia.',
        3: 'Timeout mendapatkan lokasi.',
      };
      showGPSError(msgs[err.code]||'GPS error: '+err.message);
    },
    {enableHighAccuracy:true, timeout:15000, maximumAge:0}
  );
}

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function showGPSError(msg) {
  const gpsEl = document.getElementById('clock-step-gps');
  if (!gpsEl) return;
  gpsEl.innerHTML = `
    <div style="text-align:center;padding:20px">
      <div style="font-size:40px;margin-bottom:12px">⛔</div>
      <div style="font-weight:700;color:#DC2626;margin-bottom:8px">Clock In Ditolak</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px">${msg}</div>
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
    </div>`;
}

async function showCameraStep(type, location, distM, noLocConfig) {
  document.getElementById('clock-step-gps').style.display    = 'none';
  document.getElementById('clock-step-camera').style.display = '';

  const banner = document.getElementById('gps-result-banner');
  if (banner) {
    if (noLocConfig) {
      banner.style.background = '#FFF7ED';
      banner.style.color      = '#92400E';
      banner.innerHTML = '⚠️ Lokasi kerja belum dikonfigurasi — GPS tidak divalidasi. Hubungi Admin.';
    } else {
      banner.style.background = '#DCFCE7';
      banner.style.color      = '#15803D';
      banner.innerHTML = `✅ Lokasi terverifikasi · ${location?.name||'Klinik'} · Jarak: ${distM}m`;
    }
  }

  // Start camera
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:'user', width:{ideal:640}, height:{ideal:480}}
    });
    attendState.cameraStream = stream;
    const video = document.getElementById('clock-video');
    if (video) { video.srcObject = stream; video.play(); }
  } catch(e) {
    const camEl = document.getElementById('clock-step-camera');
    if (camEl) camEl.innerHTML = `
      <div style="text-align:center;padding:20px">
        <div style="font-size:13px;color:#DC2626;margin-bottom:12px">
          ❌ Kamera tidak tersedia: ${e.message}
        </div>
        <button class="btn btn-teal" onclick="submitClockNoPhoto('${type}')">
          Lanjut Tanpa Foto
        </button>
      </div>`;
  }
}

function capturePhoto() {
  const video  = document.getElementById('clock-video');
  const canvas = document.getElementById('clock-canvas');
  if (!video || !canvas) return;
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  attendState.capturedPhoto = canvas.toDataURL('image/jpeg', 0.8);

  // Show preview
  const preview    = document.getElementById('photo-preview');
  const previewImg = document.getElementById('photo-preview-img');
  const captureBtn = document.getElementById('btn-capture');
  const submitBtn  = document.getElementById('btn-submit-clock');
  if (preview)    preview.style.display    = '';
  if (previewImg) previewImg.src           = attendState.capturedPhoto;
  if (captureBtn) captureBtn.style.display = 'none';
  if (submitBtn)  submitBtn.style.display  = '';
  video.style.display = 'none';
}

function retakePhoto() {
  attendState.capturedPhoto = null;
  const preview    = document.getElementById('photo-preview');
  const video      = document.getElementById('clock-video');
  const captureBtn = document.getElementById('btn-capture');
  const submitBtn  = document.getElementById('btn-submit-clock');
  if (preview)    preview.style.display    = 'none';
  if (video)      video.style.display      = '';
  if (captureBtn) captureBtn.style.display = '';
  if (submitBtn)  submitBtn.style.display  = 'none';
}

function stopCamera() {
  if (attendState.cameraStream) {
    attendState.cameraStream.getTracks().forEach(t=>t.stop());
    attendState.cameraStream = null;
  }
}

async function uploadToCloudinary(dataUrl) {
  const cfg = getCloudinaryConfig();
  const blob = await fetch(dataUrl).then(r=>r.blob());
  const fd   = new FormData();
  fd.append('file',   blob, 'attendance.jpg');
  fd.append('upload_preset', cfg.uploadPreset);
  fd.append('folder', 'onelab/attendance');
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,{method:'POST',body:fd});
  const data = await res.json();
  if (!data.secure_url) throw new Error('Upload gagal: '+(data.error?.message||'unknown'));
  return data.secure_url;
}

async function submitClock(type) {
  stopCamera();
  document.getElementById('clock-step-camera').style.display    = 'none';
  document.getElementById('clock-step-uploading').style.display = '';

  const user   = getUserName?getUserName():'';
  const now    = new Date();
  const today  = now.toISOString().split('T')[0];
  const coords = attendState.gpsCoords;

  try {
    // Upload photo
    let photoUrl = null;
    if (attendState.capturedPhoto) {
      document.getElementById('upload-status-text').textContent = 'Mengupload foto ke Cloudinary...';
      photoUrl = await uploadToCloudinary(attendState.capturedPhoto);
    }

    document.getElementById('upload-status-text').textContent = 'Menyimpan data absensi...';

    const sched = attendState.mySchedule;
    const shiftMasuk = sched?.jam_masuk_weekday?.slice(0,5)||'09:00';
    const [sh,sm]    = shiftMasuk.split(':').map(Number);
    const shiftTime  = new Date(today+'T'+shiftMasuk+':00');
    const diffMins   = Math.round((now - shiftTime)/60000);
    const clockStatus= type==='in' ? (diffMins <= 5 ? 'OnTime' : diffMins <= 15 ? 'Late' : 'VeryLate') : null;

    if (type==='in') {
      const existing = await sbGet('attendance',
        `select=id&employee_name=eq.${encodeURIComponent(user)}&tanggal=eq.${today}&limit=1`).catch(()=>[]);
      const payload = {
        employee_name:    user,
        tanggal:          today,
        shift_code:       sched?.shift_code||'OH',
        clock_in_at:      now.toISOString(),
        clock_in_lat:     coords?.lat||null,
        clock_in_lng:     coords?.lng||null,
        clock_in_foto_url:photoUrl,
        clock_in_distance_m: attendState.gpsDistance||0,
        clock_in_status:  clockStatus,
        location_name:    attendState.nearestLocation?.name||null,
        updated_at:       now.toISOString(),
      };
      if (existing[0]?.id) await sbPatch('attendance',existing[0].id,payload);
      else await sbPost('attendance',{...payload,created_at:now.toISOString()});

      // Notify SPV
      sendTaskNotif('spv-group','clock_in',
        `${user} clock in pukul ${now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} — ${clockStatus==='OnTime'?'Tepat Waktu':'⚠️ '+clockStatus}`,'attendance');

    } else {
      const rec = attendState.todayRecord;
      if (!rec?.id) { toast('Data clock in tidak ditemukan','err'); return; }
      const clockInTime = new Date(rec.clock_in_at);
      const totalJam    = Math.round((now - clockInTime)/36000)/100;
      await sbPatch('attendance',rec.id,{
        clock_out_at:       now.toISOString(),
        clock_out_lat:      coords?.lat||null,
        clock_out_lng:      coords?.lng||null,
        clock_out_foto_url: photoUrl,
        clock_out_distance_m: attendState.gpsDistance||0,
        total_jam_kerja:    totalJam,
        updated_at:         now.toISOString(),
      });
    }

    toast(`✅ ${type==='in'?'Clock In':'Clock Out'} berhasil!`,'ok',3000);
    closeModalForce();
    await loadAttendanceData();
    renderClockPanel();

  } catch(e) { toast('❌ '+e.message,'err',5000); }
}

async function submitClockNoPhoto(type) {
  attendState.capturedPhoto = null;
  await submitClock(type);
}

// ── HISTORY VIEW ──────────────────────────────────────────────
async function renderAttHistory() {
  const el = document.getElementById('att-main'); if (!el) return;
  el.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;
  const user = getUserName?getUserName():'';
  const recs = await sbGet('attendance',
    `select=*&employee_name=eq.${encodeURIComponent(user)}&order=tanggal.desc&limit=30`).catch(()=>[]);

  if (!recs?.length) {
    el.innerHTML = `<div class="empty-state"><div class="ico">📋</div>
      <h3>Belum ada riwayat absensi</h3></div>`;
    return;
  }

  const STATUS_COLOR = {OnTime:'#22C55E',Late:'#F59E0B',VeryLate:'#EF4444'};
  el.innerHTML = `
    <div class="table-wrap">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          ${['TANGGAL','SHIFT','CLOCK IN','CLOCK OUT','TOTAL','STATUS','FOTO'].map(h=>`
            <th style="padding:9px 12px;background:var(--bg);font-size:11px;color:var(--text3);
              text-align:left;border-bottom:1px solid var(--border)">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${recs.map((r,i)=>` 
            <tr style="background:${i%2?'var(--bg2)':'#fff'};border-bottom:1px solid var(--border)">
              <td style="padding:9px 12px;font-weight:600">${r.tanggal}</td>
              <td style="padding:9px 12px;color:var(--text3)">${r.shift_code||'—'}</td>
              <td style="padding:9px 12px">
                ${r.clock_in_at?`<strong>${r.clock_in_at.slice(11,16)}</strong>
                  <div style="font-size:10px;color:var(--text3)">${r.location_name||''}</div>`:'—'}
              </td>
              <td style="padding:9px 12px">${r.clock_out_at?`<strong>${r.clock_out_at.slice(11,16)}</strong>`:'—'}</td>
              <td style="padding:9px 12px;font-weight:700;color:var(--teal)">
                ${r.total_jam_kerja?r.total_jam_kerja.toFixed(1)+'j':'—'}
              </td>
              <td style="padding:9px 12px">
                <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;
                  background:${STATUS_COLOR[r.clock_in_status]||'var(--bg2)'}20;
                  color:${STATUS_COLOR[r.clock_in_status]||'var(--text3)'}">
                  ${r.clock_in_status||r.leave_type||'—'}
                </span>
              </td>
              <td style="padding:9px 12px">
                ${r.clock_in_foto_url?`
                  <img src="${r.clock_in_foto_url}" style="width:32px;height:32px;border-radius:50%;
                    object-fit:cover;cursor:pointer;border:2px solid var(--teal)"
                    onclick="window.open('${r.clock_in_foto_url}','_blank')" title="Lihat foto">
                `:'—'}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── TEAM VIEW (SPV) ───────────────────────────────────────────
async function renderTeamAttendance() {
  const el   = document.getElementById('att-main'); if (!el) return;
  const role = getUserRole?getUserRole():'sales';
  if (!isSpv()) {
    el.innerHTML = `<div class="empty-state"><div class="ico">🔒</div>
      <h3>Akses SPV Only</h3></div>`;
    return;
  }
  el.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;
  const today = new Date().toISOString().split('T')[0];
  const [recs, emps] = await Promise.all([
    sbGet('attendance',`select=*&tanggal=eq.${today}&order=employee_name`).catch(()=>[]),
    sbGet('employees','select=id,full_name,position&status=eq.Aktif&order=full_name').catch(()=>[]),
  ]);

  const STATUS_COLOR = {OnTime:'#22C55E',Late:'#F59E0B',VeryLate:'#EF4444'};
  const dateLabel = new Date(today+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});

  el.innerHTML = `
    <div style="margin-bottom:14px">
      <div style="font-weight:800;font-size:14px">${dateLabel}</div>
      <div style="font-size:12px;color:var(--text3)">
        ${recs?.filter(r=>r.clock_in_at).length||0} dari ${emps?.length||0} karyawan sudah clock in
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
      ${(emps||[]).map(emp=>{
        const rec = recs?.find(r=>r.employee_name===emp.full_name);
        const hasClockedIn  = !!rec?.clock_in_at;
        const hasClockedOut = !!rec?.clock_out_at;
        const sc = STATUS_COLOR[rec?.clock_in_status]||'#94A3B8';
        return `
          <div style="background:#fff;border:1.5px solid ${hasClockedIn?sc:'var(--border)'};
            border-radius:var(--r-md);padding:14px;transition:all .15s">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="width:38px;height:38px;border-radius:50%;
                background:${hasClockedIn?sc:'var(--bg2)'};
                display:flex;align-items:center;justify-content:center;
                font-size:14px;font-weight:800;color:${hasClockedIn?'#fff':'var(--text3)'}">
                ${emp.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-weight:700;font-size:12.5px">${emp.full_name.split(' ').slice(0,2).join(' ')}</div>
                <div style="font-size:11px;color:var(--text3)">${emp.position||'—'}</div>
              </div>
            </div>
            ${hasClockedIn ? `
              <div style="font-size:11.5px">
                <div>🟢 In: <strong>${rec.clock_in_at?.slice(11,16)}</strong>
                  <span style="font-size:10px;color:${sc};font-weight:700;margin-left:4px">${rec.clock_in_status||''}</span>
                </div>
                ${hasClockedOut?`<div>🔴 Out: <strong>${rec.clock_out_at?.slice(11,16)}</strong> · ${rec.total_jam_kerja?.toFixed(1)||'—'}j</div>`:'<div style="color:var(--text3)">Belum clock out</div>'}
                ${rec.clock_in_foto_url?`<img src="${rec.clock_in_foto_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-top:6px">` :''}
              </div>` :
              `<div style="font-size:12px;color:var(--text3)">⚪ Belum clock in</div>`}
          </div>`;
      }).join('')}
    </div>`;
}

// ── CONFIG TAB ────────────────────────────────────────────────
async function renderAttConfig() {
  const el = document.getElementById('att-main'); if (!el) return;
  const cfg  = getCloudinaryConfig();
  const locs = await sbGet('work_locations','select=*&order=name').catch(()=>[]);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:800px">

      <!-- Cloudinary Config -->
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">☁️ Cloudinary Setup</div>
        <div class="form-group">
          <label>Cloud Name</label>
          <input type="text" id="cfg-cloud-name" value="${cfg.cloudName}" placeholder="your-cloud-name">
        </div>
        <div class="form-group">
          <label>Upload Preset (Unsigned)</label>
          <input type="text" id="cfg-upload-preset" value="${cfg.uploadPreset}" placeholder="your_preset">
          <div class="form-hint">Buat di Cloudinary: Settings → Upload → Add upload preset → Unsigned</div>
        </div>
        <button class="btn btn-teal btn-sm" onclick="saveCloudinaryConfig()">💾 Simpan</button>
      </div>

      <!-- Work Locations -->
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div class="card-title">📍 Lokasi Kerja</div>
          <button class="btn btn-ghost btn-xs" onclick="openLocationForm()">+ Tambah</button>
        </div>
        <div id="loc-list">
          ${(locs||[]).length ? (locs||[]).map(loc=>`
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px">${loc.name}</div>
                <div style="font-size:11px;color:var(--text3)">${loc.latitude}, ${loc.longitude} · Radius ${loc.radius_m||10}m</div>
              </div>
              <button class="act-btn del" onclick="deleteLocation(${loc.id},'${(loc.name||'').replace(/'/g,'')}')">🗑</button>
            </div>`).join('') :
            '<div style="color:var(--text3);font-size:12px;text-align:center;padding:16px">Belum ada lokasi</div>'}
        </div>
      </div>
    </div>`;
}

function saveCloudinaryConfig() {
  const name   = document.getElementById('cfg-cloud-name')?.value.trim();
  const preset = document.getElementById('cfg-upload-preset')?.value.trim();
  if (!name || !preset) { toast('Cloud Name dan Upload Preset wajib diisi','err'); return; }
  localStorage.setItem('ol_cloudinary_name',   name);
  localStorage.setItem('ol_cloudinary_preset', preset);
  toast('✅ Cloudinary config disimpan','ok');
}

async function openLocationForm() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">📍 Tambah Lokasi Kerja</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group">
      <label>Nama Lokasi *</label>
      <input type="text" id="loc-name" placeholder="Contoh: Klinik Utama OneLab">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Latitude *</label>
        <input type="number" id="loc-lat" step="any" placeholder="-6.2088">
      </div>
      <div class="form-group">
        <label>Longitude *</label>
        <input type="number" id="loc-lng" step="any" placeholder="106.8456">
      </div>
    </div>
    <div class="form-group">
      <label>Radius Validasi (meter)</label>
      <input type="number" id="loc-radius" value="10" min="5" max="500">
      <div class="form-hint">Default 10 meter sesuai kebijakan</div>
    </div>
    <div class="form-group">
      <label>Keterangan</label>
      <input type="text" id="loc-notes" placeholder="Lantai 2, Gedung A...">
    </div>
    <div class="status-box status-warn" style="font-size:12px;margin-bottom:0">
      💡 Cara cari koordinat: buka Google Maps → klik titik lokasi → copy angka lat,lng di URL
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveLocation()">💾 Simpan Lokasi</button>
    </div>`);
}

async function saveLocation() {
  const name   = document.getElementById('loc-name')?.value.trim();
  const lat    = parseFloat(document.getElementById('loc-lat')?.value||0);
  const lng    = parseFloat(document.getElementById('loc-lng')?.value||0);
  const radius = parseInt(document.getElementById('loc-radius')?.value||10);
  if (!name || !lat || !lng) { toast('Nama dan koordinat wajib diisi','err'); return; }
  try {
    await sbPost('work_locations',{
      name, latitude:lat, longitude:lng, radius_m:radius,
      notes: document.getElementById('loc-notes')?.value.trim()||null,
      is_active: true,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    toast('✅ Lokasi disimpan','ok');
    closeModalForce();
    renderAttConfig();
    await loadAttendanceData();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteLocation(id, name) {
  if (!confirm(`Hapus lokasi "${name}"?`)) return;
  try {
    await sbDelete('work_locations',id);
    toast('🗑 Dihapus','info');
    renderAttConfig();
  } catch(e) { toast('❌ '+e.message,'err'); }
}
