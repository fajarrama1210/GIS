# Data Penduduk Kabupaten Jember 2024

Aplikasi visualisasi data kependudukan 31 kecamatan Kabupaten Jember berbasis **React + Vite** (frontend) dan **PHP + MySQL** (backend).

## Fitur

- **Peta choropleth interaktif** (Leaflet) — mode jumlah penduduk & laju pertumbuhan
- **Grafik horizontal bar** (Chart.js) — perbandingan antar kecamatan
- **Tabel data** — search, sort kolom, pagination client-side
- **Panel admin** — CRUD kecamatan dan user, pengaturan role serta reset password
- **Section Tim** — foto dan informasi anggota tim yang dikelola admin
- **Dark mode** — toggle, preferensi disimpan di localStorage

## Struktur Proyek

```
GIS/
├── backend/
│   ├── koneksi.php
│   ├── database.sql
│   ├── jember_kecamatan.geojson
│   ├── api/
│       ├── auth.php
│       ├── users.php
│       ├── team.php
│       ├── kecamatan.php
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

---

## Langkah Setup

### 1. Database

1. Buka XAMPP, aktifkan **Apache** dan **MySQL**.
2. Buka phpMyAdmin (`http://localhost/phpmyadmin`).
3. Import file `backend/database.sql` (akan membuat database `jember_db` beserta tabel dan data awal).

   Jika database lama sudah berisi data, jangan impor ulang seluruh file karena data kecamatan di-seed ulang. Jalankan hanya migrasi berikut melalui phpMyAdmin:

   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('admin', 'editor') NOT NULL DEFAULT 'admin';
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
   ```

> **Akun admin default:** username `admin` | password `Admin123!`

### 2. Backend PHP

File backend sudah siap di folder `backend/`. Tidak perlu konfigurasi tambahan jika menggunakan XAMPP default (root:""  database).

Jika kredensial MySQL berbeda, edit `backend/koneksi.php`:
```php
$user = "root";
$pass = "";   // ganti sesuai password MySQL Anda
```

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
VITE_GEOJSON_URL=http://localhost/GIS/backend/jember_kecamatan.geojson
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
   | `VITE_API_URL` | `/backend/api` |

4. Untuk database lama, jalankan migrasi role dan tabel tim dari bagian `users`, `team_settings`, dan `team_members` di `backend/database.sql`. Database baru mendapatkan seluruh tabel saat file tersebut diimpor.
5. Pastikan service aplikasi dapat menjangkau host database melalui jaringan Dokploy. Deploy aplikasi, lalu arahkan domain aplikasi ke container pada port `80` dan aktifkan HTTPS di Dokploy.
6. Setelah masuk sebagai admin, gunakan halaman **Pengguna & Tim** untuk mengganti password bawaan (`admin` / `Admin123!`) dan menambahkan foto anggota tim.
7. Aktifkan **Auto Deploy** untuk aplikasi dan hubungkan webhook GitHub jika Dokploy meminta. Push ke branch yang dipilih akan memicu build dan deployment ulang secara otomatis.

Impor `backend/database.sql` ke database `jember_db` melalui phpMyAdmin atau tool database Dokploy sebelum memakai aplikasi. Data database berada di service MySQL Dokploy. Simpan backup database terpisah. Alternatif deployment Docker Compose tetap tersedia di `docker-compose.yml`.
