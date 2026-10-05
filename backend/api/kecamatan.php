<?php
// API CRUD data kecamatan. GET publik; POST/PUT/DELETE memerlukan sesi + CSRF.

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/_middleware.php';

// CORS
$allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
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
                kode_kabupaten, sumber_data, tahun_data, aktif_di_peta
         FROM data_kecamatan
         ORDER BY nama_kecamatan ASC"
    );

    $rows = [];
    while ($row = $result->fetch_assoc()) {
        // Cast numerik agar JSON tidak serialise sebagai string
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
    'nama_kecamatan'    => ['type' => 'string',  'required' => true,  'min' => 2, 'max' => 50],
    'jumlah_penduduk'   => ['type' => 'int',     'required' => true,  'min' => 1, 'max' => 1000000],
    'laju_pertumbuhan'  => ['type' => 'float',   'required' => true,  'min' => -5, 'max' => 10],
    'luas_wilayah'      => ['type' => 'float',   'required' => true,  'min' => 0],
    'jumlah_faskes'     => ['type' => 'int',     'required' => false, 'min' => 0],
    'jumlah_rentan'     => ['type' => 'int',     'required' => false, 'min' => 0],
    'latitude'          => ['type' => 'float',   'required' => true,  'min' => -90,  'max' => 90],
    'longitude'         => ['type' => 'float',   'required' => true,  'min' => -180, 'max' => 180],
    'kode_kabupaten'    => ['type' => 'string',  'required' => false, 'min' => 7, 'max' => 7],
    'sumber_data'       => ['type' => 'string',  'required' => false, 'min' => 2, 'max' => 120],
    'tahun_data'        => ['type' => 'int',     'required' => false, 'min' => 1900, 'max' => 2100],
    'aktif_di_peta'     => ['type' => 'int',     'required' => false, 'min' => 0, 'max' => 1],
];

// ------- POST — buat kecamatan baru -------
if ($method === 'POST') {
    $d = validateInput($body, array_merge(
        ['kode_kecamatan' => ['type' => 'string', 'required' => false, 'min' => 7, 'max' => 7]],
        $rules
    ));

    $d['kode_kabupaten'] = $d['kode_kabupaten'] ?? '3509000';
    $d['sumber_data'] = $d['sumber_data'] ?? 'Input Admin';
    $d['tahun_data'] = $d['tahun_data'] ?? (int) date('Y');
    $d['aktif_di_peta'] = $d['aktif_di_peta'] ?? 1;
    $d['jumlah_faskes'] = $d['jumlah_faskes'] ?? 0;
    $d['jumlah_rentan'] = $d['jumlah_rentan'] ?? 0;

    if (!preg_match('/^\d{7}$/', $d['kode_kabupaten'])) {
        jsonResponse(['success' => false, 'message' => 'Pilih kode kabupaten/kota induk yang valid.', 'data' => null], 422);
    }
    if (!empty($d['kode_kecamatan']) && (
        !preg_match('/^\d{7}$/', $d['kode_kecamatan'])
        || substr($d['kode_kecamatan'], 0, 4) !== substr($d['kode_kabupaten'], 0, 4)
    )) {
        jsonResponse(['success' => false, 'message' => 'Kode kecamatan harus 7 digit dan sesuai dengan kabupaten/kota induk.', 'data' => null], 422);
    }

    if (empty($d['kode_kecamatan'])) {
        $prefix = substr($d['kode_kabupaten'], 0, 4);
        $existingCodes = $conn->prepare('SELECT kode_kecamatan FROM data_kecamatan WHERE kode_kecamatan LIKE ?');
        $prefixPattern = $prefix . '%';
        $existingCodes->bind_param('s', $prefixPattern);
        $existingCodes->execute();
        $usedCodes = array_fill_keys(array_column($existingCodes->get_result()->fetch_all(MYSQLI_ASSOC), 'kode_kecamatan'), true);
        for ($suffix = 1; $suffix <= 999; $suffix++) {
            $candidate = $prefix . str_pad((string) $suffix, 3, '0', STR_PAD_LEFT);
            if (!isset($usedCodes[$candidate])) {
                $d['kode_kecamatan'] = $candidate;
                break;
            }
        }
        if (empty($d['kode_kecamatan'])) {
            jsonResponse(['success' => false, 'message' => 'Kode otomatis kecamatan sudah penuh untuk kabupaten/kota ini.', 'data' => null], 409);
        }
    }
    $chk = $conn->prepare("SELECT id FROM data_kecamatan WHERE kode_kecamatan = ?");
    $chk->bind_param('s', $d['kode_kecamatan']);
    $chk->execute();
    if ($chk->get_result()->num_rows > 0) {
        jsonResponse(['success' => false, 'message' => 'Kode kecamatan sudah digunakan. Kosongkan kode agar sistem membuat kode otomatis.', 'data' => null], 409);
    }

    $stmt = $conn->prepare(
        "INSERT INTO data_kecamatan
            (kode_kecamatan, nama_kecamatan, jumlah_penduduk, laju_pertumbuhan,
             luas_wilayah, jumlah_faskes, jumlah_rentan, latitude, longitude,
             kode_kabupaten, sumber_data, tahun_data, aktif_di_peta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param(
        'ssiddiiddssii',
        $d['kode_kecamatan'],
        $d['nama_kecamatan'],
        $d['jumlah_penduduk'],
        $d['laju_pertumbuhan'],
        $d['luas_wilayah'],
        $d['jumlah_faskes'],
        $d['jumlah_rentan'],
        $d['latitude'],
        $d['longitude'],
        $d['kode_kabupaten'],
        $d['sumber_data'],
        $d['tahun_data'],
        $d['aktif_di_peta']
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

    $d['kode_kabupaten'] = $d['kode_kabupaten'] ?? '3509000';
    $d['sumber_data'] = $d['sumber_data'] ?? 'Input Admin';
    $d['tahun_data'] = $d['tahun_data'] ?? (int) date('Y');
    $d['aktif_di_peta'] = $d['aktif_di_peta'] ?? 1;
    $d['jumlah_faskes'] = $d['jumlah_faskes'] ?? 0;
    $d['jumlah_rentan'] = $d['jumlah_rentan'] ?? 0;
    if (!preg_match('/^\d{7}$/', $d['kode_kabupaten'])) {
        jsonResponse(['success' => false, 'message' => 'Kode kabupaten/kota induk tidak valid.', 'data' => null], 422);
    }
    $chk = $conn->prepare("SELECT kode_kecamatan FROM data_kecamatan WHERE id = ?");
    $chk->bind_param('i', $id);
    $chk->execute();
    $existing = $chk->get_result()->fetch_assoc();
    if (!$existing) {
        jsonResponse(['success' => false, 'message' => 'Data tidak ditemukan.', 'data' => null], 404);
    }
    if (substr($existing['kode_kecamatan'], 0, 4) !== substr($d['kode_kabupaten'], 0, 4)) {
        jsonResponse(['success' => false, 'message' => 'Kode kecamatan tidak sesuai dengan kabupaten/kota induk.', 'data' => null], 422);
    }

    $stmt = $conn->prepare(
        "UPDATE data_kecamatan
         SET nama_kecamatan=?, jumlah_penduduk=?, laju_pertumbuhan=?,
             luas_wilayah=?, jumlah_faskes=?, jumlah_rentan=?, latitude=?, longitude=?,
             kode_kabupaten=?, sumber_data=?, tahun_data=?, aktif_di_peta=?
         WHERE id=?"
    );
    $stmt->bind_param(
        'siddiiddssiii',
        $d['nama_kecamatan'],
        $d['jumlah_penduduk'],
        $d['laju_pertumbuhan'],
        $d['luas_wilayah'],
        $d['jumlah_faskes'],
        $d['jumlah_rentan'],
        $d['latitude'],
        $d['longitude'],
        $d['kode_kabupaten'],
        $d['sumber_data'],
        $d['tahun_data'],
        $d['aktif_di_peta'],
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
