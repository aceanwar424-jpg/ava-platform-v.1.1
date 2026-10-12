# PANDUAN TEKNIS INTEGRASI ANALYZER LABORATORIUM (ASTM E1381 / E1394)
**Instalasi Fisik Serial RS-232, Device Server Moxa / USR-TCP, dan Port Listener :9999**

> **OWNED_BY: generic / technical guide**  
> Ditujukan untuk: Teknisi Laboratorium, IT Support Rumah Sakit/Klinik, dan Field Application Specialist.

---

## 1. Topologi Arsitektur Koneksi

```
[ Medical Analyzer ]
  (Sysmex / Mindray / Cobas)
         │
         │ Kabel Serial DB9 (RS-232 Null Modem / Pinout 2-3 Cross, 5 GND)
         ▼
[ Serial Device Server ]
  (Moxa NPort 5110 / USR-TCP232-302)
         │
         │ Kabel LAN UTP (Ethernet RJ45 / IP Static 192.168.1.xxx)
         ▼
[ Local Switch / Router Faskes ]
         │
         │ Protokol TCP Raw Stream
         ▼
[ LIS ASTM Server (:9999) ]
  (ava-platform / lib/bridge/astm_listener.js)
```

---

## 2. Pinout Kabel Serial RS-232 (DB9 Male to DB9 Female)

Kebanyakan instrumen laboratorium menggunakan koneksi **Null Modem Cable (Crossed)** atau **Straight-Through**:

### Skema Pinout Null Modem Standar (Rekomendasi Utama):
| Pin DB9 Sisi Analyzer | Sinyal | Pin DB9 Sisi Device Server (Moxa) | Sinyal |
| :---: | :---: | :---: | :---: |
| **Pin 2** | RxD (Receive Data) | **Pin 3** | TxD (Transmit Data) |
| **Pin 3** | TxD (Transmit Data) | **Pin 2** | RxD (Receive Data) |
| **Pin 5** | GND (Signal Ground) | **Pin 5** | GND (Signal Ground) |
| **Pin 7** | RTS (Request to Send) | **Pin 8** | CTS (Clear to Send) |
| **Pin 8** | CTS (Clear to Send) | **Pin 7** | RTS (Request to Send) |

*Catatan:* Bila instrumen menggunakan *Hardware Handshake*, Pin 7 dan 8 wajib terhubung. Bila menggunakan *Software Handshake (XON/XOFF)* atau *ASTM ACK/NAK Protocol*, cukup hubungkan **Pin 2, 3, dan 5**.

---

## 3. Konfigurasi Serial Device Server (Contoh: Moxa NPort 5110)

1. Hubungkan PC laptop ke Moxa menggunakan kabel LAN, buka browser dan akses IP default: `http://192.168.127.254` (atau gunakan *NPort Administrator Tool*).
2. **Network Settings:**
   - Ubah ke IP Statis dalam subnet jaringan lab faskes, misal: `192.168.1.200`.
   - Subnet Mask: `255.255.255.0`, Gateway: `192.168.1.1`.
3. **Serial Parameters:**
   - **Baud Rate:** `9600` (atau sesuai manual instrumen: `19200` / `115200`).
   - **Data Bits:** `8`
   - **Stop Bits:** `1`
   - **Parity:** `None`
   - **Flow Control:** `None` (ASTM menggunakan frame level ACK/NAK).
4. **Operating Mode:**
   - Pilih mode: **TCP Client** atau **TCP Server**.
   - Bila diatur sebagai **TCP Client**: Masukkan IP LIS Server (misal `192.168.1.50`) dan Destination Port: `9999`.

---

## 4. Konfigurasi Pada Menu Layar Analyzer

Buka menu instrumen (*Settings* / *Maintenance* / *Communication* / *Host / LIS*):
1. **Protocol:** Pilih `ASTM E1381 / E1394` atau `ASTM 1394-97`.
2. **Transmission Mode:** `Real-time Upload` (Auto Send hasil segera setelah selesai analisis).
3. **Frame Checksum:** `Enabled` (Wajib aktif untuk integritas data 2-digit HEX checksum).
4. **Sample ID Source:** `Barcode Reader` (Menggunakan tabung ber-barcode dari LIS).

---

## 5. Alur Handshake Protokol ASTM E1381

```
Analyzer (Sender)                        LIS Server Port :9999 (Receiver)
       │                                                │
       │ ─── ENQ (0x05) ──────────────────────────────▶ │  (Analyzer minta izin kirim)
       │ ◀── ACK (0x06) ─────────────────────────────── │  (LIS siap terima)
       │                                                │
       │ ─── STX [1H|\^&|||...CR] ETX [Checksum] CRLF ─▶ │  (Header Record)
       │ ◀── ACK (0x06) ─────────────────────────────── │
       │                                                │
       │ ─── STX [2P|1||PatientID...CR] ETX [CS] CRLF ──▶ │  (Patient Record)
       │ ◀── ACK (0x06) ─────────────────────────────── │
       │                                                │
       │ ─── STX [3O|1|SampleBarcode...CR] ETX [CS] CRLF ▶ │  (Order Record)
       │ ◀── ACK (0x06) ─────────────────────────────── │
       │                                                │
       │ ─── STX [4R|1|^^^718-7|14.5|g/dL...CR] ETX CR ─▶ │  (Result Record: Hb 14.5 g/dL)
       │ ◀── ACK (0x06) ─────────────────────────────── │
       │                                                │
       │ ─── STX [5L|1|N...CR] ETX [CS] CRLF ──────────▶ │  (Terminator Record)
       │ ◀── ACK (0x06) ─────────────────────────────── │
       │                                                │
       │ ─── EOT (0x04) ──────────────────────────────▶ │  (Selesai Sesi Transmisi)
```

---

## 6. Prosedur Uji Coba & Troubleshooting di Lapangan

1. **Uji Loopback Kabel Serial:**
   - Gunakan terminal PuTTY / TeraTerm di laptop teknisi dengan menghubungkan Pin 2 dan 3. Huruf yang diketik harus memantul kembali (*echo*).
2. **Uji Koneksi TCP Socket:**
   - Jalankan perintah di komputer LIS: `telnet 192.168.1.200 4001` (atau port Moxa) untuk memastikan jalur Ethernet tidak diblokir firewall.
3. **Uji Penerimaan Hasil:**
   - Jalankan listener LIS di port `:9999`.
   - Lakukan pemeriksaan sampel kontrol pada alat dan tekan tombol *Transmit*.
   - Periksa log LIS apakah frame `H`, `P`, `O`, `R`, `L` tertangkap dan otomatis masuk ke antrean validasi dokter/analis.
