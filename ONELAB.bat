@echo off
setlocal enabledelayedexpansion
title OneLab Platform
color 0A

rem ===================================================================
rem  Satu-satunya launcher OneLab Platform. Tanpa menu: sekali jalan,
rem  semua nyala. Navigasi memakai tab DI DALAM aplikasi
rem  (Sistem Utama / Portal Apps / Table Editor / SQL Studio).
rem
rem  Semua lokasi diturunkan dari %~dp0 (folder berkas ini) sehingga
rem  seluruh folder boleh dipindah ke drive/komputer mana pun.
rem  JANGAN menulis path absolut di berkas ini.
rem
rem  Perintah tambahan (opsional, tanpa mengganggu alur biasa):
rem     ONELAB.bat backup    -> hanya membuat cadangan basis data
rem ===================================================================

set "ROOT=%~dp0"
set "EXE=%ROOT%desktop-app\release\win-unpacked\OneLab Desktop.exe"
set "PLATFORM=%ROOT%onelab-platform-main\onelab-platform"
set "CONNECTOR=%PLATFORM%\connector\onelab-connector.js"
set "DATADIR=%ROOT%desktop-app\pglite-data"

if /i "%~1"=="backup" goto backup

echo =================================================================
echo    ONELAB PLATFORM  -  Klinik . Laboratorium . Wellness
echo    DB lokal (PGlite/Postgres) + QMS ISO 15189 + Agentic AI
echo =================================================================
echo.

if not exist "%EXE%" (
  echo  [!] Aplikasi belum dibangun. Tidak ketemu:
  echo      %EXE%
  echo      Bangun dulu dari folder desktop-app dengan: npm run build:exe
  echo.
  pause
  goto selesai
)

rem --- Lab Connector: proses ringan terpisah, tidak menahan boot aplikasi.
rem     Hanya dinyalakan bila Node.js ada DAN connector sudah dikonfigurasi.
if not exist "%PLATFORM%\connector\config.json" goto lewati_connector
where node >nul 2>&1
if errorlevel 1 goto lewati_connector
echo  [.] Lab Connector       dinyalakan di latar belakang
start /min "OneLab Lab Connector" node "%CONNECTOR%"
goto lanjut

:lewati_connector
echo  [-] Lab Connector       dilewati (perlu Node.js + connector\config.json)

:lanjut
echo  [.] Sistem Utama        menyalakan aplikasi...
echo.
echo      Boot pertama sekitar 10-15 detik untuk menyiapkan basis data.
echo      Setelah terbuka, pindah halaman lewat tab di dalam aplikasi.
echo.
start "" "%EXE%"
goto selesai

:backup
if not exist "%DATADIR%" (
  echo  [!] Folder data tidak ketemu: %DATADIR%
  pause
  goto selesai
)
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set "STAMP=%%i"
echo  Membuat cadangan basis data... (bisa beberapa menit)
tar -czf "%ROOT%backup-onelab-!STAMP!.tar.gz" -C "%ROOT%desktop-app" pglite-data
if errorlevel 1 (
  echo  [!] Cadangan GAGAL. Pastikan aplikasi OneLab sedang tertutup, lalu ulangi.
) else (
  echo  [OK] Cadangan tersimpan: %ROOT%backup-onelab-!STAMP!.tar.gz
)
pause

:selesai
endlocal
exit /b 0
