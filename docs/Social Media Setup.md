# Menyalakan login Facebook dan Instagram

Panduan ini untuk **orang yang memasang Content Machine**, bukan untuk pengguna. Cukup dikerjakan sekali per pemilik app. Setelah itu, pengguna di setiap perusahaan hanya menekan **+ Add account → Continue with Facebook / Continue with Instagram**, login, lalu selesai.

Satu app Meta bisa melayani banyak instalasi Content Machine. Tambahkan saja domain setiap instalasi ke daftar redirect URI (langkah 3 dan 4).

## 1. Kunci enkripsi

Token akun disimpan terenkripsi. Buat kuncinya:

```
npm run cli -- secrets:key
```

Salin baris `SECRETS_KEY=…` ke `.env`. Simpan kunci ini baik-baik. Kalau hilang, token yang tersimpan tidak bisa dibaca dan semua akun harus dihubungkan ulang. Setiap instalasi memakai kuncinya sendiri.

## 2. Buat app Meta

Meta sudah memakai alur **use case**. Opsi lama "Other → Business" sedang dihapus, jadi jangan dipakai.

1. Buka [developers.facebook.com/apps](https://developers.facebook.com/apps/) → **Create app**.
2. **App details:** isi nama app (misalnya "Content Machine") dan email kontak.
3. **Use cases:** pilih filter **Content management**, lalu centang:
   - **Manage everything on your Page** untuk tombol *Continue with Facebook*
   - **Manage messaging & content on Instagram** untuk tombol *Continue with Instagram*

   Kalau Meta tidak mengizinkan keduanya dalam satu app, buat dua app: satu untuk Page, satu untuk Instagram. Content Machine menyimpan kredensial keduanya terpisah (`META_*` dan `INSTAGRAM_*`), jadi dua app tetap jalan.
4. **Business:** hubungkan ke business portfolio pemilik Content Machine.
5. Lanjutkan **Requirements → Overview**, lalu buat app-nya.

## 3. Login Facebook (Facebook Page)

1. Di **Dashboard**, buka use case **Manage everything on your Page → Customize**. Permission `business_management` dan `pages_show_list` sudah otomatis ada. Klik **Add** pada `pages_read_engagement` dan `read_insights`.
2. Di menu kiri **Facebook Login for Business → Settings**, isi **Valid OAuth Redirect URIs** dengan alamat setiap instalasi, lalu simpan:
   `https://<domain-instalasi>/api/social/meta/callback`
   Untuk lokal: `http://localhost:5173/api/social/meta/callback`
3. Opsional: kalau ada menu **Facebook Login for Business → Configurations**, buat satu konfigurasi dengan token **User access token**, aset **Pages**, dan keempat permission di atas, lalu salin **Configuration ID**-nya. Kalau menu itu tidak ada, kosongkan `META_LOGIN_CONFIG_ID`. Content Machine akan meminta permission tersebut secara langsung.
4. Isi `.env`:
   ```
   META_APP_ID=           # App settings → Basic → App ID
   META_APP_SECRET=       # App settings → Basic → App Secret
   META_LOGIN_CONFIG_ID=  # dari langkah 3, boleh kosong
   ```

## 4. Login Instagram (akun Business/Creator, tanpa perlu Facebook Page)

1. Di **Dashboard**, buka use case **Manage messaging & content on Instagram → Customize**, lalu pilih **API setup with Instagram login**.
2. Pastikan permission `instagram_business_basic` dan `instagram_business_manage_insights` sudah ditambahkan.
3. Di bagian **Set up Instagram business login → Business login settings**, isi **OAuth redirect URIs** untuk setiap instalasi:
   `https://<domain-instalasi>/api/social/instagram/callback`
4. Salin **Instagram app ID** dan **Instagram app secret** yang tampil di bagian atas halaman itu. Keduanya berbeda dari App ID di App settings.
   ```
   INSTAGRAM_APP_ID=
   INSTAGRAM_APP_SECRET=
   ```

Restart Content Machine setelah mengubah `.env`.

## 5. Siapa yang bisa login

- **Selama app masih Development:** hanya orang yang punya role di app yang bisa menghubungkan akun. Tambahkan mereka di **App roles → Roles** sebagai Tester (untuk Instagram: **Instagram testers**), lalu mereka menerima undangannya. Ini cukup untuk pemakaian internal dan uji coba dengan perusahaan lain.
- **Supaya siapa pun bisa login tanpa diundang:** selesaikan **Business Verification** (dokumen legal PT) dan ajukan **App Review** untuk Advanced Access atas permission di atas. Siapkan URL kebijakan privasi, URL penghapusan data, dan screencast alur Add account. Prosesnya bisa beberapa minggu.

Fitur posting terjadwal nanti menambah permission `pages_manage_posts` (Facebook) dan `instagram_business_content_publish` (Instagram). Pengguna perlu login ulang sekali untuk menyetujuinya.

## Cara alternatif: token System User

Untuk perusahaan yang ingin token yang tidak pernah kedaluwarsa dan tidak terikat pada satu orang: di **Meta Business Settings → Users → System users**, assign Page ke system user, lalu generate token untuk app ini. Pengguna menempelkannya di **Add account → Advanced**.
