# OneLab Connector — Integrasi Alat Lab (ASTM / HL7)

Jembatan antara **alat lab** (yang bicara TCP mentah di jaringan lokal) dan
**OneLab/Supabase** (cloud, HTTPS). Alat lab tak bisa mengirim langsung ke cloud —
connector inilah perantaranya.

```
Alat Lab ──TCP(ASTM/HL7)──► OneLab Connector (PC di lab) ──HTTPS──► Supabase ──► OneLab
   ▲                              (framing + ACK + push)                          (parse & validasi)
   └──────────── ACK ─────────────┘
```

## Prasyarat
- **PC/mini-PC Windows** yang selalu nyala, **satu jaringan (LAN)** dengan alat.
- **Node.js 18+** (`node --version`). Unduh: https://nodejs.org
- SQL `supabase_analyzer_bridge.sql` sudah dijalankan di Supabase.
- Master alat di OneLab sudah diisi **IP, Port, Mode, Protokol** (menu Alat).

## Setup (sekali)
1. Salin folder `connector/` ini ke PC lab.
2. Salin `config.example.json` → `config.json`, isi `supabase_key` (anon key dari OneLab).
3. Jalankan:
   ```
   cd connector
   node onelab-connector.js
   ```
4. Terminal akan menampilkan: `🟢 <alat>: LISTEN :<port>` dan `🖥  Status lokal: http://localhost:9999`.

## Halaman status lokal (di PC connector)
Buka **http://localhost:9999** di PC connector untuk memantau tanpa membaca terminal:
- daftar alat + indikator 🟢 tersambung / ⚪ belum,
- jumlah pesan & waktu pesan terakhir per alat,
- log langsung (auto-refresh 3 dtk),
- tombol **Muat ulang config** (menarik alat baru dari OneLab tanpa restart).

Hanya bisa dibuka **di PC connector** (`127.0.0.1`) — log bisa memuat identitas
pasien, jadi sengaja tidak diekspos ke jaringan. Ganti port lewat `status_port` di `config.json`.
Manajemen penuh (status semua alat, pesan masuk, terapkan hasil) tetap di **OneLab → LIS → Integrasi Alat**.

## Konfigurasi alat (di OneLab, bukan di sini)
Isi di master Alat OneLab per analyzer:
- **Mode `server`** (paling umum): connector membuka port; **di menu alat isi IP = IP PC connector** + port yang sama. Alat mengirim hasil ke connector.
- **Mode `client`**: connector yang menghubungi alat — isi **IP + port alat**.
- **Protokol**: `ASTM` atau `HL7`.
- **Arah**: `oneway` (hasil masuk saja) atau `twoway` (+ OneLab kirim order ke alat).

Untuk cari IP PC connector di Windows: `ipconfig` → IPv4 Address (mis. `192.168.1.50`).

## Alur data
1. Alat kirim hasil → connector balas **ACK** (wajib) → teruskan mentah ke `analyzer_ingest`.
2. Pesan masuk ke tabel `analyzer_messages` (status `RECEIVED`).
3. OneLab mem-parse (HL7 OBX / ASTM R / CSV) & mencocokkan ke sampel via **host_code** →
   isi `lab_results` (draft, `is_auto`) → **analis validasi (manusia)**.
4. Monitor "alat diam" otomatis oleh agentic `INTEGRATION_HEALTH`.

## Jalankan otomatis saat PC nyala (Windows)
Opsi mudah — Task Scheduler:
1. Buka **Task Scheduler** → Create Basic Task → Trigger: *When the computer starts*.
2. Action: *Start a program* → Program: `node`, Arguments: `onelab-connector.js`,
   Start in: path folder `connector`.
3. (Opsional) centang *Run whether user is logged on or not*.

Atau pakai `pm2` (`npm i -g pm2 && pm2 start onelab-connector.js && pm2 save && pm2-startup install`).

## Dua-arah (order → alat)
Mode `twoway` sudah di-scaffold (ASTM O-record / HL7 ORM). **Format order sangat
spesifik per alat** — pola query-detection & susunan record di `maybeSendOrders()` /
`sendAstmOrders()` / `sendHl7Orders()` perlu disesuaikan dengan manual alat Anda.
Mulai dari `oneway` dulu; aktifkan `twoway` setelah pola order alat dipastikan.

## Keamanan
- Connector menulis ke **staging** (`analyzer_messages`), bukan langsung `lab_results`.
- Pengisian hasil final tetap lewat parse + validasi manusia (tidak ada hasil klinis
  yang otomatis dirilis).
- Simpan `config.json` (berisi key) hanya di PC lab; jangan commit.

## Troubleshooting
- **Alat tak konek**: pastikan IP PC benar (`ipconfig`), port sama, firewall Windows
  mengizinkan Node.js pada port itu (Inbound Rule), PC & alat satu subnet.
- **`RPC ... HTTP 401/403`**: `supabase_key` salah.
- **Konek tapi tak ada data**: cek protokol (ASTM vs HL7) di master alat; lihat log mentah
  di OneLab (`analyzer_messages`).
