<?php
// Informasi tim publik dan pengelolaan anggota/foto khusus admin.

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/_middleware.php';

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
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
$method = $_SERVER['REQUEST_METHOD'];

function getTeamMembers(mysqli $conn): array {
    $basePath = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/\\');
    $result = $conn->query("SELECT id, name, position, photo_path FROM team_members ORDER BY id ASC");
    $members = [];
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (int) $row['id'];
        $row['photo_url'] = $basePath . '/uploads/team/' . rawurlencode($row['photo_path']);
        unset($row['photo_path']);
        $members[] = $row;
    }
    return $members;
}

if ($method === 'GET') {
    $result = $conn->query("SELECT team_name FROM team_settings WHERE id = 1");
    $settings = $result->fetch_assoc();
    jsonResponse([
        'success' => true,
        'message' => 'OK',
        'data' => [
            'name' => $settings['team_name'] ?? 'Tim Pengembang',
            'members' => getTeamMembers($conn),
        ],
    ]);
}

if (!in_array($method, ['POST', 'DELETE'], true)) {
    jsonResponse(['success' => false, 'message' => 'Method tidak didukung.', 'data' => null], 405);
}

requireAdmin();
requireCsrf();

function cleanTeamText($value, string $field, int $max, bool $required): string {
    if (!is_string($value)) {
        if (!$required && ($value === null || $value === '')) {
            return '';
        }
        jsonResponse(['success' => false, 'message' => "{$field} tidak valid.", 'data' => null], 422);
    }
    $value = trim($value);
    if (($required && strlen($value) < 2) || strlen($value) > $max) {
        jsonResponse(['success' => false, 'message' => "{$field} harus berisi " . ($required ? 'minimal 2 dan ' : '') . "maksimal {$max} karakter.", 'data' => null], 422);
    }
    return $value;
}

function uploadTeamPhoto(): string {
    if (!isset($_FILES['photo'])) {
        jsonResponse(['success' => false, 'message' => 'Foto anggota wajib diunggah.', 'data' => null], 422);
    }

    $file = $_FILES['photo'];
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
        jsonResponse(['success' => false, 'message' => 'Ukuran foto maksimal 5 MB.', 'data' => null], 422);
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        error_log('Team photo upload failed with PHP upload error ' . $file['error'] . '.');
        jsonResponse(['success' => false, 'message' => 'Foto gagal diunggah. Silakan coba lagi.', 'data' => null], 500);
    }
    if ($file['size'] < 1 || $file['size'] > 5 * 1024 * 1024) {
        jsonResponse(['success' => false, 'message' => 'Ukuran foto maksimal 5 MB.', 'data' => null], 422);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $image = @getimagesize($file['tmp_name']);
    if (!isset($extensions[$mime]) || !$image || $image['mime'] !== $mime) {
        jsonResponse(['success' => false, 'message' => 'Format foto harus JPG, PNG, atau WebP.', 'data' => null], 422);
    }

    $directory = __DIR__ . '/../uploads/team';
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        error_log('Unable to create team photo upload directory.');
        jsonResponse(['success' => false, 'message' => 'Penyimpanan foto tidak tersedia.', 'data' => null], 500);
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $filename)) {
        error_log('Unable to move uploaded team photo.');
        jsonResponse(['success' => false, 'message' => 'Foto gagal disimpan.', 'data' => null], 500);
    }
    return $filename;
}

function removeTeamPhoto(string $filename): bool {
    $path = __DIR__ . '/../uploads/team/' . basename($filename);
    if (is_file($path) && !unlink($path)) {
        error_log('Unable to remove team photo: ' . basename($filename));
        return false;
    }
    return true;
}

if ($method === 'POST') {
    $action = $_GET['action'] ?? '';
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'multipart/form-data') !== false
        && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 6 * 1024 * 1024) {
        jsonResponse(['success' => false, 'message' => 'Ukuran unggahan maksimal 5 MB.', 'data' => null], 413);
    }
    $body = stripos($contentType, 'application/json') !== false
        ? (json_decode(file_get_contents('php://input'), true) ?? [])
        : $_POST;

    if ($action === 'settings') {
        $name = cleanTeamText($body['name'] ?? null, 'Nama tim', 100, true);
        $stmt = $conn->prepare("INSERT INTO team_settings (id, team_name) VALUES (1, ?) ON DUPLICATE KEY UPDATE team_name = VALUES(team_name)");
        $stmt->bind_param('s', $name);
        $stmt->execute();
        jsonResponse(['success' => true, 'message' => 'Nama tim berhasil diperbarui.', 'data' => null]);
    }

    if ($action !== 'add' && $action !== 'update') {
        jsonResponse(['success' => false, 'message' => 'Action tidak dikenali.', 'data' => null], 400);
    }

    $name = cleanTeamText($body['name'] ?? null, 'Nama anggota', 100, true);
    $position = cleanTeamText($body['position'] ?? '', 'Peran', 100, false);
    $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
    $oldPhoto = null;

    if ($action === 'update') {
        if (!$id || $id < 1) {
            jsonResponse(['success' => false, 'message' => 'ID anggota tidak valid.', 'data' => null], 400);
        }
        $stmt = $conn->prepare("SELECT photo_path FROM team_members WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $member = $stmt->get_result()->fetch_assoc();
        if (!$member) {
            jsonResponse(['success' => false, 'message' => 'Anggota tim tidak ditemukan.', 'data' => null], 404);
        }
        $oldPhoto = $member['photo_path'];
    }

    $newPhoto = isset($_FILES['photo']) && $_FILES['photo']['error'] !== UPLOAD_ERR_NO_FILE
        ? uploadTeamPhoto()
        : null;
    if ($action === 'add' && $newPhoto === null) {
        jsonResponse(['success' => false, 'message' => 'Foto anggota wajib diunggah.', 'data' => null], 422);
    }

    if ($action === 'add') {
        $stmt = $conn->prepare("INSERT INTO team_members (name, position, photo_path) VALUES (?, ?, ?)");
        $stmt->bind_param('sss', $name, $position, $newPhoto);
        $stmt->execute();
        jsonResponse(['success' => true, 'message' => 'Anggota tim berhasil ditambahkan.', 'data' => ['id' => $conn->insert_id]], 201);
    }

    if ($newPhoto !== null) {
        $stmt = $conn->prepare("UPDATE team_members SET name = ?, position = ?, photo_path = ? WHERE id = ?");
        $stmt->bind_param('sssi', $name, $position, $newPhoto, $id);
    } else {
        $stmt = $conn->prepare("UPDATE team_members SET name = ?, position = ? WHERE id = ?");
        $stmt->bind_param('ssi', $name, $position, $id);
    }
    $stmt->execute();
    if ($newPhoto !== null && !removeTeamPhoto($oldPhoto)) {
        jsonResponse(['success' => false, 'message' => 'Anggota diperbarui, tetapi foto lama gagal dihapus.', 'data' => null], 500);
    }
    jsonResponse(['success' => true, 'message' => 'Anggota tim berhasil diperbarui.', 'data' => null]);
}

$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
if (!$id || $id < 1) {
    jsonResponse(['success' => false, 'message' => 'ID anggota tidak valid.', 'data' => null], 400);
}
$stmt = $conn->prepare("SELECT photo_path FROM team_members WHERE id = ? LIMIT 1");
$stmt->bind_param('i', $id);
$stmt->execute();
$member = $stmt->get_result()->fetch_assoc();
if (!$member) {
    jsonResponse(['success' => false, 'message' => 'Anggota tim tidak ditemukan.', 'data' => null], 404);
}
$stmt = $conn->prepare("DELETE FROM team_members WHERE id = ?");
$stmt->bind_param('i', $id);
$stmt->execute();
if (!removeTeamPhoto($member['photo_path'])) {
    jsonResponse(['success' => false, 'message' => 'Anggota dihapus, tetapi foto lama gagal dihapus.', 'data' => null], 500);
}
jsonResponse(['success' => true, 'message' => 'Anggota tim berhasil dihapus.', 'data' => null]);
