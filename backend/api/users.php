<?php
// CRUD akun dan reset password — khusus admin.

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/_middleware.php';

$allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
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
requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET') {
    $result = $conn->query("SELECT id, username, role, created_at FROM users ORDER BY username ASC");
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (int) $row['id'];
        $users[] = $row;
    }
    jsonResponse(['success' => true, 'message' => 'OK', 'data' => $users]);
}

if (!in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    jsonResponse(['success' => false, 'message' => 'Method tidak didukung.', 'data' => null], 405);
}

requireCsrf();
$body = json_decode(file_get_contents('php://input'), true) ?? [];

function validateUsername($username): string {
    if (!is_string($username)) {
        jsonResponse(['success' => false, 'message' => 'Username tidak valid.', 'data' => null], 422);
    }
    $username = trim($username);
    if (!preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username)) {
        jsonResponse([
            'success' => false,
            'message' => 'Username harus 3–50 karakter dan hanya berisi huruf, angka, atau underscore.',
            'data' => null,
        ], 422);
    }
    return $username;
}

function validatePassword($password): string {
    if (!is_string($password)
        || strlen($password) < 8
        || strlen($password) > 72
        || !preg_match('/[A-Z]/', $password)
        || !preg_match('/[a-z]/', $password)
        || !preg_match('/[0-9]/', $password)) {
        jsonResponse([
            'success' => false,
            'message' => 'Password wajib 8–72 karakter serta mengandung huruf besar, huruf kecil, dan angka.',
            'data' => null,
        ], 422);
    }
    return $password;
}

function executeUserMutation(mysqli_stmt $stmt): void {
    try {
        $stmt->execute();
    } catch (mysqli_sql_exception $error) {
        if ((int) $error->getCode() === 1062) {
            jsonResponse(['success' => false, 'message' => 'Username sudah digunakan.', 'data' => null], 409);
        }
        error_log('User API database error (' . $error->getCode() . ').');
        jsonResponse(['success' => false, 'message' => 'Perubahan user gagal disimpan.', 'data' => null], 500);
    }
}

function ensureAdminRemains(mysqli $conn, int $userId): void {
    $stmt = $conn->prepare("SELECT role FROM users WHERE id = ? LIMIT 1");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $target = $stmt->get_result()->fetch_assoc();
    if (!$target) {
        jsonResponse(['success' => false, 'message' => 'User tidak ditemukan.', 'data' => null], 404);
    }

    if ($target['role'] === 'admin') {
        $result = $conn->query("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
        if ((int) $result->fetch_assoc()['total'] <= 1) {
            jsonResponse(['success' => false, 'message' => 'Admin terakhir tidak dapat dihapus atau diturunkan rolenya.', 'data' => null], 409);
        }
    }
}

if ($method === 'POST') {
    $username = validateUsername($body['username'] ?? null);
    $password = validatePassword($body['password'] ?? null);

    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ? LIMIT 1");
    $stmt->bind_param('s', $username);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        jsonResponse(['success' => false, 'message' => 'Username sudah digunakan.', 'data' => null], 409);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')");
    $stmt->bind_param('ss', $username, $passwordHash);
    executeUserMutation($stmt);
    jsonResponse(['success' => true, 'message' => 'User berhasil ditambahkan.', 'data' => ['id' => $conn->insert_id]], 201);
}

$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
if (!$id || $id < 1) {
    jsonResponse(['success' => false, 'message' => 'ID user tidak valid.', 'data' => null], 400);
}

if ($method === 'PUT') {
    $username = validateUsername($body['username'] ?? null);
    $password = $body['password'] ?? '';
    if ($password !== '' && !is_string($password)) {
        jsonResponse(['success' => false, 'message' => 'Password tidak valid.', 'data' => null], 422);
    }

    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1");
    $stmt->bind_param('si', $username, $id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        jsonResponse(['success' => false, 'message' => 'Username sudah digunakan.', 'data' => null], 409);
    }

    if ($password !== '') {
        $password = validatePassword($password);
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE users SET username = ?, role = 'admin', password_hash = ? WHERE id = ?");
        $stmt->bind_param('ssi', $username, $passwordHash, $id);
    } else {
        $stmt = $conn->prepare("UPDATE users SET username = ?, role = 'admin' WHERE id = ?");
        $stmt->bind_param('si', $username, $id);
    }
    executeUserMutation($stmt);
    if ($stmt->affected_rows === 0) {
        $exists = $conn->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
        $exists->bind_param('i', $id);
        $exists->execute();
        if ($exists->get_result()->num_rows === 0) {
            jsonResponse(['success' => false, 'message' => 'User tidak ditemukan.', 'data' => null], 404);
        }
    }
    if ((int) $_SESSION['user_id'] === $id) {
        $_SESSION['username'] = $username;
    }
    jsonResponse(['success' => true, 'message' => 'User berhasil diperbarui.', 'data' => null]);
}

if ((int) $_SESSION['user_id'] === (int) $id) {
    jsonResponse(['success' => false, 'message' => 'Akun yang sedang digunakan tidak dapat dihapus.', 'data' => null], 409);
}

ensureAdminRemains($conn, (int) $id);
$stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
$stmt->bind_param('i', $id);
executeUserMutation($stmt);
jsonResponse(['success' => true, 'message' => 'User berhasil dihapus.', 'data' => null]);
