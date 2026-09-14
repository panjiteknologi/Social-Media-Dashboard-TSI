# Build Plan and Status — Content Machine

Terakhir diperbarui: 13 September 2026.

Dokumen ini adalah acuan tunggal untuk urutan pembangunan, status setiap bagian, dan integrasi yang ditunda.

---

## 1. Status saat ini

### Aplikasi

| Bagian | Status |
|---|---|
| Tampilan 8 layar: Dashboard, Content Planner, Articles, Social Media, SEO Intelligence, Analytics, Approval Queue, Reports | Selesai. Setiap bagian menampilkan status sumber datanya ("Not connected", "Not available yet", "On hold") sampai data asli masuk |
| Media Library, Workflow Logs, Settings | Masih placeholder |
| Routing dan URL per layar | Selesai |
| Konfigurasi env (`.env.example`) | Selesai |
| **M1 lokal:** backend, database, migrasi, login Google, peran pengguna, kerangka job, peringatan, CLI | **Selesai dan diuji end-to-end di lokal** (13 September 2026) |
| **M1 deploy:** Docker Compose, VPS, HTTPS, backup harian | Menunggu VPS dan subdomain |
| Integrasi data dan AI | Belum dimulai |

### Akses dan integrasi

| Integrasi | Fungsi | Milestone | Status |
|---|---|---|---|
| Google Search Console | Keyword, posisi, klik, impressions | M2 | **Terhubung (14 September).** Properti Domain `sc-domain:tsicertification.com`. Service account `content-machine-reader` punya akses Restricted, dan uji API berhasil. Pembatasan pembuatan key sempat dibuka khusus untuk project ini |
| Google Analytics 4 | Sessions, konversi, leads | M3 | **Tracking aktif dan API terhubung (14 September).** Property ID `495912713`, service account punya akses Viewer. GTM `GTM-WK2MV5GL` dipublikasikan dengan Google tag `G-T03867G3VG` dan tag GA4 Event untuk `generate_lead`, `form_submit`, `whatsapp_click`, `cta_click`, `share`, `contact_click`. Custom dimension sudah dibuat, dan `generate_lead` sudah menjadi key event (15 September). Form interactions di Enhanced measurement sudah nonaktif |
| OpenRouter | Semua fitur AI | M4 | Akun dan kredit tersedia |
| Telegram Bot | Peringatan, laporan, approval cepat | M1 | **Terhubung (14 September).** Bot `@DigmarDashboardTSI_bot`, grup "Digital Marketing Dashboard TSI". Pesan uji terkirim |
| CMS website | Inventaris artikel, publikasi, leads | M3, M6 | CMS kustom (source: `Website TSI/cms-tsicertification`). Punya modul Articles dan **Contact Messages**, yang menyimpan setiap kiriman form beserta statusnya (new, contacted, closed). Cara Content Machine membacanya belum ditentukan |
| PageSpeed Insights API | Kecepatan halaman | M4 | Belum dibuat |
| Meta (Facebook + Instagram) | Followers, insight, posting | M7 | Belum diurus |
| DataForSEO | Riset keyword baru | M8 | Opsional |
| LinkedIn | Followers, insight, posting | — | **Ditunda** (§9) |
| WhatsApp | Pengiriman laporan | — | **Ditunda**, digantikan Telegram (§9) |
| n8n | — | — | **Tidak dipakai**. Penjadwalan dibangun di dalam sistem (§7) |

---

## 2. Temuan awal tentang tsicertification.com

Dicek dari luar pada 13 September 2026, tanpa login.

| Temuan | Dampak | Tindakan |
|---|---|---|
| Situs dibangun dengan **Astro dan di-host di Vercel, bukan WordPress**. Artikel ada di `/blog/{slug}` dengan gambar dari `/api/r2/...`, jadi dikelola CMS kustom | Publikasi lewat WordPress tidak berlaku | Cari tahu siapa pengelola CMS dan apakah ada API untuk membuat atau menjadwalkan artikel. Menentukan M6 |
| ~~Tag GA4 atau Google Tag Manager tidak ditemukan~~ **Beres 14 September.** GTM `GTM-WK2MV5GL` terpasang dan dipublikasikan dengan Google tag `G-T03867G3VG`. Situs mengirim event form, WhatsApp, CTA, share dan kontak | Data GA4 baru terkumpul sejak 14 September; traffic dan leads sebelum tanggal itu tidak ada | Tandai key event dan daftarkan custom dimension di GA4 (§8) |
| ~~`sitemap.xml` dan `robots.txt` tidak ada~~ **Beres 13 September.** Keduanya sudah tayang | — | Kirim `https://tsicertification.com/sitemap.xml` di menu **Sitemaps** GSC |
| `og:image` memakai path relatif | Gambar pratinjau bisa tidak muncul saat artikel dibagikan ke media sosial | Ubah menjadi URL lengkap |
| Header respons menunjukkan halaman dirender di server Vercel region Amerika Serikat (`iad1`) tanpa cache | Setiap kunjungan dari Indonesia menunggu server di AS | Diukur dengan PageSpeed di M4 |
| Halaman `/impartiality-policy` tersedia | Sumber resmi aturan imparsialitas untuk AI | Dipakai di knowledge base M5 |

Perbaikan website di atas dikerjakan di repo website, bukan di Content Machine, dan bisa berjalan paralel.

---

## 3. Prinsip rencana

1. **Online sejak milestone pertama.** Aplikasi di-deploy ke server asli di M1. Setiap milestone setelahnya langsung dipakai tim, sehingga masalah deploy dan integrasi ketahuan lebih awal.
2. **Data dulu, AI belakangan.** Semua yang bisa dihitung dari GSC dan GA4 dikerjakan sebelum AI. AI dibangun di atas angka yang sudah dipercaya tim.
3. **Setiap milestone menghasilkan fitur yang dipakai**, bukan lapisan teknis setengah jadi.
4. **Tidak ada angka palsu di produksi.** Data yang belum terhubung ditampilkan "Belum terhubung".
5. **Urusan yang butuh pihak luar dimulai sekarang**, paralel dengan pembangunan (§8).
6. **Layar placeholder dibangun saat datanya ada:** Workflow Logs di M5, Media Library di M7, Settings bertahap di setiap milestone.

---

## 4. Arsitektur

| Komponen | Pilihan | Alasan |
|---|---|---|
| Frontend | React + Vite (sudah ada), TanStack Query untuk pengambilan data | Cache, loading, dan error ditangani konsisten |
| Backend API | Node.js + TypeScript dengan Hono | Satu bahasa dengan frontend, tipe data bisa dibagi |
| Database | PostgreSQL | Satu database untuk data, antrean job, dan log |
| Akses database | Drizzle ORM dengan migrasi | Perubahan skema tercatat di git |
| Job dan jadwal | pg-boss, dijalankan worker terpisah | Antrean di Postgres, tanpa Redis atau n8n |
| Login | Google OAuth + daftar email yang diizinkan | Tidak perlu mengelola password |
| AI | OpenRouter lewat satu modul AI gateway | Model per fitur dari env, pencatatan token dan biaya, rem anggaran bulanan |
| Deploy | Docker Compose di VPS: Caddy (HTTPS otomatis), app, worker, Postgres | Satu server, mudah dirawat |
| Backup | Dump database harian ke storage di luar server | Data aman kalau server rusak |

Struktur repo:

```
src/       frontend (sudah ada)
server/    API, job, integrasi
shared/    tipe data dan definisi metrik yang dipakai frontend dan backend
docs/      dokumen ini
```

Peran pengguna:

| Peran | Hak |
|---|---|
| Admin | Semua, termasuk Settings dan pengelolaan pengguna |
| Approver | Semua hak Editor, ditambah Approve dan Reject |
| Editor | Membuat dan mengubah konten, menjalankan fitur AI |
| Viewer | Melihat saja |

---

## 5. Milestone

### M1 — Fondasi dan online

**Status 13 September 2026:** bagian lokal selesai dan diuji end-to-end. Yang tersisa adalah deploy (Docker Compose, VPS, HTTPS, backup), yang menunggu VPS dan subdomain. File deploy sengaja belum ditulis sebelum ada server untuk mengujinya.

**Pekerjaan**

- Backend, database, migrasi, dan Docker Compose. Deploy ke VPS dengan HTTPS di subdomain.
- Login Google, peran pengguna, daftar email yang diizinkan.
- Lapisan data frontend: setiap bagian layar terikat pada sumber datanya dan menampilkan "Not connected", "Not available yet", atau "On hold" sampai data asli masuk. Data contoh desain hanya bisa ditampilkan di lokal lewat `VITE_SAMPLE_DATA=true`, dan dihapus per layar begitu datanya tersambung.
- Kerangka job: worker, retry, tabel log eksekusi, heartbeat.
- Bot Telegram sebagai kanal peringatan: job gagal, worker berhenti.
- Backup database harian.

**Butuh dari tim TSI:** VPS, subdomain, Google OAuth client, bot Telegram + chat ID, daftar pengguna dan perannya.

**Selesai bila**

- Tim bisa login di subdomain.
- Tidak ada angka contoh yang tampil.
- Job uji yang sengaja digagalkan memunculkan peringatan di Telegram.

### M2 — SEO nyata dari Search Console

**Pekerjaan**

- Ambil data GSC 16 bulan ke belakang (batas yang disimpan Google), sehingga grafik 1 tahun langsung terisi sejak hari pertama.
- Sinkronisasi harian. Tiga hari terakhir selalu diambil ulang karena data GSC baru final setelah beberapa hari.
- Cluster topik otomatis dari nama standar di query dan URL (ISO 27001, ISO 9001, HACCP, ISPO, dan seterusnya), tanpa AI.
- Metrik sesuai §6: KPI, tren dengan perbandingan periode, Keyword Tracker, pergerakan, distribusi posisi, kanibalisasi, skor peluang.
- Layar:
  - SEO Intelligence, kecuali Technical SEO Health dan Action Center.
  - Dashboard: KPI SEO, Keyword Movements, Content Requiring Attention.
  - Tombol rentang 30D / 90D / 6M / 1Y benar-benar mengubah data.
- Settings bagian SEO: keyword prioritas, ambang impressions.
- Peringatan Telegram mingguan untuk keyword prioritas yang turun.

**Butuh dari tim TSI**

- ~~Service account ditambahkan sebagai user di properti GSC.~~ Beres 14 September (Restricted, terverifikasi lewat API).
- ~~Konfirmasi jenis properti.~~ Domain: `sc-domain:tsicertification.com`.

**Siap dimulai:** semua kebutuhan dari tim TSI untuk M2 sudah terpenuhi.

**Selesai bila:** klik, impressions, CTR, dan posisi di SEO Intelligence sama dengan tampilan GSC untuk periode yang sama.

### M3 — Traffic, leads, dan inventaris artikel

**Pekerjaan**

- Sinkronisasi GA4 harian: sessions per channel, landing page, engaged sessions, dan event dari GTM (`generate_lead`, `whatsapp_click`, `cta_click`, `form_submit`) beserta parameternya.
- **Leads dari CMS:** jumlah dan status (new, contacted, closed) diambil dari Contact Messages. GA4 dipakai untuk asal leads (channel dan landing page), bukan untuk menghitung jumlahnya.
- Inventaris artikel dibaca dari modul Articles di CMS, dilengkapi daftar URL dari GSC.
- Gabungkan per URL: data GSC, data GA4, dan metadata artikel.
- Layar:
  - Articles: tabel, serta tab Overview dan Analytics di drawer.
  - Analytics: KPI, Acquisition Overview, Conversion Funnel, Content Performance.
  - Dashboard: Organic Traffic, Organic Leads, Top Performing Content.

**Butuh dari tim TSI**

- ~~Tag GA4 terpasang dan menerima data.~~ Beres 14 September lewat GTM.
- `generate_lead` ditandai sebagai key event, dan custom dimension event didaftarkan di GA4 (§8).
- Akses Google API terbuka (§1), lalu service account ditambahkan sebagai Viewer di properti GA4.
- Keputusan cara membaca data CMS: API baru di CMS, atau akses baca ke database CMS.

**Selesai bila:** organic sessions sama dengan laporan GA4, dan jumlah leads sama dengan Contact Messages di CMS untuk periode yang sama.

**Catatan:** data GA4 baru ada sejak 14 September 2026. Tren traffic sebelum tanggal itu ditampilkan "belum ada data", bukan nol.

### M4 — Laporan Telegram dan kesehatan teknis SEO

**Pekerjaan**

- Modul AI gateway: model per fitur, pencatatan token dan biaya, rem anggaran bulanan.
- Laporan harian, mingguan, dan bulanan: angka dihitung sistem, ringkasan eksekutif ditulis AI, dikirim ke Telegram. Riwayatnya tampil di layar Reports.
- Crawler mingguan. Karena situs belum punya sitemap, crawler menelusuri link internal dari beranda dan daftar URL dari GSC. Yang diperiksa:
  - halaman error dan broken link;
  - title atau meta description kosong dan duplikat;
  - alt text, canonical, schema.
- Status indexing lewat URL Inspection API. Kecepatan halaman prioritas lewat PageSpeed API.
- SEO Action Center: tugas dibuat otomatis dari aturan (ranking turun, CTR rendah, kanibalisasi, masalah teknis) dengan status Open / In Progress / Done.
- Settings bagian Reporting dan Automation: jadwal laporan, on/off setiap alur.

**Butuh dari tim TSI:** `OPENROUTER_API_KEY` di `.env`, PageSpeed API key, daftar penerima laporan.

**Selesai bila**

- Laporan pagi terkirim otomatis 7 hari berturut-turut.
- Technical SEO Health dan Action Center memakai data nyata.

### M5 — Produksi konten dengan AI dan Approval Queue

**Pekerjaan**

- Content Planner nyata: buat dan ubah ide atau konten, kanban drag & drop, kalender, list, Quick Create.
- Knowledge base di Settings bagian Brand dan AI: tone, layanan dan akreditasi, aturan CTA, aturan imparsialitas, contoh artikel.
- Klasifikasi search intent untuk keyword.
- Rantai AI: rekomendasi topik dari peluang SEO → brief → draft → QA → Approval Queue.
- Approval Queue: Approve, Request Revision (dengan catatan, lalu AI merevisi), Reject, timeline, hak Approver, notifikasi Telegram.
- Workflow Logs: daftar eksekusi, detail, dan tombol Retry, karena rantai AI mulai berjalan dan perlu dipantau.

**Butuh dari tim TSI**

- Brand guideline dan aturan CTA.
- Aturan imparsialitas yang disetujui compliance, berangkat dari halaman `/impartiality-policy`.
- 5–10 contoh artikel terbaik.
- Daftar Approver.

**Selesai bila:** satu artikel dibuat dari rekomendasi topik sampai di-approve, seluruhnya di dalam sistem.

### M6 — Publikasi ke website

Bergantung pada CMS kustom (§2).

**Pekerjaan**

- Artikel yang di-approve dikirim ke CMS sebagai draft atau dijadwalkan tayang.
- Kunci unik untuk mencegah publikasi ganda. Status tayang disinkronkan ke Articles dan Content Planner.
- Tab History di drawer artikel.

**Butuh dari tim TSI:** akses API CMS website, atau kerja sama dengan developer website untuk membuatnya.

**Selesai bila:** artikel tayang di tsicertification.com pada jam yang dijadwalkan tanpa langkah manual.

**Kalau CMS tidak punya API:** sistem menyiapkan artikel siap tempel (teks, meta, gambar), lalu mendeteksi otomatis kapan artikel sudah tayang. Publikasinya tetap manual.

### M7 — Social media: Facebook dan Instagram

**Pekerjaan**

- Snapshot followers harian dan insight per post.
- Caption dan hashtag dengan AI.
- Flyer: template brand + gambar latar dari AI.
- Media Library dengan storage R2, untuk aset dan flyer.
- Posting terjadwal ke Facebook Page dan Instagram setelah approval.
- Layar: Social Media, bagian Social Performance di Analytics, bagian Social Engagement di Dashboard.

**Butuh dari tim TSI:** Meta Business Verification dan app Meta (mulai diurus sekarang), Instagram Business yang terhubung ke Facebook Page, System User token, bucket R2, template flyer.

**Selesai bila:** followers tercatat harian dan satu post terjadwal terbit otomatis di Facebook dan Instagram.

### M8 — Penyempurnaan

- Settings lengkap.
- Pencarian global dan notifikasi di dalam aplikasi.
- Campaign Performance, dengan aturan UTM yang konsisten.
- SEO Health Score gabungan.
- Riset keyword baru dengan DataForSEO (opsional).
- AI Social Trend Intelligence.
- Tombol Approve / Request Revision langsung di Telegram.

**Butuh dari tim TSI:** keputusan DataForSEO, aturan penamaan UTM kampanye.

---

## 6. Definisi metrik

Nilai ambang di bawah adalah bawaan. Nilainya dicek ulang dengan data asli di M2 dan bisa diubah di Settings.

| Metrik | Definisi |
|---|---|
| Organic Traffic | Sessions GA4 dari channel Organic Search |
| SEO Visibility | Total impressions GSC |
| Average Position | Posisi rata-rata dari data total situs, berbobot impressions |
| Keywords Top 3 / Top 10 | Query dengan posisi rata-rata ≤ 3 / ≤ 10 dalam 28 hari terakhir, dengan impressions di atas ambang |
| Organic Leads | Key event submit form + klik WhatsApp dari sesi Organic Search |
| Pergerakan keyword | Posisi 28 hari terakhir dibanding 28 hari sebelumnya. Hanya dihitung bila impressions ≥ 50 di kedua periode |
| Status At Risk | Sebelumnya di halaman 1 (posisi ≤ 10), sekarang di luar halaman 1 |
| Status Dropping / Rising | Posisi memburuk / membaik minimal 2 |
| Status Opportunity | Posisi 8–20 dengan impressions di atas ambang |
| Status Stable | Tidak memenuhi status lain |
| Kanibalisasi | Satu query dengan 2 URL atau lebih yang masing-masing mendapat ≥ 20% impressions dalam 28 hari |
| Skor peluang (0–100) | Gabungan besar impressions dan jarak ke posisi atas. Rumus rinci ditetapkan dan diuji dengan data asli di M2 |

Kalau satu keyword memenuhi beberapa status, yang dipakai adalah urutan: At Risk, Dropping, Rising, Opportunity, Stable.

**Aturan penting**

- **Angka total diambil dari data total situs**, bukan penjumlahan baris keyword. GSC menyembunyikan sebagian query demi privasi, sehingga jumlah per keyword selalu lebih kecil dari total.
- **Data GSC tertinggal sekitar 2–3 hari.** Dashboard menampilkan "Data sampai tanggal …", bukan waktu sinkronisasi.
- **Pergerakan memakai periode 28 hari** karena volume situs masih kecil. Periode 7 hari terlalu sering memberi alarm palsu.

---

## 7. Penjadwalan dan Workflow Logs — bawaan sistem

Diputuskan 13 September 2026: dibangun di dalam sistem, tanpa n8n.

### Alasan

- **Satu sumber data.** Approval Queue dan Workflow Logs adalah layar inti. Status konten dan riwayat eksekusi disimpan di satu database, sehingga tidak ada alur yang menggantung di antara dua sistem.
- **Integrasinya sedikit dan sudah jelas:** Google, CMS website, Meta, Telegram, OpenRouter.
- **Tidak ada server tambahan** yang memegang semua kredensial.

### Cara kerja

- Antrean job disimpan di Postgres, database utama sistem.
- Job dijalankan oleh *worker*, proses terpisah dari web app, supaya job berat tidak memperlambat dashboard.

| Jenis job | Contoh | Pemicu |
|---|---|---|
| Terjadwal | Sinkronisasi GSC dan GA4, snapshot followers, laporan harian | Jadwal di Settings |
| Tertunda | Publikasi artikel, posting Facebook dan Instagram | Jam tayang yang dipilih di Content Planner |
| Rantai | Riset → brief → draft → QA → masuk Approval Queue | Tombol di dashboard atau selesainya job sebelumnya |
| Setelah approval | Menjadwalkan publikasi | Klik Approve |

### Aturan keandalan

- **Percobaan ulang**
  - Job yang gagal dicoba lagi dengan jeda yang makin panjang.
  - Kalau batas percobaan habis, status menjadi Failed dan peringatan dikirim ke Telegram.
  - Tombol Retry di Workflow Logs menjalankan ulang secara manual.
- **Tidak ada publikasi ganda.** Setiap job publikasi punya kunci unik. Sebelum mencoba ulang, sistem mengecek apakah artikel atau post sudah ada di platform tujuan.
- **Heartbeat worker.** Worker melapor secara berkala. Kalau berhenti melapor lebih dari beberapa menit, peringatan dikirim ke Telegram.
- **Jadwal terlewat.** Job yang seharusnya jalan saat server mati dijalankan sekali begitu server hidup kembali, tidak menumpuk.
- **Zona waktu.** Semua jadwal memakai Asia/Jakarta.

### Isi Workflow Logs

Setiap eksekusi mencatat:

- nama alur dan pemicunya (jadwal, manual, atau approval);
- status: Success, Running, Failed, Waiting for Approval;
- waktu mulai, durasi, dan percobaan ke berapa;
- input, output, dan pesan error;
- tautan ke artikel atau post terkait. Ini menggantikan kolom "n8n workflow reference" di desain;
- pemakaian token dan biaya AI, yang dijumlahkan untuk batas `AI_MONTHLY_BUDGET_USD`.

Riwayat disimpan 90 hari secara bawaan, bisa diubah di Settings.

### Yang bisa diubah tanpa developer

Di Settings bagian Automation:

- jam dan hari setiap jadwal;
- menyalakan atau mematikan setiap alur;
- batas percobaan ulang.

Menambah alur yang benar-benar baru tetap membutuhkan developer.

### n8n di masa depan (opsional)

Kalau tim ingin membuat otomasi kecil sendiri, misalnya mengirim data ke Google Sheets, n8n bisa memanggil API sistem ini. n8n tidak menjadi bagian dari alur inti.

---

## 8. Pekerjaan tim TSI

### Mulai sekarang

| Tugas | Untuk | Catatan |
|---|---|---|
| ~~Pastikan tag GA4 terpasang dan menerima data~~ | M3 | **Beres 14 September** lewat GTM |
| ~~Tandai `generate_lead` sebagai key event di GA4~~ | M3 | **Beres 15 September.** Hanya `generate_lead` yang diberi bintang. `whatsapp_click` sengaja tidak, karena form kontak juga memicunya |
| ~~Daftarkan custom dimension event di GA4~~ | M3 | **Beres 14 September:** `cta_name`, `form_name`, `service_inquiry`, `wa_location`, `wa_target`. Opsional: `language` |
| ~~Matikan **Form interactions** di Enhanced measurement GA4~~ | M3 | **Sudah nonaktif** (dicek 15 September). `form_start` yang terlihat di daftar event berasal dari sebelum fitur ini dimatikan, karena daftar itu mencakup 28 hari terakhir |
| Kirim sitemap di GSC | M2 | **Sitemaps** → `https://tsicertification.com/sitemap.xml` |
| Sewa VPS (2 vCPU / 4 GB RAM, lokasi Jakarta atau Singapura) dan siapkan subdomain | M1 | Contoh subdomain: `cm.tsicertification.com` |
| ~~Buka akses Google API untuk GSC dan GA4~~ | M2, M3 | **Beres 14 September.** Key service account dibuat setelah kebijakan organisasi dibuka untuk project ini |
| ~~Tambahkan service account ke GSC dan GA4~~ | M2, M3 | **Beres 14 September.** GSC Restricted, GA4 Viewer. Terverifikasi lewat API |
| ~~Kembalikan kebijakan pembuatan key ke "Inherit parent's policy"~~ | — | **Beres 15 September.** Kedua policy dihapus di level project. Key yang sudah ada tetap berfungsi (diuji ulang) |
| Buat OAuth client untuk login | M1 | Redirect URI lokal: `http://localhost:5173/api/auth/google/callback` |
| ~~Buat bot Telegram lewat @BotFather, buat grup, catat chat ID~~ | M1 | **Beres 14 September** |
| Susun daftar pengguna dan perannya | M1 | |
| Tentukan cara Content Machine membaca Articles dan Contact Messages dari CMS: API baru di CMS, atau akses baca ke database CMS | M3, M6 | Source CMS sudah tersedia di `Website TSI/cms-tsicertification` |
| Mulai Meta Business Verification | M7 | Prosesnya bisa berminggu-minggu |

### Sebelum milestone tertentu

| Sebelum | Tugas |
|---|---|
| M4 | Isi `OPENROUTER_API_KEY`, buat PageSpeed API key, tentukan penerima laporan |
| M5 | Brand guideline, aturan CTA, aturan imparsialitas dari compliance, contoh artikel, daftar Approver |
| M6 | Akses API CMS website |
| M7 | Instagram Business terhubung ke Facebook Page, System User token, bucket R2, template flyer |
| M8 | Keputusan DataForSEO, aturan penamaan UTM |

### Perbaikan website (paralel, di repo website)

- ~~Pasang tag GA4 kalau memang belum ada.~~ Beres 14 September lewat GTM.
- ~~Tambahkan `sitemap.xml` dan `robots.txt`.~~ Beres 13 September.
- Ubah `og:image` menjadi URL lengkap. Belum dicek ulang.

---

## 9. Integrasi yang ditunda

| Integrasi | Alasan ditunda | Dilanjutkan bila |
|---|---|---|
| LinkedIn | Community Management API butuh pengajuan dan review yang lama | Diputuskan tim |
| WhatsApp | Hanya kanal kedua untuk laporan, dan Telegram sudah cukup | Penerima laporan tidak memakai Telegram |

### WhatsApp — ditunda

**Rencana fungsi**

Saluran kedua untuk pengiriman laporan. Di desain Reports ditandai dengan "Telegram ✓ WhatsApp ✓". Tidak ada fitur yang hanya bisa berjalan lewat WhatsApp.

**Syarat bila dilanjutkan**

- Meta Business Verification dengan dokumen legal PT.
- Nomor khusus yang tidak sedang dipakai di aplikasi WhatsApp biasa.
- Template pesan disetujui Meta, karena laporan adalah pesan yang dikirim duluan oleh bisnis.
- Biaya per percakapan dari Meta.

Gateway tidak resmi tidak direkomendasikan: melanggar ketentuan WhatsApp dan nomornya bisa diblokir.

**Persiapan teknis sekarang**

Pengiriman laporan dibangun sebagai antarmuka "kanal". Menambah WhatsApp nanti cukup dengan satu implementasi kanal baru, tanpa mengubah logika laporan. Selama ditunda, indikator WhatsApp di layar Reports disembunyikan.

### LinkedIn — ditunda

**Tujuan**

- Mencatat jumlah followers Company Page setiap hari.
- Mengambil performa post: impressions, klik, engagement.
- Menjadwalkan dan mempublikasikan post yang sudah lolos Approval Queue.

**Akses yang dibutuhkan**

- **Admin Company Page** TSI (super admin).
- **LinkedIn developer app** yang terhubung ke Company Page dan diverifikasi dari halaman tersebut. Sebaiknya app khusus untuk produk ini.
- **Community Management API** diajukan dan disetujui LinkedIn.
  - Akses awal (Development tier) terbatas.
  - Pemakaian penuh butuh upgrade ke Standard tier melalui review LinkedIn.
  - Siapkan waktu beberapa minggu.
- **Otorisasi OAuth oleh admin page**, dengan izin membaca statistik organisasi dan memposting atas nama organisasi: `r_organization_social`, `w_organization_social`, `rw_organization_admin`.

**Data yang diambil**

| Data | Frekuensi | Dipakai di |
|---|---|---|
| Total followers dan pertambahannya | Snapshot harian | Social Media, Analytics, laporan |
| Statistik per post | Harian selama 30 hari setelah terbit | Social Media, Analytics |
| Publikasi post (gambar diunggah ke LinkedIn dulu, lalu post dibuat) | Sesuai jadwal | Content Planner, Approval Queue |

**Risiko dan pemeliharaan**

- **Masa berlaku token**
  - Access token berlaku sekitar 60 hari. Refresh token berlaku sekitar 1 tahun.
  - Admin page harus login ulang kira-kira setahun sekali.
  - Sistem mengirim peringatan Telegram 14 hari sebelum refresh token kedaluwarsa.
- **Versi API**
  - LinkedIn memakai API berversi, dan versi lama dipensiunkan secara berkala.
  - Perlu pengecekan dan pembaruan kira-kira setahun sekali.
- **Jika pengajuan ditolak**, pengelolaan LinkedIn tetap manual.

**Selama ditunda**

- Tab LinkedIn di layar Social Media dan Analytics menampilkan status "Belum terhubung", bukan angka contoh.
- Opsional: angka followers diisi dari ekspor Page Analytics LinkedIn (admin page bisa mengekspornya ke file XLS), supaya tren tetap tercatat sejak sekarang.
- Skema database sudah menyiapkan platform `linkedin`, jadi saat dilanjutkan tidak perlu migrasi besar.

**Langkah saat dilanjutkan**

1. Admin page membuat developer app dan memverifikasinya dari Company Page.
2. Ajukan Community Management API.
3. Isi variabel `LINKEDIN_*` di `.env`.
4. Implementasi berurutan: OAuth + refresh token → snapshot followers → statistik post → publikasi.
5. Uji di Development tier, lalu ajukan Standard tier.

---

## Lampiran A — Telegram Bot

Satu-satunya kanal pesan keluar selama WhatsApp ditunda.

| Fungsi | Milestone |
|---|---|
| Peringatan job gagal dan worker berhenti | M1 |
| Peringatan mingguan keyword prioritas yang turun (hanya keyword di atas ambang impressions) | M2 |
| Laporan harian, mingguan, bulanan | M4 |
| Notifikasi konten menunggu approval terlalu lama | M5 |
| Tombol Approve / Request Revision di pesan, perintah `/status` dan `/laporan` | M8 |

**Keamanan**

- Bot hanya merespons chat ID dan user ID yang terdaftar di Settings.
- Approval lewat Telegram tetap tercatat atas nama pengguna di timeline Approval Queue.
- Token bot hanya disimpan di server (`TELEGRAM_BOT_TOKEN`).

**Yang disiapkan**

1. Buat bot melalui @BotFather dan simpan tokennya.
2. Buat grup Telegram untuk tim marketing, lalu masukkan bot ke grup.
3. Catat chat ID grup (`TELEGRAM_CHAT_ID`).

---

## Lampiran B — Model AI per fitur

Semua lewat OpenRouter. Model bisa diganti lewat variabel `AI_MODEL_*` di `.env` tanpa mengubah kode. Harga per 1 juta token input / output, dicek 13 September 2026.

| Fitur | Model | Harga | Mulai dipakai |
|---|---|---|---|
| Ringkasan laporan | `anthropic/claude-sonnet-5` | $2 / $10 | M4 |
| Tulis artikel dan revisi | `anthropic/claude-opus-5` | $5 / $25 | M5 |
| QA sebelum approval | `anthropic/claude-opus-5` | $5 / $25 | M5 |
| Brief, rekomendasi topik, peluang SEO | `anthropic/claude-opus-5` | $5 / $25 | M5 |
| Klasifikasi search intent dan cluster | `anthropic/claude-haiku-4.5` | $1 / $5 | M5 |
| Caption Facebook dan Instagram | `anthropic/claude-sonnet-5` | $2 / $10 | M7 |
| Gambar latar flyer | `google/gemini-3.1-flash-image` | $0,50 / $3 | M7 |
| Riset tren web | `perplexity/sonar-pro` | $3 / $15 + biaya per pencarian | M8 |

Perkiraan biaya saat semua fitur berjalan: sekitar US$30 per bulan, dengan asumsi 20 artikel, 90 caption, laporan harian, dan analisis mingguan. Batas pengaman diatur lewat `AI_MONTHLY_BUDGET_USD`.
