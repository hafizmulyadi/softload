# Softload - Vercel + backend unduhan

UI Softload, API Vercel, dan backend yt-dlp/FFmpeg disertakan. Ini bukan simulasi progres atau unduhan.
Paket ini belum diterbitkan. Agar bekerja, jalankan backend HTTPS dan isi dua environment variable di Vercel.
Tidak ada API berbayar yang diperlukan oleh kode ini. Hosting server dan domain tetap Anda sediakan.

## Yang tersedia

- URL YouTube, youtu.be, Shorts: validasi domain dan pembacaan metadata asli.
- Gambar mini, judul, kanal, durasi, kualitas MP4 yang tersedia.
- MP4 sampai 1080p, atau MP3 192 kbps.
- Progres unduhan aktual; saat konversi, indikator menunggu tanpa persentase palsu.
- Pembatalan proses dan tombol untuk menyimpan file yang selesai.
- Riwayat berkas siap di browser, tombol hapus, serta mode gelap/terang.
- File sementara berlaku satu jam. Tautan unduhan bertanda tangan berlaku lima menit dan dibuat ulang saat klik Simpan.
- Hanya metadata melewati Vercel. File media diunduh langsung dari backend.

## 1. Jalankan backend

Siapkan server Linux dengan Docker Compose, domain/subdomain, dan akses keluar ke YouTube.
Untuk konfigurasi bawaan, gunakan server setidaknya 2 CPU, RAM 2 GB, dan ruang kosong 10 GB.
Paket ini menggunakan satu instance backend. Jangan menambah replica dengan volume yang sama.

1. Arahkan DNS subdomain, misalnya api.domain-anda.com, ke IP server.
2. Salin folder backend ke server, lalu buka terminal di folder tersebut.
3. Jalankan:

   cp .env.example .env
   openssl rand -hex 32

4. Edit .env:

   BACKEND_SECRET=hasil_random_dari_perintah_di_atas
   BACKEND_DOMAIN=api.domain-anda.com
   PUBLIC_BASE_URL=https://api.domain-anda.com

   BACKEND_DOMAIN hanya nama domain, tanpa https:// atau path.
   PUBLIC_BASE_URL adalah alamat HTTPS domain yang sama.
   Jangan gunakan teks contoh sebagai secret. Jangan unggah .env ke Git.

5. Buka port 80 dan 443 pada firewall server.
6. Jalankan:

   docker compose up -d --build
   docker compose logs --tail=100

7. Buka https://api.domain-anda.com/healthz. Hasilnya harus {"ok":true}.
   Caddy mengurus sertifikat HTTPS secara otomatis setelah DNS dan port benar.
   Endpoint healthz hanya memeriksa server hidup, bukan akses YouTube.

Jika penyedia hosting Docker sudah memberi HTTPS dan domain, deploy folder backend dengan Dockerfile,
set BACKEND_SECRET serta PUBLIC_BASE_URL, dan gunakan port 8080. Caddy/Compose tidak diperlukan.
Sediakan penyimpanan yang dapat ditulis di /data, setidaknya RAM 2 GB, satu replica.

## 2. Deploy web ke Vercel

1. Ekstrak ZIP dan unggah isi proyek ke repositori Git milik Anda.
2. Di Vercel, pilih Add New Project dan impor repositori tersebut.
3. Root Directory: folder yang berisi package.json, vercel.json, api/, public/.
4. Framework Preset: Other. Build Command: kosong. Output Directory: public.
5. Tambahkan environment variable untuk Production (dan Preview jika digunakan):

   BACKEND_URL=https://api.domain-anda.com
   BACKEND_SECRET=secret_yang_sama_dengan_backend

6. Klik Deploy. Jika variabel diubah kemudian, lakukan Redeploy.
7. Buka web. Bagian bawah harus menyatakan layanan terhubung.

BACKEND_SECRET hanya digunakan di fungsi server Vercel. Jangan mengubahnya menjadi variabel publik.
Jangan mengunggah hanya index.html: folder api dan file konfigurasi juga diperlukan.

## 3. Uji alur sungguhan setelah deploy

1. Gunakan tautan video pendek yang boleh Anda unduh.
2. Periksa judul/durasi dan kualitas yang tersedia.
3. Pilih MP4 360p, tunggu sampai berkas siap, klik Simpan, lalu putar file tersebut.
4. Ulangi untuk MP3 dan pastikan audionya dapat diputar.
5. Coba pembatalan pada video lain; status harus berhenti tanpa berkas siap.
6. Segarkan halaman: tema dan riwayat tetap ada. Klik Simpan dari riwayat sebelum satu jam.
7. Uji URL yang salah: harus ditolak tanpa menjalankan perintah ke server.

## Batas operasi bawaan

- Durasi video maksimal 30 menit. Live/upcoming tidak didukung.
- Maksimal dua unduhan aktif dan dua pemeriksaan metadata bersamaan.
- Maksimal 250 MB per file hasil; proses unduhan dibatasi 20 menit.
- Maksimal 30 pekerjaan tersimpan, dengan pembersihan setelah satu jam.
- Restart backend menghapus pekerjaan dan file sementara. Riwayat browser tetap ada, tetapi file lama harus diproses ulang.
- Ukuran ditampilkan sebagai perkiraan hanya jika YouTube menyediakan ukurannya.
- Riwayat berarti file telah selesai diproses, bukan bukti browser sudah menyimpan file ke disk.

## Jika ada masalah

- "Backend belum dikonfigurasi": isi variabel Vercel dan Redeploy.
- "Backend tidak dapat dihubungi": periksa HTTPS, PUBLIC_BASE_URL, secret yang sama, dan log backend.
- "YouTube membatasi akses": IP server mungkin dibatasi atau video memerlukan autentikasi.
  Paket ini tidak melewati pembatasan akses. Tidak semua video atau IP hosting dijamin didukung.
- Kualitas tidak tersedia: pilih kualitas lain dari metadata terbaru.
- Tombol tempel tidak diizinkan: gunakan tempel manual pada browser.
- "Server penuh": tunggu proses selesai atau berkas kedaluwarsa.

Perbarui yt-dlp beserta solver EJS dengan membangun ulang image:

   docker compose build --pull --no-cache backend
   docker compose up -d

Perintah pembaruan/restart menghapus file sementara. Lakukan saat tidak ada unduhan aktif.

## Validasi paket

Pengujian unit dan kontrak API dapat dijalankan dengan Node 22:

   npm test

Pengujian menggunakan metadata dan respons backend buatan untuk memeriksa logika;
bukan bukti bahwa akses YouTube dari server produksi telah berhasil.
Pada lingkungan pembuatan paket, Docker dan yt-dlp tidak tersedia, sehingga image Docker,
konversi media, serta unduhan YouTube langsung belum dapat diuji.

## Referensi resmi

- https://github.com/yt-dlp/yt-dlp
- https://github.com/yt-dlp/yt-dlp/wiki/EJS
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/project-configuration


                                                         