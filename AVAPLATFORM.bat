@echo off
setlocal enabledelayedexpansion
title AVA GLOBAL ECOSYSTEM Platform
color 0A

rem ===================================================================
rem  Satu-satunya launcher AVA GLOBAL ECOSYSTEM Platform.
rem  Tanpa menu: sekali jalan, semua menyala. Navigasi memakai tab
rem  DI DALAM aplikasi (Sistem Utama / Portal Apps / Table Editor / SQL Studio).
rem
rem  Semua lokasi diturunkan dari %~dp0 (folder berkas ini) sehingga
rem  seluruh folder boleh dipindah ke drive/komputer mana pun.
rem  JANGAN menulis path absolut di berkas ini.
rem
rem  Perintah tambahan (opsional, tanpa mengganggu alur biasa):
rem     AVAPLATFORM.bat backup    -> membuat cadangan basis data
rem ===================================================================

set "ROOT=%~dp0"
set "ELECTRON_BIN=%ROOT%desktop-app\node_modules\electron\dist\electron.exe"
set "ELECTRON_MAIN=%ROOT%desktop-app\dist-electron\main.js"
set "EXE=%ROOT%desktop-app\release\win-unpacked\AVA Desktop.exe"
if not exist "%EXE%" set "EXE=%ROOT%desktop-app\release\win-unpacked\AVA GLOBAL ECOSYSTEM Desktop.exe"
set "PLATFORM=%ROOT%ava-platform"
set "CONNECTOR=%PLATFORM%\connector\ava-connector.js"
set "DATADIR=%ROOT%desktop-app\pglite-data"

if /i "%~1"=="backup" goto backup

echo =================================================================
echo    AVA GLOBAL ECOSYSTEM  -  PT AVA HEALTH SOLUTION
echo    Health . Lab . Tech . Care . Nutrition . Sanctuary
echo    DB lokal (PGlite/Postgres) + QMS ISO 15189 + Agentic AI
echo =================================================================
echo.

rem --- Lab Connector: proses ringan terpisah, tidak menahan boot aplikasi.
rem     Hanya dinyalakan bila Node.js ada DAN connector sudah dikonfigurasi.
if not exist "%PLATFORM%\connector\config.json" goto lewati_connector
where node >nul 2>&1
if errorlevel 1 goto lewati_connector
echo  [.] Lab Connector       dinyalakan di latar belakang
start /min "AVA Lab Connector" node "%CONNECTOR%"
goto lanjut

:lewati_connector
echo  [-] Lab Connector       dilewati (perlu Node.js + connector\config.json)

:lanjut
echo  [.] Sistem Utama        menyalakan AVA GLOBAL ECOSYSTEM...
echo.
echo      Boot pertama sekitar 10-15 detik untuk menyiapkan basis data.
echo      Setelah terbuka, navigasi 12 subdomain via bilah simulator.
echo.

rem Prioritaskan build terbaru (dist-electron) agar perubahan UI selalu termuat
if exist "%ELECTRON_BIN%" if exist "%ELECTRON_MAIN%" (
  start "" "%ELECTRON_BIN%" "%ELECTRON_MAIN%"
  goto selesai
)

if exist "%EXE%" (
  start "" "%EXE%"
  goto selesai
)

echo  [!] Aplikasi belum dibangun. Jalankan: cd desktop-app ^&^& npm run build
pause
goto selesai

:backup
if not exist "%DATADIR%" (
  echo  [!] Folder data tidak ketemu: %DATADIR%
  pause
  goto selesai
)
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set "STAMP=%%i"
echo  Membuat cadangan basis data... (bisa beberapa menit)
tar -czf "%ROOT%backup-ava-ecosystem-!STAMP!.tar.gz" -C "%ROOT%desktop-app" pglite-data
if errorlevel 1 (
  echo  [!] Cadangan GAGAL. Pastikan aplikasi sedang tertutup, lalu ulangi.
) else (
  echo  [OK] Cadangan tersimpan: %ROOT%backup-ava-ecosystem-!STAMP!.tar.gz
)
pause

:selesai
endlocal
exit /b 0
