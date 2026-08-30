const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(
  'D:/ava-platform-main/ava-platform/js/core/fhirConverter.js', 'utf8');

const sandbox = { console, fetch: async () => ({ ok: false }), JSON, Date, Math, Object, Array,
  String, Number, parseFloat, parseInt, isNaN, Set, Map, RegExp, Error };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const F = sandbox.window.fhirConverter;

let lulus = 0, gagal = 0;
function ok(nama, syarat) {
  if (syarat) { lulus++; console.log('  ✓ ' + nama); }
  else { gagal++; console.log('  ✗ GAGAL: ' + nama); }
}
function harusTolak(nama, fn, potongan) {
  try { fn(); gagal++; console.log('  ✗ GAGAL (tidak ditolak): ' + nama); }
  catch (e) {
    const cocok = !potongan || String(e.message).toLowerCase().includes(potongan.toLowerCase());
    if (cocok) { lulus++; console.log('  ✓ ' + nama); }
    else { gagal++; console.log(`  ✗ ditolak tapi pesannya lain: ${nama} → ${e.message}`); }
  }
}

const pasienSah = { nik: '3171234567890123', patient_name: 'Budi Santoso',
  birth_date: '1988-04-17', gender: 'L', phone: '081234567890', id: 'p1' };

console.log('\n── Patient ──');
const p = F.convertToFhirPatient(pasienSah);
ok('gender L → male', p.gender === 'male');
ok('tanggal lahir dipakai apa adanya', p.birthDate === '1988-04-17');
ok('NIK masuk identifier', p.identifier[0].value === '3171234567890123');
ok('telepon disertakan bila ada', p.telecom && p.telecom[0].value === '081234567890');

const tanpaTelp = F.convertToFhirPatient({ ...pasienSah, phone: '' });
ok('telepon DIHILANGKAN bila kosong (bukan dikarang)', !('telecom' in tanpaTelp));

ok('gender P → female', F.convertToFhirPatient({ ...pasienSah, gender: 'P' }).gender === 'female');
ok('gender "Perempuan" → female', F.convertToFhirPatient({ ...pasienSah, gender: 'Perempuan' }).gender === 'female');

harusTolak('tanggal lahir kosong ditolak', () => F.convertToFhirPatient({ ...pasienSah, birth_date: '' }), 'tanggal lahir');
harusTolak('tanggal lahir bukan YYYY-MM-DD ditolak', () => F.convertToFhirPatient({ ...pasienSah, birth_date: '17/04/1988' }), 'tanggal lahir');
harusTolak('gender kosong ditolak (dulu jadi female)', () => F.convertToFhirPatient({ ...pasienSah, gender: '' }), 'jenis kelamin');
harusTolak('gender ngawur ditolak', () => F.convertToFhirPatient({ ...pasienSah, gender: 'X' }), 'jenis kelamin');
harusTolak('NIK 15 digit ditolak', () => F.convertToFhirPatient({ ...pasienSah, nik: '317123456789012' }), 'NIK');

console.log('\n── Condition (dari patient_problems) ──');
const dxAktif = { satusehat_patient_id: 'ss-1', icd_code: 'E11.9',
  diagnosis: 'Diabetes melitus tipe 2 tanpa komplikasi', status: 'Aktif',
  onset_date: '2026-01-15', created_at: '2026-01-15T08:00:00Z' };

const c = F.convertToFhirCondition(dxAktif);
ok('clinicalStatus active', c.clinicalStatus.coding[0].code === 'active');
ok('kode ICD-10 benar', c.code.coding[0].code === 'E11.9' && /icd-10/.test(c.code.coding[0].system));
ok('subject menunjuk Patient SATUSEHAT', c.subject.reference === 'Patient/ss-1');
ok('onsetDateTime ada', c.onsetDateTime === '2026-01-15');
ok('tidak ada abatement pada diagnosis aktif', !('abatementDateTime' in c));

const cSelesai = F.convertToFhirCondition({ ...dxAktif, status: 'Teratasi', resolved_at: '2026-06-01' });
ok('status Teratasi → resolved', cSelesai.clinicalStatus.coding[0].code === 'resolved');
ok('abatementDateTime terisi saat teratasi', cSelesai.abatementDateTime === '2026-06-01');

const cAktifTapiAdaTgl = F.convertToFhirCondition({ ...dxAktif, resolved_at: '2026-06-01' });
ok('abatement TIDAK ikut bila masih aktif walau tanggalnya terisi', !('abatementDateTime' in cAktifTapiAdaTgl));

ok('catatan bebas tidak ikut terkirim',
   !JSON.stringify(F.convertToFhirCondition({ ...dxAktif, notes: 'curiga TB, cek ulang' })).includes('curiga TB'));

harusTolak('tanpa kode ICD ditolak', () => F.convertToFhirCondition({ ...dxAktif, icd_code: '' }), 'ICD');
harusTolak('status tak dikenal ditolak', () => F.convertToFhirCondition({ ...dxAktif, status: 'Kronis' }), 'status');
harusTolak('pasien belum tertaut ditolak', () => F.convertToFhirCondition({ ...dxAktif, satusehat_patient_id: '' }), 'pasien');

console.log('\n── Composition (dari clinical_notes) ──');
const notaSah = { satusehat_patient_id: 'ss-1', note_type: 'SOAP',
  subjective: 'Batuk 3 hari', objective: 'Suhu 37.8 C', assessment: 'ISPA',
  plan: 'Parasetamol 3x500mg', author_name: 'dr. Siti', author_role: 'Dokter',
  signed_at: '2026-08-18T10:00:00Z', locked: true };

const k = F.convertToFhirComposition(notaSah);
ok('status final saat terkunci', k.status === 'final');
ok('empat section terisi', k.section.length === 4);
ok('judul section benar', k.section.map(s => s.title).join(',') === 'Subjective,Objective,Assessment,Plan');
ok('isi masuk ke XHTML', k.section[0].text.div.includes('Batuk 3 hari'));
ok('penulis beserta perannya', k.author[0].display === 'dr. Siti (Dokter)');

const kSebagian = F.convertToFhirComposition({ ...notaSah, objective: '', plan: '   ' });
ok('section kosong DIHILANGKAN, bukan diisi tanda hubung', kSebagian.section.length === 2);
ok('tidak ada section berisi "-"', !JSON.stringify(kSebagian).includes('>-<'));

const kEsc = F.convertToFhirComposition({ ...notaSah, assessment: 'suhu < 38 & nadi > 90' });
const divA = kEsc.section.find(s => s.title === 'Assessment').text.div;
ok('karakter < > & diloloskan', divA.includes('&lt; 38 &amp; nadi &gt; 90'));

harusTolak('catatan belum ditandatangani ditolak', () => F.convertToFhirComposition({ ...notaSah, signed_at: null }), 'ditandatangani');
harusTolak('S/O/A/P semuanya kosong ditolak',
  () => F.convertToFhirComposition({ ...notaSah, subjective: '', objective: '', assessment: '', plan: '' }), 'kosong');
harusTolak('tanpa nama penulis ditolak', () => F.convertToFhirComposition({ ...notaSah, author_name: '' }), 'penulis');

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
