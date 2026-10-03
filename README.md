# Data Penduduk Kabupaten Jember 2024

Aplikasi visualisasi data kependudukan 31 kecamatan Kabupaten Jember berbasis **React + Vite** (frontend) dan **PHP + MySQL** (backend).

## Fitur

- **Peta choropleth interaktif** (Leaflet) — mode jumlah penduduk & laju pertumbuhan
- **Grafik horizontal bar** (Chart.js) — perbandingan antar kecamatan
- **Tabel data** — search, sort kolom, pagination client-side
- **Panel admin** — CRUD kecamatan dengan autentikasi session PHP
- **Dark mode** — toggle, preferensi disimpan di localStorage

## Struktur Proyek

```
GIS/
├── backend/
│   ├── koneksi.php
│   ├── database.sql
│   ├── jember_kecamatan.geojson
│   └── api/
│       ├── auth.php
│       ├── kecamatan.php
│       └── _middleware.php
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

---

## Stack Teknologi

**Frontend:** Vite + React 18, Tailwind CSS v3, React Router v6, react-leaflet, Chart.js, Axios, Zustand, react-hook-form + Zod, lucide-react

**Backend:** PHP 8+, MySQL 8, Session-based auth, CSRF protection

---

## Catatan Keamanan

- Password di-hash dengan `PASSWORD_BCRYPT` (PHP `password_hash`)
- Semua query menggunakan prepared statements
- CSRF token di-generate server dan dikirim di header `X-CSRF-Token`
- Session cookie tidak diekspos ke JavaScript (`httpOnly` via PHP session)
- Error message server tidak membocorkan informasi sensitif

---

## Deploy ke server sendiri dengan Dokploy

Repository ini menyediakan `docker-compose.yml` untuk menjalankan frontend, API PHP, dan MySQL. MySQL hanya tersedia di jaringan internal Compose; hanya service `web` yang perlu dihubungkan ke domain.

1. Di Dokploy, buat aplikasi **Docker Compose** dari repository GitHub ini dan pilih branch yang ingin di-deploy.
2. Gunakan file Compose `docker-compose.yml` di root repository.
3. Tambahkan environment variables berikut pada aplikasi di Dokploy. Gunakan password acak yang kuat; jangan commit nilainya ke Git.

   | Variable | Nilai |
   |---|---|
   | `MYSQL_USER` | Nama user database non-root, misalnya `jember_app` |
   | `MYSQL_PASSWORD` | Password kuat untuk user aplikasi |
   | `MYSQL_ROOT_PASSWORD` | Password kuat untuk root MySQL |
   | `VITE_API_URL` | `/backend/api` |

4. Deploy aplikasi, lalu tambahkan domain ke service `web` pada port `80` dan aktifkan HTTPS di Dokploy.
5. Sebelum domain dibuka untuk umum, ubah password admin bawaan (`admin` / `Admin123!`) dengan memperbarui `users.password_hash` di MySQL menggunakan hash bcrypt yang dibuat oleh PHP `password_hash()`. Panel saat ini tidak menyediakan fitur ganti password.
6. Aktifkan **Auto Deploy** untuk aplikasi dan hubungkan webhook GitHub jika Dokploy meminta. Push ke branch yang dipilih akan memicu build dan deployment ulang secara otomatis.

Data database disimpan di volume Docker `mysql_data`. `backend/database.sql` hanya diimpor saat volume database pertama kali dibuat; deployment berikutnya tidak menghapus data. Simpan backup database terpisah karena data di volume bukan pengganti backup. Menghapus volume akan menghapus database.
