<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
// API autentikasi: login, logout, dan cek sesi aktif.

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/_middleware.php';

// CORS — izinkan origin dev Vite dan domain production
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
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';

// ------- GET /api/auth.php?action=me -------
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'me') {
    if (empty($_SESSION['user_id'])) {
        jsonResponse(['success' => false, 'message' => 'Belum login.', 'data' => null], 401);
    }
    $stmt = $conn->prepare("SELECT role FROM users WHERE id = ? LIMIT 1");
    $userId = (int) $_SESSION['user_id'];
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    if (!$user) {
        session_destroy();
        jsonResponse(['success' => false, 'message' => 'Sesi tidak lagi valid.', 'data' => null], 401);
    }

    $_SESSION['role'] = $user['role'];
    jsonResponse([
        'success' => true,
        'message' => 'OK',
        'data'    => [
            'id'         => $_SESSION['user_id'],
            'username'   => $_SESSION['username'],
            'role'       => $_SESSION['role'],
            'csrf_token' => generateCsrfToken(),
        ],
    ]);
}

// ------- POST /api/auth.php?action=login -------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'login') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (empty($username) || empty($password)) {
        jsonResponse(['success' => false, 'message' => 'Username dan password wajib diisi.', 'data' => null], 422);
    }

    $stmt = $conn->prepare("SELECT id, username, password_hash, role FROM users WHERE username = ? LIMIT 1");
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user   = $result->fetch_assoc();

    // Pesan error generik — tidak bocorkan info spesifik
    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['success' => false, 'message' => 'Username atau password salah.', 'data' => null], 401);
    }

    // Buat sesi baru (hindari session fixation)
    reopenSession();
    session_regenerate_id(true);
    $_SESSION['user_id']  = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role']     = $user['role'];
    $csrfToken = generateCsrfToken();
    session_write_close();

    jsonResponse([
        'success' => true,
        'message' => 'Login berhasil.',
        'data'    => [
            'id'         => $user['id'],
            'username'   => $user['username'],
            'role'       => $user['role'],
            'csrf_token' => $csrfToken,
        ],
    ]);
}

// ------- POST /api/auth.php?action=logout -------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'logout') {
    reopenSession();
    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Logout berhasil.', 'data' => null]);
}

jsonResponse(['success' => false, 'message' => 'Action tidak dikenali.', 'data' => null], 400);
