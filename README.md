# Softload untuk Windows (tanpa Linux)

Backend berjalan langsung pada Windows 10/11 64-bit atau Windows Server,
dengan Node.js, FFmpeg, dan yt-dlp.exe. Tidak memerlukan Linux, WSL, Docker, atau bash.
Web bisa dibuka lokal; integrasi Vercel tetap tersedia.

## Menjalankan di komputer Windows

1. Ekstrak ZIP ke folder milik Anda, misalnya Documents\Softload.
2. Buka PowerShell di folder softload yang berisi skrip berikut.
3. Jalankan:

   .\Setup-Windows.ps1
   .\Start-Windows.ps1

4. Tunggu tulisan "Buka http://127.0.0.1:8081", lalu buka alamat itu di browser.
5. Tempel URL YouTube, pilih MP4/MP3, tunggu berkas siap, lalu klik Simpan berkas.
6. Biarkan PowerShell berjalan selama menggunakan web. Ctrl+C menghentikan proses.

Jika PowerShell menolak skrip hasil unduhan, periksa isi skrip lalu buka blokir:

   Unblock-File -LiteralPath .\Setup-Windows.ps1
   Unblock-File -LiteralPath .\Start-Windows.ps1
   Unblock-File -LiteralPath .\Start-Backend-Windows.ps1

Ikuti kebijakan administrator perangkat jika skrip tetap diblokir.
Setup memasang Node.js/FFmpeg melalui winget jika belum tersedia, mengunduh yt-dlp.exe
resmi ke backend\tools, memeriksa checksum, dan membuat secret acak di backend\.env.
Koneksi internet diperlukan. Installer dependensi mungkin meminta izin administrator.
Node.js harus versi 22 atau lebih baru. Jika perintah belum dikenali sesudah instalasi,
tutup lalu buka PowerShell baru dan jalankan setup kembali.

## Menghubungkan Windows ke Vercel

Vercel tidak dapat mengakses 127.0.0.1 di komputer Anda.
Backend Windows harus memiliki alamat HTTPS publik; komputer harus terus menyala.

1. Jalankan Setup-Windows.ps1.
2. Arahkan subdomain, misalnya api.domain-anda.com, ke IP publik server Windows.
3. Pasang Caddy Windows dari https://caddyserver.com/download.
4. Edit backend\.env; pertahankan secret acak yang sudah dibuat:

   BACKEND_SECRET=secret_yang_sudah_dibuat
   PUBLIC_BASE_URL=https://api.domain-anda.com

5. Edit domain pada backend\Caddyfile.windows.
6. Izinkan TCP 80/443 untuk Caddy di Windows Firewall. Jika memakai router,
   teruskan port tersebut ke komputer Windows. Jika koneksi memakai CGNAT,
   gunakan server Windows ber-IP publik atau layanan tunnel HTTPS permanen.
7. Pada PowerShell pertama jalankan:

   .\Start-Backend-Windows.ps1

8. Pada PowerShell kedua jalankan (sesuaikan lokasi caddy.exe):

   & 'C:\Tools\Caddy\caddy.exe' run --config .\backend\Caddyfile.windows --adapter caddyfile

9. Periksa https://api.domain-anda.com/healthz. Harus mengembalikan {"ok":true}.
   Caddy memperoleh sertifikat HTTPS setelah DNS, firewall, dan port siap.
10. Jangan jalankan Start-Windows.ps1 dan Start-Backend-Windows.ps1 bersamaan:
    keduanya memakai port backend 8080.

Backend mendengarkan 127.0.0.1:8080; akses publik melalui Caddy.
Skrip tidak mengubah firewall, router, atau DNS secara otomatis.
Administrator dapat memakai Task Scheduler agar backend dan Caddy mulai otomatis.

## Deploy frontend ke Vercel

1. Unggah proyek ke repositori Git. Jangan unggah .env atau backend\tools.
2. Impor ke Vercel; root berisi package.json, api, public, dan vercel.json.
3. Framework: Other. Build Command: kosong. Output Directory: public.
4. Isi environment variable:

   BACKEND_URL=https://api.domain-anda.com
   BACKEND_SECRET=secret_yang_sama_dengan_backend_Windows

5. Deploy. Jika variabel diubah, Redeploy.

File video diunduh langsung dari Windows melalui tautan bertanda tangan.
Secret hanya digunakan pada server, bukan variabel publik browser.

## Fitur dan batas

- Metadata asli, thumbnail, MP4 sampai 1080p yang tersedia, MP3 192 kbps.
- Progres, pembatalan, mode gelap, dan riwayat browser.
- Pembatalan Windows menghentikan yt-dlp dan proses FFmpeg turunannya.
- Maksimum 30 menit/video, 250 MB/hasil, dua unduhan aktif, 30 pekerjaan tersimpan.
- Berkas dihapus setelah satu jam atau restart; riwayat browser tetap ada.
- Riwayat berarti berkas siap, bukan bukti file tersimpan di disk pengguna.
- Tidak mendukung live atau melewati akses video privat.
- YouTube dapat membatasi video atau IP server.
- Sediakan ruang kosong sekitar 10 GB dan RAM sedikitnya 2 GB.

## Pembaruan dan pengujian

Hentikan Softload dan jalankan Setup-Windows.ps1 untuk memperbarui yt-dlp.
Secret yang sudah ada tidak ditimpa.

   node --test --test-isolation=none tests/core.test.mjs tests/ui.test.mjs

Tes memakai metadata dan respons contoh. Uji unduhan sungguhan dengan video pendek
yang boleh Anda unduh, simpan MP4/MP3, lalu putar keduanya.

## Referensi resmi

- https://github.com/yt-dlp/yt-dlp/wiki/Installation
- https://github.com/yt-dlp/yt-dlp/wiki/EJS
- https://caddyserver.com/docs/running

   
                                                                                                                                                                                                           