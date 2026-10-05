# GIS Data Wilayah dan Kependudukan

Aplikasi peta dan statistik wilayah Indonesia berbasis **React + Vite** (frontend) dan **PHP + MySQL** (backend). Data statistik diambil dari API resmi BPS; batas wilayah diambil sebagai GeoJSON dari layanan BIG.

## Fitur

- **Peta choropleth interaktif** (Leaflet) — pilihan provinsi, kabupaten/kota, dan kecamatan
- **Statistik kependudukan** — publikasi BPS dengan pelengkap input admin berlabel sumber/tahun bila nilai kecamatan tidak tersedia
- **Grafik horizontal bar** (Chart.js) — perbandingan antar kecamatan
- **Tabel data** — search, sort kolom, pagination client-side
- **Panel admin** — CRUD dataset kecamatan lokal, akun admin, reset password, dan pengaturan tim
- **Section Tim** — foto dan informasi anggota tim yang dikelola admin
- **Dark mode** — toggle, preferensi disimpan di localStorage

## Struktur Proyek

```
GIS/
├── backend/
│   ├── koneksi.php
│   ├── database.sql
│   ├── .env.example
│   ├── api/
│   │   ├── auth.php
│   │   ├── users.php
│   │   ├── team.php
│   │   ├── geography.php
│   │   ├── _geography.php
│   │   ├── kecamatan.php
│   │   └── _middleware.php
│   └── uploads/team/ (foto anggota tim)
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env.example
│   └── src/
│       ├── main.jsx / App.jsx / index.css
│       ├── lib/          (api.js, utils.js)
│       ├── stores/       (authStore.js)
│       ├── hooks/        (useKecamatan.js, useGeojson.js)
│       ├── components/   (ui/, layout/, map/, chart/, table/)
│       ├── pages/        (HomePage, LoginPage, admin/*)
│       └── routes/       (ProtectedRoute.jsx)
└── README.md
```

## Prasyarat

- **XAMPP** (PHP 8.1+, MySQL 8+, Apache)
- **Node.js** 18+ dan npm
- Token API BPS dari [API portal BPS](https://webapi.bps.go.id/developer/)

---

## Langkah Setup

### 1. Database

1. Buka XAMPP, aktifkan **Apache** dan **MySQL**.
2. Buka phpMyAdmin (`http://localhost/phpmyadmin`).
3. Import file `backend/database.sql` (akan membuat database `jember_db` beserta tabel dan data awal).

   Jika database lama sudah berisi data, jangan impor ulang seluruh file karena data kecamatan di-seed ulang. Jalankan hanya migrasi berikut melalui phpMyAdmin:

   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('admin') NOT NULL DEFAULT 'admin';
   UPDATE users SET role = 'admin' WHERE role <> 'admin';
   ALTER TABLE users MODIFY COLUMN role ENUM('admin') NOT NULL DEFAULT 'admin';
   CREATE TABLE IF NOT EXISTS team_settings (
     id TINYINT UNSIGNED PRIMARY KEY,
     team_name VARCHAR(100) NOT NULL,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   );
   INSERT IGNORE INTO team_settings (id, team_name) VALUES (1, 'Tim Pengembang');
   CREATE TABLE IF NOT EXISTS team_members (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(100) NOT NULL,
     position VARCHAR(100) NOT NULL DEFAULT '',
     photo_path VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   CREATE TABLE IF NOT EXISTS external_data_cache (
     cache_key CHAR(64) PRIMARY KEY,
     payload LONGTEXT NOT NULL,
     expires_at DATETIME NOT NULL,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     INDEX idx_external_data_cache_expires (expires_at)
   );
   ```

> **Akun admin default:** username `admin` | password `Admin123!`

### 2. Backend PHP

File backend sudah siap di folder `backend/`. Tidak perlu konfigurasi tambahan jika menggunakan XAMPP default (root:""  database).

Jika kredensial MySQL berbeda, edit `backend/koneksi.php`:
```php
$user = "root";
$pass = "";   // ganti sesuai password MySQL Anda
```

Salin `backend/.env.example` menjadi `backend/.env`, lalu isi token API BPS yang diperoleh setelah mendaftar/login di [portal developer BPS](https://webapi.bps.go.id/developer/login):

```env
BPS_API_KEY=token_dari_portal_bps
```

Simpan token hanya di `backend/.env`. File ini diabaikan Git dan Docker; jangan menaruh token pada `frontend/.env`, karena variabel `VITE_*` ikut dimasukkan ke bundle browser.

### 3. Frontend React

```bash
# Masuk ke folder frontend
cd frontend

# Salin file environment
cp .env.example .env

# Install dependensi
npm install

# Jalankan dev server
npm run dev
```

Akses di: **http://localhost:5173**

### 4. Environment Variables

Edit `frontend/.env` sesuai path XAMPP Anda:

```env
VITE_API_URL=http://localhost/GIS/backend/api
```

---

## Penggunaan

| URL | Deskripsi |
|-----|-----------|
| `http://localhost:5173/` | Halaman publik — peta, grafik, tabel |
| `http://localhost:5173/login` | Login admin |
| `http://localhost:5173/admin` | Dashboard admin |
| `http://localhost:5173/admin/kecamatan` | Daftar & kelola kecamatan |
| `http://localhost:5173/admin/users` | Kelola pengguna, role, password, dan tim (admin) |

---

## Stack Teknologi

**Frontend:** Vite + React 18, Tailwind CSS v3, React Router v6, react-leaflet, Chart.js, Axios, Zustand, react-hook-form + Zod, lucide-react

**Backend:** PHP 8+, MySQL 8, Session-based auth, CSRF protection

### Sumber dan cara kerja data wilayah

- Kode wilayah resmi memakai kode MFD 7 digit dari BPS SIMDASI: level 26 (provinsi), 27 (kabupaten/kota), dan 28 (kecamatan). Daftar bersifat bertingkat sehingga pilihan berikutnya mengikuti induknya.
- Daftar tabel statistik per wilayah dibaca melalui endpoint SIMDASI level 23. Data tabel dibaca melalui level 25 menggunakan `wilayah`, `id_tabel`, dan tahun terbaru yang mempunyai nilai jumlah penduduk. Implementasi mengirim parameter tahun dengan nama `tahun` sesuai respons endpoint yang diuji.
- Atribut statistik yang ditampilkan mengikuti tabel resmi yang tersedia (jumlah penduduk, laju pertumbuhan, distribusi, kepadatan, dan rasio jenis kelamin). Tidak semua tabel/wilayah memiliki setiap nilai; nilai kosong ditampilkan sebagai tidak tersedia dan tidak dibuat dari data contoh.
- Polygon kabupaten/kota dan kecamatan diambil dari layanan RBI BIG, dengan GeoJSON dibentuk melalui query feature layer. Pemetaan polygon ke kode BPS memakai nama wilayah karena kolom kode BPS pada sebagian feature BIG tidak terisi.
- Respons eksternal disimpan sementara di tabel `external_data_cache` (kode wilayah 7 hari, data statistik 7 hari, batas BIG 30 hari). Untuk statistik kecamatan, data admin dapat melengkapi wilayah/nilai yang tidak tersedia dari BPS; data tersebut tetap diberi label sumber dan tahun, bukan dianggap sebagai publikasi BPS.
- Default peta adalah Jawa Timur, tetapi daftar pilihan provinsi berasal dari API BPS. Polygon berasal dari [BIG RBI Batas Wilayah](https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/), edisi layanan kecamatan/kabupaten yang diperiksa Juni 2026. Periksa ketentuan atribusi/penggunaan BIG sebelum memublikasikan ulang data geospasial.
- CRUD “Data Kecamatan” mempertahankan form dan alur admin lama, dengan pilihan kabupaten/kota induk agar cakupan wilayah tidak terbatas pada Jember. Kode 7 digit boleh dikosongkan agar dibuat otomatis. Data BPS yang punya nilai tetap menjadi prioritas; input admin hanya mengisi kode/nilai yang belum tersedia dan ditandai sumber serta tahun. Data lokal lama dinonaktifkan sampai diverifikasi admin. Jika polygon BIG tidak cocok/tersedia, peta memakai titik dari koordinat admin.
- Hanya ada satu role, `admin`. Migrasi mengubah user lama ber-role Editor menjadi Admin sebelum menghapus nilai role Editor.
- Saat penyedia mengembalikan halaman WAF, API mencoba ulang lalu memakai cache resmi yang pernah berhasil diambil (jika tersedia), serta menandai data sementara pada UI. Untuk wilayah yang belum pernah berhasil diambil dan diblokir provider, aplikasi tetap menampilkan error; tidak ada angka buatan sebagai pengganti.
- Input admin tidak mengubah publikasi/katalog BPS. Admin dapat menambahkan kecamatan pelengkap di bawah kabupaten/kota yang dipilih, lengkap dengan statistik, sumber, tahun, dan koordinat. Entri akan muncul di pemilih kecamatan dan peta ketika statistik BPS tidak tersedia untuk kodenya; polygon BIG dipakai jika tersedia dan cocok, jika tidak peta menunjukkan titik pada koordinat admin.

---

## Catatan Keamanan

- Password di-hash dengan PHP `password_hash()` (`PASSWORD_DEFAULT`) dan tidak pernah disimpan plaintext
- Semua query menggunakan prepared statements
- CSRF token di-generate server dan dikirim di header `X-CSRF-Token`
- Session cookie tidak diekspos ke JavaScript (`httpOnly` via PHP session)
- Error message server tidak membocorkan informasi sensitif

---

## Deploy ke server sendiri dengan Dokploy

Repository ini menyediakan `Dockerfile` di root untuk membangun frontend dan menjalankan API PHP dalam satu container. Container menggunakan service MySQL yang sudah dibuat di Dokploy.

1. Di Dokploy, gunakan aplikasi bertipe **Dockerfile** yang terhubung ke repository GitHub ini, dan pilih branch yang ingin di-deploy.
2. Atur **Build Path / Dockerfile Path** ke `Dockerfile` di root repository, dengan build context root repository (`.`).
3. Tambahkan environment variables berikut pada aplikasi di Dokploy. Gunakan kredensial yang diberikan untuk service MySQL; jangan commit password ke Git.

   | Variable | Nilai |
   |---|---|
   | `MYSQL_HOST` | Host database Dokploy, misalnya `db-mysql-jtz5qu` |
   | `MYSQL_PORT` | Port database, biasanya `3306` |
   | `MYSQL_DATABASE` | `jember_db` |
   | `MYSQL_USER` | User MySQL yang diberikan Dokploy |
   | `MYSQL_PASSWORD` | Password untuk user tersebut |
   | `BPS_API_KEY` | Token dari [portal developer BPS](https://webapi.bps.go.id/developer/) |
   | `VITE_API_URL` | `/backend/api` |

4. Untuk database lama, jalankan migrasi role, tabel tim, dan `external_data_cache` dari `backend/database.sql`. Database baru mendapatkan seluruh tabel saat file tersebut diimpor.
5. Pastikan service aplikasi dapat menjangkau host database melalui jaringan Dokploy. Deploy aplikasi, lalu arahkan domain aplikasi ke container pada port `80` dan aktifkan HTTPS di Dokploy.
6. Setelah masuk sebagai admin, gunakan halaman **Pengguna & Tim** untuk mengganti password bawaan (`admin` / `Admin123!`) dan menambahkan foto anggota tim.
7. Aktifkan **Auto Deploy** untuk aplikasi dan hubungkan webhook GitHub jika Dokploy meminta. Push ke branch yang dipilih akan memicu build dan deployment ulang secara otomatis.

Impor `backend/database.sql` ke database `jember_db` melalui phpMyAdmin atau tool database Dokploy sebelum memakai aplikasi. Data database berada di service MySQL Dokploy. Simpan backup database terpisah. Alternatif deployment Docker Compose tetap tersedia di `docker-compose.yml`.

Isi `BPS_API_KEY` dengan nilai token saja (tanpa awalan `BPS_API_KEY=` di dalam nilainya). Untuk file `backend/.env`, gunakan satu assignment seperti `BPS_API_KEY=nilai_token`; jangan menggandakan nama variabel. Jika token pernah terekspos, cabut dan buat token baru di portal BPS. Setelah mengubah kode frontend atau `VITE_API_URL`, lakukan build/deploy ulang agar bundle frontend yang disajikan server ikut diperbarui.
