# Build Plan and Status — Content Machine

Terakhir diperbarui: 15 September 2026.

Dokumen ini adalah acuan tunggal untuk urutan pembangunan, status setiap bagian, dan integrasi yang ditunda.

---

## 1. Status saat ini

### Aplikasi

| Bagian | Status |
|---|---|
| Tampilan 8 layar: Dashboard, Content Planner, Articles, Social Media, SEO Intelligence, Analytics, Approval Queue, Reports | Selesai. Setiap bagian menampilkan status sumber datanya ("Not connected", "Not available yet", "On hold") sampai data asli masuk |
| Media Library | Masih placeholder (M7) |
| Content Planner dan Workflow Logs | **Berjalan dengan data asli (M5 tahap 1, 15 September):** kanban drag & drop, kalender mingguan, list, Quick Create, dan riwayat konten; daftar run job dengan detail, Retry, dan biaya AI bulan ini |
| Settings | Bagian SEO, Reporting, dan Automation berjalan (Reporting dan Automation sejak 15 September). Brand, AI, Approval rules, dan Social accounts menyusul di M5 dan M7 |
| Routing dan URL per layar | Selesai |
| Konfigurasi env (`.env.example`) | Selesai |
| **M1 lokal:** backend, database, migrasi, login Google, peran pengguna, kerangka job, peringatan, CLI | **Selesai dan diuji end-to-end di lokal** (13 September 2026) |
| **M1 deploy:** Docker Compose, VPS, HTTPS, backup harian | Menunggu VPS dan subdomain |
| **M2: data SEO dari Search Console** | **Selesai dibangun (15 September 2026):** sync harian, metrik, SEO Intelligence, bagian SEO di Dashboard, Settings SEO, dan peringatan Telegram mingguan. Menunggu tim mengecek tampilan dan mengisi keyword prioritas |
| **M4: laporan Telegram dan kesehatan teknis SEO** | **Selesai dibangun (15 September 2026):** AI gateway, laporan harian/mingguan/bulanan, crawler, status indeks, PageSpeed, Technical SEO Health, SEO Action Center, serta Settings Reporting dan Automation. OpenRouter dan PageSpeed aktif. Syarat selesai yang tersisa: laporan pagi terkirim 7 hari berturut-turut |
| Integrasi GA4, CMS, Meta, dan AI | GA4 dan CMS tersinkron otomatis, M3 selesai dibangun (15 September). AI gateway siap dan menunggu key. Meta belum dimulai |

### Akses dan integrasi

| Integrasi | Fungsi | Milestone | Status |
|---|---|---|---|
| Google Search Console | Keyword, posisi, klik, impressions | M2 | **Terhubung (14 September).** Properti Domain `sc-domain:tsicertification.com`. Service account `content-machine-reader` punya akses Restricted, dan uji API berhasil. Pembatasan pembuatan key sempat dibuka khusus untuk project ini. **URL Inspection API** juga berfungsi dengan akses ini (diuji 15 September) |
| Google Analytics 4 | Sessions, konversi, leads | M3 | **Tracking aktif dan API terhubung (14 September).** Property ID `495912713`, service account punya akses Viewer. GTM `GTM-WK2MV5GL` dipublikasikan dengan Google tag `G-T03867G3VG` dan tag GA4 Event untuk `generate_lead`, `form_submit`, `whatsapp_click`, `cta_click`, `share`, `contact_click`. Custom dimension sudah dibuat, dan `generate_lead` sudah menjadi key event (15 September). Form interactions di Enhanced measurement sudah nonaktif. **Sinkronisasi harian aktif (15 September):** job `ga4-sync` pukul 07:00 menyalin sessions per channel dan landing page serta event dari GTM, sampai hari kemarin |
| OpenRouter | Semua fitur AI | M4 | **Aktif (15 September).** Key "Social Media Dashboard TSI" terisi di `.env`. Uji ringkasan laporan dengan `anthropic/claude-sonnet-5`: sekitar 1.600 token, $0,009 per laporan. Batas kredit key di OpenRouter masih kosong (tanpa batas); rem anggaran di aplikasi tetap `AI_MONTHLY_BUDGET_USD` |
| Telegram Bot | Peringatan, laporan, approval cepat | M1 | **Terhubung (14 September).** Bot `@DigmarDashboardTSI_bot`, grup "Digital Marketing Dashboard TSI". Pesan uji terkirim |
| CMS website | Inventaris artikel, publikasi, leads | M3, M6 | CMS kustom (source: `Website TSI/cms-tsicertification`). Punya modul Articles dan **Contact Messages**, yang menyimpan setiap kiriman form beserta statusnya (new, contacted, closed). **Akses baca terhubung (15 September):** role Neon `content_machine_reader` di database `neondb`, hanya baca, terbatas per kolom. Bisa membaca `blog_posts` (tabel artikel yang dipakai CMS dan website) dan `cms_contact_messages` tanpa data pribadi (nama, perusahaan, jabatan, email, telepon, pesan, catatan internal). `npm run cli -- cms:check` lulus 11 dari 11: 122 artikel terbit, 5 leads. **Sinkronisasi tiap jam aktif:** job `cms-sync` pada menit ke-10 menyalin artikel dan leads |
| PageSpeed Insights API | Kecepatan halaman | M4 | **Aktif (15 September).** Key terisi di `.env`. Uji pertama mengukur 9 halaman (§2) |
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
| Header respons menunjukkan halaman dirender di server Vercel region Amerika Serikat (`iad1`) tanpa cache. **Diukur 15 September:** skor mobile 9 halaman teratas 59–73, konten utama baru tampil setelah 4,7–6,9 detik (batas "baik" Google 2,5 detik), dan data pengunjung asli Chrome menilai semuanya lambat | Setiap kunjungan dari Indonesia menunggu server di AS, sehingga halaman terasa lambat dan peringkat bisa terdampak | Pindahkan region Vercel ke Singapura (`sin1`) atau aktifkan cache halaman, lalu kompres gambar. Hasilnya terlihat di pengecekan PageSpeed hari Minggu berikutnya |
| Halaman `/impartiality-policy` tersedia | Sumber resmi aturan imparsialitas untuk AI | Dipakai di knowledge base M5 |
| **Situs lama kemungkinan pernah diretas untuk spam SEO** (ditemukan 15 September lewat data GSC). Pada September–Oktober 2025 lebih dari 25.000 URL spam terindeks: `tsicertification.com/products/…` berisi judul produk berbahasa Italia, dan `certificate.tsicertification.com/?_g=…`. Query yang masuk berbahasa Italia dan Jepang. Query judi seperti "cukong88" masih muncul sampai sekarang | Impressions saat itu melonjak hingga 800 ribu per bulan, tapi bukan performa TSI. Nama domain bisa ikut tercemar di mata Google | Di GSC, cek menu **Security issues** dan **Manual actions**. Periksa laporan **Pages** untuk URL `/products/` dan `certificate.tsicertification.com/?_g=`. Kalau masih terindeks, ajukan lewat **Removals** dan pastikan URL tersebut mengembalikan 404 atau 410 |
| **Tidak ada data GSC sama sekali dari 4 November 2025 sampai 6 Mei 2026** | Tren dan perbandingan yang melewati periode ini menyesatkan | Content Machine menghitung data mulai 7 Mei 2026 (§6) |
| `demo.tsicertification.com` pernah terindeks Google | Halaman demo bisa bersaing dengan situs utama dan tampil ke publik | Pastikan subdomain demo memakai `noindex` atau dilindungi password |
| **140 dari 210 halaman di sitemap belum terindeks Google** (URL Inspection, 15 September). Kebanyakan halaman versi Indonesia (`/id/`), dengan status "Discovered – currently not indexed" atau "Crawled – currently not indexed" | Halaman tersebut tidak bisa muncul di hasil pencarian | Buka halaman penting di GSC URL Inspection. Beri versi `/id/` judul dan isi yang berbeda, tambah link internal ke halaman tersebut, lalu minta pengindeksan |
| **Dua link rusak** (crawl 15 September): `/download/privacy-policy/` yang dirujuk halaman privacy policy, dan link WhatsApp tanpa `https://` di artikel ISO 45001, sehingga browser membukanya sebagai `/blog/…/wa.me/685283237418` | Pengunjung mendapat halaman 404 | Perbaiki link di website dan di artikel CMS |
| **URL lama `/artikel-iso/{slug}` mengembalikan 404** tanpa redirect ke `/blog/{slug}/` (dicek 15 September). Google masih menyimpan 23 URL lama ini dari periode Mei–Agustus | Klik dari hasil pencarian lama berakhir di halaman 404 | Tambahkan redirect 301 dari `/artikel-iso/*` ke `/blog/*` |
| **42 halaman memakai judul yang sama dengan halaman lain** (crawl 15 September), misalnya beranda dan company profile beserta versi `/id/`-nya. Artikel `/id/blog/…` memakai canonical ke versi bahasa Inggris | Google sulit membedakan halaman, dan versi Indonesia kecil peluangnya tampil | Beri judul unik per halaman dan terjemahkan judul versi `/id/`. Putuskan apakah canonical ke versi Inggris memang disengaja |

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

**Status 15 September 2026:** inti M2 sudah jalan dengan data asli.

- **Sync GSC:** job `gsc-sync` mengambil data sejak 7 Mei 2026, lalu setiap pagi pukul 07.30 mengambil ulang 5 hari terakhir. Backfill pertama selesai dalam 3,5 detik: 129 hari, 5.979 baris query, 4.754 baris halaman, 11.901 baris query-halaman.
- **Metrik:** KPI, tren, keyword tracker, pergerakan, distribusi posisi, kanibalisasi, skor peluang, dan halaman yang perlu perhatian.
- **Layar:** SEO Intelligence (kecuali Technical SEO Health dan Action Center) dan bagian SEO di Dashboard sudah memakai data asli.
- **Verifikasi:** angka per keyword dan cakupan query (58%) sama persis dengan hasil kueri langsung ke GSC.

- **Settings bagian SEO:** keyword prioritas, ambang impressions, kata brand, tanggal mulai data, dan host website. Hanya admin yang bisa menyimpan, dan angka SEO langsung dihitung ulang setelah disimpan.
- **Peringatan Telegram mingguan:** job `seo-weekly-digest`, setiap Senin pukul 08.00. Pesan hanya terkirim bila ada keyword prioritas yang posisinya turun (Dropping atau At Risk), supaya grup tidak terbiasa mengabaikannya. Input `{"dryRun": true}` menampilkan isi pesan tanpa mengirimnya.

**Dari tim TSI:**
- Isi **keyword prioritas** di Settings. Sebelum diisi, peringatan mingguan tidak mengirim apa pun.
- Cek tampilan Dashboard, SEO Intelligence, dan Settings.
- Cocokkan angka dengan GSC: rentang 16 Agustus – 12 September 2026 seharusnya 550 klik, 10.048 impressions, dan posisi rata-rata 11,6.

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

**Status: selesai dibangun (15 September), menunggu pengecekan tim**

- Job `ga4-sync` (harian 07:00) dan `cms-sync` (tiap jam) sudah berjalan. Hasil pertama: 122 artikel, 5 leads, dan data GA4 untuk 14 September (77 sessions, 38 di antaranya dari Organic Search).
- Artikel dicocokkan dengan GSC dan GA4 lewat slug. `/blog/{slug}`, dengan atau tanpa garis miring di akhir, dan path lama `/artikel-iso/{slug}` dihitung sebagai artikel yang sama. Semua halaman artikel di GSC berhasil dicocokkan.
- Skor SEO tiap artikel memakai 11 poin checklist yang sama dengan editor CMS. Saat ini 32 artikel mendapat skor 80 ke atas dan 88 artikel di bawah 50, terutama karena focus keyword kosong (hanya 34 dari 122 artikel yang mengisinya).
- Layar yang sudah memakai data asli:
  - Articles: tabel dan drawer, dengan tab Overview, SEO, dan Analytics.
  - Analytics: KPI, Acquisition Overview, Conversion Funnel, Content Performance.
  - Dashboard: Organic Traffic, Website Leads, Articles Published, Top Performing Content.
- Conversion Funnel baru tampil setelah data GSC mencakup hari yang sudah dilacak GA4. Karena data GSC tertinggal sekitar 3 hari, funnel diperkirakan muncul sekitar 17–18 September.
- Angka sessions GA4 bisa berbeda 1–3% antar laporan (misalnya total harian dibanding jumlah per channel), karena GA4 menghitung sessions dengan estimasi.

**Tugas tim**

- Cek tampilan layar Articles, Analytics, dan Dashboard.
- Bandingkan sessions Organic Search di Analytics dengan laporan Traffic acquisition GA4 untuk tanggal yang sama.
- Bandingkan jumlah leads dengan Contact Messages di CMS.
- Isi focus keyword artikel di CMS. Tanpa focus keyword, skor SEO dan cluster artikel kurang akurat.

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
- ~~Keputusan cara membaca data CMS~~ **Diputuskan 15 September: akses baca langsung ke database CMS** lewat role hanya-baca yang terbatas per kolom, tanpa mengubah CMS maupun website. Daftar kolomnya ada di `server/cms/access.ts`. Menambah kolom berarti mengubah daftar itu dan memberi grant baru di Neon.

**Selesai bila:** organic sessions sama dengan laporan GA4, dan jumlah leads sama dengan Contact Messages di CMS untuk periode yang sama.

**Catatan:** data GA4 baru ada sejak 14 September 2026. Tren traffic sebelum tanggal itu ditampilkan "belum ada data", bukan nol.

### M4 — Laporan Telegram dan kesehatan teknis SEO

**Status: selesai dibangun (15 September)**

- **AI gateway**
  - Model dipilih per fitur lewat `AI_MODEL_*`.
  - Token dan biaya setiap panggilan dicatat di tabel `ai_usage`.
  - Panggilan ditolak bila biaya bulan berjalan sudah mencapai `AI_MONTHLY_BUDGET_USD`.
  - Aktif sejak 15 September. Ringkasan laporan harian diuji dengan data asli: sekitar $0,009 per laporan.
- **Laporan Telegram**
  - Jadwal:
    - harian pukul 08:00, untuk hari kemarin;
    - mingguan setiap Senin pukul 08:15, untuk Senin–Minggu lalu;
    - bulanan setiap tanggal 1 pukul 08:30, untuk bulan lalu.
  - Angka dihitung sistem. Ringkasan AI ditambahkan bila key tersedia, dan laporan tetap terkirim tanpa ringkasan bila AI gagal.
  - Satu periode hanya dikirim sekali. Riwayat tampil di layar Reports.
  - Uji dry run dengan data asli sudah benar. Untuk periode sebelum lead pertama (13 September), laporan menulis "belum ada leads tersimpan", bukan nol.
- **Crawler mingguan** (Minggu 02:00): memeriksa halaman dari sitemap, dari hasil pencarian Google, dan dari CMS, beserta semua link internalnya. Uji pertama: 247 URL, 2 link rusak, 22 redirect.
- **Status indeks** (Minggu 03:00) lewat URL Inspection API. Hasil pertama: 70 dari 210 halaman sitemap terindeks.
- **PageSpeed** (Minggu 04:00) untuk beranda dan 9 halaman dengan klik terbanyak; file seperti PDF dilewati. Uji ulang 15 September: 10 halaman terukur tanpa kegagalan, semuanya lambat menurut pengunjung asli (§2).
- **Worker** menutup catatan run yang terputus saat restart, supaya Workflow Logs tidak menampilkannya "running" selamanya. Antrean mencoba ulang job itu sendiri.
- **Technical SEO Health** di SEO Intelligence sudah memakai data nyata, termasuk KPI Indexed Pages dan daftar halaman yang perlu diperbaiki.
- **SEO Action Center** (harian 07:45)
  - Hasil pertama: 16 tugas dari data asli.
  - Tugas yang masalahnya sudah hilang ditutup otomatis.
  - Editor ke atas bisa mengubah status Open / In Progress / Done.
  - Tugas yang ditandai Done dibuka lagi bila masalahnya masih terdeteksi setelah 14 hari.
  - Tombol **Export Prompt to Fixing** menyusun semua tugas yang belum Done menjadi satu prompt siap tempel untuk Claude Code di repo website. Isinya: bukti dan tindakan yang disarankan untuk setiap masalah, tempat perbaikannya (kode, CMS, atau Search Console), daftar URL lengkap untuk tugas gabungan, dan aturan kerja: verifikasi dulu, minta persetujuan untuk teks baru, dan jangan push tanpa izin.
- **Settings bagian Reporting dan Automation**
  - Setiap job otomatis bisa dinyalakan atau dimatikan, jam dan harinya bisa diubah, dan batas percobaan ulangnya bisa diatur. Perubahan langsung berlaku tanpa restart server.
  - Pola jadwal mengikuti bawaan setiap job (per jam, harian, mingguan, atau bulanan). Salah isi tidak bisa mengubah jadwal mingguan menjadi per jam.
  - Bagian Reporting berisi ketiga laporan, peringatan keyword prioritas, dan tombol kirim pesan uji ke grup Telegram.
  - Setiap job menampilkan status run terakhir dan tombol "Run now". Hanya admin yang bisa mengubah; peran lain hanya melihat.
  - Diuji lewat API asli: ubah jadwal dan retry, tolak jadwal yang tidak valid, matikan job, lalu kembalikan. Tabel jadwal dan antrean ikut berubah setiap kali.
- **Batas waktu dan heartbeat job**
  - Masalah yang ditemukan: pemeriksaan indeks (26 menit) sempat berjalan dobel karena melewati batas bawaan antrean 15 menit.
  - Batas waktu sekarang: pemeriksaan indeks 60 menit; crawl, PageSpeed, dan sync Search Console masing-masing 30 menit.
  - Semua job mengirim heartbeat setiap 60 detik. Kalau worker mati atau restart, job dicoba ulang dalam sekitar satu menit.
  - Diuji: pemeriksaan PageSpeed selama 3,5 menit selesai dalam satu percobaan.
- **Syarat selesai yang tersisa:** laporan pagi terkirim 7 hari berturut-turut. Syarat ini butuh server yang menyala terus, jadi baru bisa dipenuhi penuh setelah deploy (M1).

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

**Status: tahap 1 dari 4 selesai dibangun (15 September)**

Tahapan M5:
1. Content Planner dan Workflow Logs.
2. Knowledge base di Settings bagian Brand dan AI.
3. Rantai AI: rekomendasi topik, brief, draft, lalu QA.
4. Approval Queue.

Hasil tahap 1:

- **Content Planner** memakai data asli.
  - Kanban 8 tahap dengan drag & drop, kalender mingguan (bisa maju-mundur dan menambah konten per hari), dan list.
  - Filter jenis, tahap, prioritas, owner, cluster, dan campaign, serta pencarian judul atau keyword.
  - Editor di drawer: judul, jenis, tahap, keyword, campaign, prioritas, tanggal, owner, catatan, dan riwayat (dibuat, dipindah tahap, diubah).
  - Menu **+ Create** membuka editor dengan isian awal. New Campaign menyusul di M8.
  - Hak: Editor ke atas bisa membuat, mengubah, memindah, dan menghapus. Hanya Approver dan Admin yang bisa memindahkan konten ke Approved.
- **Dashboard:** Scheduled Content (terjadwal dalam 14 hari ke depan), Pending Approvals (konten di tahap Review), dan Upcoming Content kini memakai data Planner.
- **Workflow Logs**
  - Daftar 100 run terakhir dengan filter alur dan status, diperbarui setiap 15 detik.
  - Detail input, output, dan error setiap run, dengan tombol Retry atau Run again untuk admin.
  - Biaya dan jumlah panggilan AI bulan ini.
- **Approval Queue** tetap disembunyikan sampai tahap 4, supaya data contoh dari desain tidak tampil.
- Diuji lewat API asli:
  - konten: buat, pindah tahap, ubah, riwayat, validasi, dan hapus
  - Workflow Logs: filter dan detail run, serta ringkasan biaya AI

**Tugas tim**

- Cek tampilan Content Planner dan Workflow Logs.
- Mulai siapkan bahan tahap 2: brand guideline, aturan CTA, aturan imparsialitas dari compliance, 5–10 contoh artikel terbaik, dan daftar Approver.

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

Semua ambang di bawah adalah bawaan hasil kalibrasi dengan data asli pada 15 September 2026, dan bisa diubah di Settings. Aturan lengkapnya ada di `shared/seo.ts`.

**Dasar data**

| Aturan | Nilai bawaan | Alasan |
|---|---|---|
| Tanggal mulai data | 7 Mei 2026 | Situs diluncurkan ulang pada tanggal ini. Sebelumnya ada ribuan halaman spam dari situs lama (September–Oktober 2025), lalu enam bulan tanpa data (§2). Data sebelum tanggal ini diabaikan, dan perbandingan yang melewatinya ditampilkan "tidak ada pembanding" |
| Jendela keyword | 28 hari, dibanding 28 hari sebelumnya | Volume situs kecil. Jendela 7 hari terlalu sering memberi alarm palsu |
| Ambang impressions | 30 per jendela 28 hari | Pada ambang 50 hanya sekitar 10 keyword yang bisa dibandingkan, pada ambang 30 sekitar 20 |
| Query brand | Mengandung kata "tsi" atau "tsicertification" | Query brand mendominasi impressions. Brand tidak dihitung sebagai peluang atau kanibalisasi, karena beberapa URL untuk query brand (beranda, subdomain ERP, company profile) memang wajar |
| Host website | `tsicertification.com` | Properti GSC juga mencakup subdomain seperti ERP dan academy. Peringatan konten hanya untuk halaman website |
| Grafik tren | Harian untuk 30D dan 90D, mingguan untuk 6M dan 1Y | Angka harian terlalu kecil untuk rentang panjang |

**Metrik**

| Metrik | Definisi |
|---|---|
| Organic Traffic | Sessions GA4 dari channel Organic Search (M3) |
| Clicks | Total klik GSC dari data total situs |
| SEO Visibility | Total impressions GSC dari data total situs |
| Average Position | Posisi rata-rata data total situs, berbobot impressions |
| Organic CTR | Klik dibagi impressions. Perubahannya ditampilkan dalam poin persentase (pp) |
| Keywords Top 3 / Top 10 | Query dengan posisi rata-rata ≤ 3 / ≤ 10 dalam 28 hari terakhir dan impressions di atas ambang |
| Website Leads | Jumlah kiriman form kontak di Contact Messages CMS, dihitung sampai hari ini (zona waktu Jakarta). Tidak dipisah per channel, karena CMS tidak mencatat asal kunjungan. Perbandingan dengan periode sebelumnya baru tampil setelah seluruh periode itu berada setelah lead pertama (M3) |
| Sessions dan leads per artikel | Sessions GA4 yang dimulai di halaman artikel (landing page), dan jumlah event `generate_lead` dalam sessions tersebut. Semua dalam 28 hari terakhir data GA4 (M3) |
| Skor SEO artikel | Persentase dari 11 poin checklist SEO editor CMS yang lolos, dihitung ulang setiap sinkronisasi CMS (M3) |
| Cluster artikel | Standar yang disebut di focus keyword. Kalau focus keyword kosong atau tidak menyebut standar, diambil dari judul (M3) |
| Articles Published | Jumlah artikel berstatus publish di CMS. Dashboard menampilkan totalnya. Di layar Articles bisa dibatasi ke 30, 60, atau 90 hari terakhir berdasarkan tanggal terbit (termasuk hari ini), dibanding jumlah hari yang sama sebelumnya (M3) |
| Halaman lambat | Skor performa mobile PageSpeed di bawah 50, **atau** pengunjung asli Chrome menilai halaman lambat (Chrome UX Report). Data pengunjung asli ikut dihitung meski skor lab cukup, karena itulah yang benar-benar dirasakan pengunjung (M4) |
| Indexed Pages | Halaman sitemap yang lolos URL Inspection Google (verdict PASS), dari semua halaman sitemap yang sudah dicek (M4) |
| Conversion Funnel | Khusus organic search: impressions dan klik GSC, sessions dan engaged sessions Organic Search, lalu event CTA, form atau WhatsApp, dan `generate_lead` dari sessions tersebut. Hanya dihitung untuk hari yang tercakup oleh GSC dan GA4 sekaligus (M3) |
| Pergerakan keyword | Posisi 28 hari terakhir dibanding 28 hari sebelumnya. Hanya dihitung bila impressions di atas ambang di kedua periode, dan ditampilkan bila berubah minimal 2 posisi |
| Status At Risk | Sebelumnya di halaman 1 (posisi ≤ 10), sekarang di luar halaman 1 |
| Status Dropping / Rising | Posisi memburuk / membaik minimal 2 |
| Status Opportunity | Query non-brand di posisi 8–50 dengan impressions di atas ambang. Lebih lebar dari halaman 2, karena peluang non-brand situs ini kebanyakan ada di posisi 21–50 |
| Status Stable | Tidak memenuhi status lain |
| Skor peluang (0–100) | 60% besar impressions (skala log, relatif terhadap kandidat terbesar) dan 40% kedekatan ke posisi 8 |
| Kanibalisasi | Query non-brand dengan impressions di atas ambang, di mana 2 URL atau lebih masing-masing mendapat minimal 20% impressions |
| Perlu perhatian: Low CTR | Halaman website di posisi ≤ 10, impressions minimal 3× ambang, dan CTR di bawah 1% |
| Perlu perhatian: Ranking declining | Halaman website yang posisinya memburuk minimal 2, dengan impressions di atas ambang di kedua periode |

Kalau satu keyword memenuhi beberapa status, yang dipakai adalah urutan: At Risk, Dropping, Rising, Opportunity, Stable.

**Aturan penting**

- **Angka total diambil dari data total situs**, bukan penjumlahan baris keyword. Google menyembunyikan sebagian query demi privasi: saat ini hanya sekitar 58% impressions yang punya query.
- **Data GSC final tertinggal sekitar 3 hari.** Dashboard menampilkan tanggal data terakhir, dan setiap sync mengambil ulang 5 hari terakhir.
- **Posisi keyword diambil dari data per query**, bukan per halaman, karena posisi query hanya menghitung halaman dengan peringkat terbaik.

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

**Sudah tersedia sejak 15 September.** Di Settings bagian Reporting dan Automation:

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
| ~~Kirim sitemap di GSC~~ | M2 | **Sudah terbaca Google.** URL Inspection (15 September) menunjukkan halaman ditemukan lewat `https://tsicertification.com/sitemap.xml` |
| Sewa VPS (2 vCPU / 4 GB RAM, lokasi Jakarta atau Singapura) dan siapkan subdomain | M1 | Contoh subdomain: `cm.tsicertification.com` |
| ~~Buka akses Google API untuk GSC dan GA4~~ | M2, M3 | **Beres 14 September.** Key service account dibuat setelah kebijakan organisasi dibuka untuk project ini |
| ~~Tambahkan service account ke GSC dan GA4~~ | M2, M3 | **Beres 14 September.** GSC Restricted, GA4 Viewer. Terverifikasi lewat API |
| ~~Kembalikan kebijakan pembuatan key ke "Inherit parent's policy"~~ | — | **Beres 15 September.** Kedua policy dihapus di level project. Key yang sudah ada tetap berfungsi (diuji ulang) |
| Buat OAuth client untuk login | M1 | Redirect URI lokal: `http://localhost:5173/api/auth/google/callback` |
| ~~Buat bot Telegram lewat @BotFather, buat grup, catat chat ID~~ | M1 | **Beres 14 September** |
| Susun daftar pengguna dan perannya | M1 | |
| ~~Tentukan cara Content Machine membaca Articles dan Contact Messages dari CMS~~ | M3 | **Beres 15 September.** Akses baca ke database CMS dengan role `content_machine_reader`. Cara publikasi artikel (M6) tetap perlu diputuskan tersendiri |
| Mulai Meta Business Verification | M7 | Prosesnya bisa berminggu-minggu |

### Sebelum milestone tertentu

| Sebelum | Tugas |
|---|---|
| M4 | ~~Isi `OPENROUTER_API_KEY` dan `PAGESPEED_API_KEY` di `.env`~~ **Beres 15 September.** Penerima laporan: grup Telegram yang sudah ada. Disarankan memberi batas kredit pada key OpenRouter |
| M5 | Brand guideline, aturan CTA, aturan imparsialitas dari compliance, contoh artikel, daftar Approver |
| M6 | Akses API CMS website |
| M7 | Instagram Business terhubung ke Facebook Page, System User token, bucket R2, template flyer |
| M8 | Keputusan DataForSEO, aturan penamaan UTM |

### Perbaikan website (paralel, di repo website)

- ~~Pasang tag GA4 kalau memang belum ada.~~ Beres 14 September lewat GTM.
- ~~Tambahkan `sitemap.xml` dan `robots.txt`.~~ Beres 13 September.
- Ubah `og:image` menjadi URL lengkap. Belum dicek ulang.
- Redirect 301 dari `/artikel-iso/*` ke `/blog/*` (§2).
- Perbaiki dua link rusak: `/download/privacy-policy/` dan link WhatsApp tanpa `https://` di artikel ISO 45001 (§2).
- Judul unik untuk setiap halaman, termasuk versi `/id/` (§2).

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
| Peringatan mingguan keyword prioritas yang turun (hanya keyword di atas ambang impressions) | M2. **Sudah jalan:** setiap Senin pukul 08.00, dan hanya terkirim bila ada yang turun |
| Laporan harian, mingguan, bulanan | M4. **Sudah dibangun (15 September):** harian 08:00, mingguan Senin 08:15, bulanan tanggal 1 pukul 08:30. Ringkasan AI aktif (diuji 15 September) |
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
