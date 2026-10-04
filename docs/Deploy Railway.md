# Deploy ke Railway

Content Machine berjalan di Railway sebagai satu project berisi tiga bagian:

| Service | Isi | Konfigurasi |
|---|---|---|
| **Postgres** | Database | Template Postgres dari Railway |
| **app** | Web dan API, di `https://app.digmarspot.my.id` | `deploy/railway.app.json` |
| **worker** | Job terjadwal: sync, laporan, followers, crawl, AI | `deploy/railway.worker.json` |

Vercel tidak dipakai karena worker harus berjalan terus, dan sebagian job berjalan 20–60 menit.

## 1. Buat project

1. Login ke [railway.com](https://railway.com) dengan akun GitHub yang bisa membaca repo ini.
2. **New Project → Deploy PostgreSQL**. Biarkan namanya **Postgres**, karena variabel `DATABASE_URL` merujuk nama itu.
3. Di project yang sama: **Create → GitHub Repo →** pilih repo ini. Ganti nama service-nya menjadi **app**.
4. Ulangi langkah 3 sekali lagi untuk repo yang sama, lalu beri nama **worker**.

## 2. Arahkan tiap service ke konfigurasinya

Di setiap service, buka **Settings → Config-as-code → Railway config file**:

- **app:** `deploy/railway.app.json`
- **worker:** `deploy/railway.worker.json`

Isinya sudah menentukan build command, start command, health check, dan untuk worker: tepat satu replika.

## 3. Variabel

1. Buka `secrets/railway.env` di komputer lokal. File ini dibuat dari `.env`, diabaikan git, dan tidak boleh dibagikan.
2. Di service **app**, buka **Variables → Raw Editor**, tempel seluruh isinya, lalu **Update Variables**.
3. Lakukan hal yang sama di service **worker**.

Jangan menambahkan `NODE_ENV`. Nilainya sudah diatur oleh start command. Kalau `NODE_ENV=production` diset di Railway, npm akan melewati dev dependencies yang dibutuhkan untuk build.

## 4. Login Google untuk tim

Login dev hanya untuk lokal, jadi production butuh Google OAuth:

1. Di [Google Cloud Console](https://console.cloud.google.com/), sebaiknya di project milikmu sendiri, buka **APIs & Services → OAuth consent screen**. Isi nama app dan email, lalu pilih audience **External**.
2. Buka **Credentials → Create credentials → OAuth client ID → Web application**.
3. Di **Authorized redirect URIs**, isi `https://app.digmarspot.my.id/api/auth/google/callback`.
4. Salin Client ID dan Client Secret ke variabel `GOOGLE_OAUTH_CLIENT_ID` dan `GOOGLE_OAUTH_CLIENT_SECRET`. Isi untuk service app saja sudah cukup, tapi mengisi keduanya juga tidak masalah.

Yang bisa login hanya email yang terdaftar sebagai pengguna. Pada database kosong, `INITIAL_ADMIN_EMAIL` otomatis menjadi admin pertama.

## 5. Domain

1. Di service **app**, buka **Settings → Networking → Custom Domain** dan isi `app.digmarspot.my.id`. Railway lalu menampilkan target CNAME, kadang ditambah record TXT untuk verifikasi.
2. Di Niagahoster, buka **Domain → digmarspot.my.id → DNS / Kelola DNS**, lalu tambahkan:
   - **CNAME**, host `app`, isinya target dari Railway
   - **TXT**, kalau Railway memintanya, dengan host dan isi persis seperti yang ditampilkan
3. Tunggu sampai Railway menandai domainnya aktif. Biasanya hitungan menit, paling lama beberapa jam. Sertifikat HTTPS dibuat otomatis.

Subdomain `app` dipakai karena CNAME tidak bisa dipasang di domain utama (`digmarspot.my.id`). Domain utama nanti bisa dipakai untuk halaman penjualan.

## 6. Setelah online

- Buka `https://app.digmarspot.my.id/api/health`. Hasilnya harus `{"ok":true}`.
- Login dengan Google.
- **Meta:** tambahkan `https://app.digmarspot.my.id/api/social/meta/callback` ke **Facebook Login for Business → Settings → Valid OAuth Redirect URIs**, dan `https://app.digmarspot.my.id/api/social/instagram/callback` ke **Instagram → Business login settings**.
- Isi **Domain Aplikasi** di app Meta dengan `digmarspot.my.id`.

Setiap push ke `main` otomatis dideploy ulang oleh Railway. Migrasi database berjalan sendiri saat service app start.
