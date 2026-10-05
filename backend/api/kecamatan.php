<?php
// API CRUD data kecamatan. GET publik; POST/PUT/DELETE memerlukan sesi + CSRF.

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/_middleware.php';

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = $_SERVER['HTTP_HOST'] ?? '';
$allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://' . $host,
    'https://' . $host,
];
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

// ------- GET — publik -------
if ($method === 'GET') {
    $result = $conn->query(
        "SELECT id, kode_kecamatan, nama_kecamatan, jumlah_penduduk, laju_pertumbuhan,
                luas_wilayah, jumlah_faskes, jumlah_rentan, latitude, longitude,
                provinsi, kabupaten, sumber_data, tahun_data, aktif_di_peta
         FROM data_kecamatan
         ORDER BY provinsi ASC, kabupaten ASC, nama_kecamatan ASC"
    );

    $rows = [];
    while ($row = $result->fetch_assoc()) {
        // Cast numerik agar JSON tidak serialise sebagai string
        $row['provinsi']         = $row['provinsi'] ?? 'JAWA TIMUR';
        $row['kabupaten']        = $row['kabupaten'] ?? 'Kabupaten Jember';
        $row['jumlah_penduduk']  = (int)   $row['jumlah_penduduk'];
        $row['laju_pertumbuhan'] = (float) $row['laju_pertumbuhan'];
        $row['luas_wilayah']     = (float) $row['luas_wilayah'];
        $row['jumlah_faskes']    = (int)   $row['jumlah_faskes'];
        $row['jumlah_rentan']    = (int)   $row['jumlah_rentan'];
        $row['latitude']         = (float) $row['latitude'];
        $row['longitude']        = (float) $row['longitude'];
        $row['tahun_data']       = (int) $row['tahun_data'];
        $row['aktif_di_peta']    = (bool) $row['aktif_di_peta'];
        $rows[] = $row;
    }

    jsonResponse(['success' => true, 'message' => 'OK', 'data' => $rows]);
}

// ------- Endpoint terproteksi: wajib login + CSRF -------
requireAuth();
requireCsrf();

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$rules = [
    'provinsi'          => ['type' => 'string',  'required' => false, 'min' => 2, 'max' => 100],
    'kabupaten'         => ['type' => 'string',  'required' => false, 'min' => 2, 'max' => 100],
    'nama_kecamatan'    => ['type' => 'string',  'required' => true,  'min' => 2, 'max' => 50],
    'jumlah_penduduk'   => ['type' => 'int',     'required' => true,  'min' => 1, 'max' => 1000000],
    'laju_pertumbuhan'  => ['type' => 'float',   'required' => true,  'min' => -5, 'max' => 10],
    'luas_wilayah'      => ['type' => 'float',   'required' => true,  'min' => 0],
    'jumlah_faskes'     => ['type' => 'int',     'required' => false, 'min' => 0],
    'jumlah_rentan'     => ['type' => 'int',     'required' => false, 'min' => 0],
    'latitude'          => ['type' => 'float',   'required' => true,  'min' => -90,  'max' => 90],
    'longitude'         => ['type' => 'float',   'required' => true,  'min' => -180, 'max' => 180],
];

// ------- POST — buat kecamatan baru -------
if ($method === 'POST') {
    $d = validateInput($body, array_merge(
        ['kode_kecamatan' => ['type' => 'string', 'required' => false, 'min' => 3, 'max' => 10]],
        $rules
    ));

    $provinsi  = !empty($d['provinsi'])  ? trim($d['provinsi'])  : 'JAWA TIMUR';
    $kabupaten = !empty($d['kabupaten']) ? trim($d['kabupaten']) : 'Kabupaten Jember';
    $d['jumlah_faskes'] = $d['jumlah_faskes'] ?? 0;
    $d['jumlah_rentan'] = $d['jumlah_rentan'] ?? 0;

    // Kode kecamatan wajib ada (manual atau diisi default)
    $kode = !empty($d['kode_kecamatan']) ? trim($d['kode_kecamatan']) : '';
    if ($kode === '') {
        $kode = strtoupper(substr(preg_replace('/[^a-z0-9]/i', '', $kabupaten), 0, 3))
              . strtoupper(substr(preg_replace('/[^a-z0-9]/i', '', $d['nama_kecamatan']), 0, 4))
              . rand(100, 999);
    }

    // Cek unik nama dalam satu kabupaten
    $chk = $conn->prepare("SELECT id FROM data_kecamatan WHERE nama_kecamatan = ? AND kabupaten = ?");
    $chk->bind_param('ss', $d['nama_kecamatan'], $kabupaten);
    $chk->execute();
    if ($chk->get_result()->num_rows > 0) {
        jsonResponse(['success' => false, 'message' => "Nama kecamatan {$d['nama_kecamatan']} sudah ada di {$kabupaten}.", 'data' => null], 409);
    }

    $stmt = $conn->prepare(
        "INSERT INTO data_kecamatan
            (provinsi, kabupaten, kode_kecamatan, nama_kecamatan, jumlah_penduduk, laju_pertumbuhan,
             luas_wilayah, jumlah_faskes, jumlah_rentan, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param(
        'ssssiddiidd',
        $provinsi,
        $kabupaten,
        $kode,
        $d['nama_kecamatan'],
        $d['jumlah_penduduk'],
        $d['laju_pertumbuhan'],
        $d['luas_wilayah'],
        $d['jumlah_faskes'],
        $d['jumlah_rentan'],
        $d['latitude'],
        $d['longitude']
    );
    $stmt->execute();

    jsonResponse(['success' => true, 'message' => 'Kecamatan berhasil ditambahkan.', 'data' => ['id' => $conn->insert_id]], 201);
}

// ------- PUT — update kecamatan -------
if ($method === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID tidak valid.', 'data' => null], 400);
    }

    $d = validateInput($body, $rules);
    $provinsi  = !empty($d['provinsi'])  ? trim($d['provinsi'])  : 'JAWA TIMUR';
    $kabupaten = !empty($d['kabupaten']) ? trim($d['kabupaten']) : 'Kabupaten Jember';
    $d['jumlah_faskes'] = $d['jumlah_faskes'] ?? 0;
    $d['jumlah_rentan'] = $d['jumlah_rentan'] ?? 0;

    // Cek unik nama (kecuali dirinya sendiri di kabupaten yang sama)
    $chk = $conn->prepare("SELECT id FROM data_kecamatan WHERE nama_kecamatan = ? AND kabupaten = ? AND id != ?");
    $chk->bind_param('ssi', $d['nama_kecamatan'], $kabupaten, $id);
    $chk->execute();
    if ($chk->get_result()->num_rows > 0) {
        jsonResponse(['success' => false, 'message' => 'Nama kecamatan sudah dipakai kecamatan lain di kabupaten ini.', 'data' => null], 409);
    }

    $stmt = $conn->prepare(
        "UPDATE data_kecamatan
         SET provinsi=?, kabupaten=?, nama_kecamatan=?, jumlah_penduduk=?, laju_pertumbuhan=?,
             luas_wilayah=?, jumlah_faskes=?, jumlah_rentan=?, latitude=?, longitude=?
         WHERE id=?"
    );
    $stmt->bind_param(
        'sssiddiiddi',
        $provinsi,
        $kabupaten,
        $d['nama_kecamatan'],
        $d['jumlah_penduduk'],
        $d['laju_pertumbuhan'],
        $d['luas_wilayah'],
        $d['jumlah_faskes'],
        $d['jumlah_rentan'],
        $d['latitude'],
        $d['longitude'],
        $id
    );
    $stmt->execute();

    jsonResponse(['success' => true, 'message' => 'Kecamatan berhasil diperbarui.', 'data' => null]);
}

// ------- DELETE — hapus kecamatan -------
if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID tidak valid.', 'data' => null], 400);
    }

    $stmt = $conn->prepare("DELETE FROM data_kecamatan WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        jsonResponse(['success' => false, 'message' => 'Data tidak ditemukan.', 'data' => null], 404);
    }

    jsonResponse(['success' => true, 'message' => 'Kecamatan berhasil dihapus.', 'data' => null]);
}

jsonResponse(['success' => false, 'message' => 'Method tidak didukung.', 'data' => null], 405);
