CREATE DATABASE IF NOT EXISTS jember_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jember_db;

-- Tabel data kecamatan (updated: tambah kolom laju_pertumbuhan, lat, lng)
CREATE TABLE IF NOT EXISTS data_kecamatan (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    kode_kecamatan     VARCHAR(10)    NOT NULL UNIQUE,
    nama_kecamatan     VARCHAR(100)   NOT NULL,
    jumlah_penduduk    INT            NOT NULL,
    laju_pertumbuhan   DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
    luas_wilayah       DECIMAL(10,2)  NOT NULL,
    jumlah_faskes      INT            NOT NULL DEFAULT 0,
    jumlah_rentan      INT            NOT NULL DEFAULT 0,
    latitude           DECIMAL(10,7)  NOT NULL DEFAULT 0,
    longitude          DECIMAL(10,7)  NOT NULL DEFAULT 0,
    kode_kabupaten     CHAR(7)        NOT NULL DEFAULT '3509000',
    sumber_data        VARCHAR(120)   NOT NULL DEFAULT 'Dataset lokal lama',
    tahun_data         SMALLINT       NOT NULL DEFAULT 2024,
    aktif_di_peta      TINYINT(1)     NOT NULL DEFAULT 1,
    created_at         TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Migrasi: tambah kolom baru jika belum ada (aman dijalankan ulang)
ALTER TABLE data_kecamatan
    ADD COLUMN IF NOT EXISTS laju_pertumbuhan DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS latitude         DECIMAL(10,7) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS longitude        DECIMAL(10,7) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS kode_kabupaten   CHAR(7)       NOT NULL DEFAULT '3509000',
    ADD COLUMN IF NOT EXISTS sumber_data      VARCHAR(120)  NOT NULL DEFAULT 'Dataset lokal lama',
    ADD COLUMN IF NOT EXISTS tahun_data       SMALLINT      NOT NULL DEFAULT 2024,
    ADD COLUMN IF NOT EXISTS aktif_di_peta    TINYINT(1)    NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Tabel users untuk autentikasi admin
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin') NOT NULL DEFAULT 'admin',
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Migrasi aman untuk database lama yang belum memiliki role.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role ENUM('admin') NOT NULL DEFAULT 'admin';

-- Keep previous editor accounts while removing the editor role.
UPDATE users SET role = 'admin' WHERE role <> 'admin';
ALTER TABLE users MODIFY COLUMN role ENUM('admin') NOT NULL DEFAULT 'admin';

-- User default: admin / Admin123!
-- Hash dibuat dengan password_hash('Admin123!', PASSWORD_BCRYPT)
INSERT IGNORE INTO users (username, password_hash) VALUES
('admin', '$2y$10$kaY.ssZkycvPqySVQuZPqu0DTlX8N6XIPnEaPUNnSA6f89462xLv.');

CREATE TABLE IF NOT EXISTS team_settings (
    id         TINYINT UNSIGNED PRIMARY KEY,
    team_name  VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO team_settings (id, team_name) VALUES (1, 'Tim Pengembang');

CREATE TABLE IF NOT EXISTS team_members (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    position   VARCHAR(100) NOT NULL DEFAULT '',
    photo_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_data_cache (
    cache_key  CHAR(64) PRIMARY KEY,
    payload    LONGTEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_external_data_cache_expires (expires_at)
);

-- Data 31 kecamatan Kabupaten Jember (BPS 2024)
TRUNCATE TABLE data_kecamatan;
INSERT INTO data_kecamatan (kode_kecamatan, nama_kecamatan, jumlah_penduduk, laju_pertumbuhan, luas_wilayah, jumlah_faskes, jumlah_rentan, latitude, longitude) VALUES
('3509010', 'Kencong',       72100,  0.85, 68.30,  5,  4200, -8.2316, 113.6087),
('3509020', 'Gumukmas',      85400,  1.12, 92.60,  6,  5100, -8.2643, 113.5932),
('3509030', 'Puger',        121000,  0.63, 162.70, 8,  7300, -8.3712, 113.4892),
('3509040', 'Wuluhan',       98700,  0.42, 119.40, 7,  5900, -8.3241, 113.5612),
('3509050', 'Ambulu',       115200,  1.34, 116.60, 9,  6800, -8.3498, 113.6234),
('3509060', 'Tempurejo',     72800, -0.21, 524.46, 5,  4400, -8.2987, 113.7453),
('3509070', 'Silo',          86300,  0.71, 308.49, 6,  5200, -8.2134, 113.8901),
('3509080', 'Mayang',        53200,  0.19, 95.04,  4,  3200, -8.1532, 113.8234),
('3509090', 'Mumbulsari',    57400,  0.55, 105.59, 4,  3450, -8.1987, 113.7612),
('3509100', 'Jenggawah',     72100,  0.38, 73.16,  5,  4320, -8.2415, 113.6987),
('3509110', 'Ajung',         89600,  1.56, 63.51,  7,  5380, -8.2189, 113.7023),
('3509120', 'Rambipuji',     89900,  1.23, 54.04,  6,  5410, -8.2312, 113.6534),
('3509130', 'Balung',        87200,  0.89, 61.65,  6,  5230, -8.2598, 113.6123),
('3509140', 'Umbulsari',     74300,  0.44, 74.89,  5,  4460, -8.2876, 113.5734),
('3509150', 'Semboro',       47900, -0.38, 56.56,  4,  2870, -8.2654, 113.5412),
('3509160', 'Jombang',       52600, -0.15, 54.29,  4,  3156, -8.2412, 113.5234),
('3509170', 'Sumberbaru',    97400,  0.97, 189.93, 7,  5840, -8.3012, 113.5012),
('3509180', 'Tanggul',       86700,  0.73, 199.99, 6,  5200, -8.1987, 113.4523),
('3509190', 'Bangsalsari',   97200,  1.01, 165.26, 7,  5830, -8.1823, 113.5534),
('3509200', 'Panti',         65800,  0.61, 160.71, 5,  3950, -8.1312, 113.6234),
('3509210', 'Sukorambi',     39100,  0.34, 70.49,  3,  2350, -8.1098, 113.6812),
('3509220', 'Arjasa',        54900,  0.48, 210.78, 4,  3300, -8.0812, 113.7234),
('3509230', 'Pakusari',      46200,  0.22, 30.16,  3,  2772, -8.1234, 113.7612),
('3509240', 'Kalisat',       84600,  0.91, 58.46,  6,  5080, -8.1456, 113.8012),
('3509250', 'Ledokombo',     74800,  0.56, 116.10, 5,  4490, -8.0987, 113.8534),
('3509260', 'Sumberjambe',   52300, -0.09, 175.54, 4,  3140, -8.0623, 113.9012),
('3509270', 'Sukowono',      70900,  0.77, 88.43,  5,  4250, -8.0534, 113.8323),
('3509280', 'Jelbuk',        34200, -0.44, 58.49,  3,  2050, -8.0312, 113.8701),
('3509290', 'Kaliwates',    125800,  1.87, 25.80, 16,  2800, -8.1543, 113.7089),
('3509300', 'Sumbersari',   132500,  2.13, 37.00, 14,  3100, -8.1621, 113.7234),
('3509310', 'Patrang',      102300,  1.65, 37.10, 11,  2900, -8.1312, 113.7012);

-- Seed lokal lama tidak otomatis menjadi fallback peta sebelum diverifikasi admin.
UPDATE data_kecamatan SET aktif_di_peta = 0 WHERE sumber_data = 'Dataset lokal lama';
