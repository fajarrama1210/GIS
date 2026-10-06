<?php
// Middleware: helper fungsi auth, CSRF, response, dan validasi input.

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// CORS Headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = $_SERVER['HTTP_HOST'] ?? '';
$allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://' . $host,
    'https://' . $host,
    'https://gis.sakti.sch.id'
];
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * Wajib login — kirim 401 jika tidak ada sesi aktif.
 */
function requireAuth(): void {
    if (empty($_SESSION['user_id'])) {
        jsonResponse(['success' => false, 'message' => 'Unauthorized.', 'data' => null], 401);
        exit;
    }
}

/**
 * Wajib memiliki role admin berdasarkan data terbaru di database.
 */
function requireAdmin(): void {
    global $conn;

    requireAuth();
    $stmt = $conn->prepare("SELECT role FROM users WHERE id = ? LIMIT 1");
    $userId = (int) $_SESSION['user_id'];
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    if (!$user || $user['role'] !== 'admin') {
        jsonResponse(['success' => false, 'message' => 'Akses khusus admin.', 'data' => null], 403);
    }

    $_SESSION['role'] = $user['role'];
}

/**
 * Wajib CSRF token valid di header X-CSRF-Token.
 */
function requireCsrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        jsonResponse(['success' => false, 'message' => 'CSRF token tidak valid.', 'data' => null], 403);
        exit;
    }
}

/**
 * Hasilkan dan simpan CSRF token baru ke sesi.
 */
function generateCsrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Kirim JSON response seragam dan hentikan eksekusi.
 */
function jsonResponse(array $payload, int $status = 200): never {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

/**
 * Validasi dan filter input; kembalikan array bersih atau lempar error 422.
 * $rules = [ 'field' => ['type'=>'string|int|float', 'required'=>bool, 'min'=>?, 'max'=>?] ]
 */
function validateInput(array $data, array $rules): array {
    $clean = [];
    $errors = [];

    foreach ($rules as $field => $rule) {
        $value = $data[$field] ?? null;
        $required = $rule['required'] ?? true;

        if ($value === null || $value === '') {
            if ($required) {
                $errors[$field] = "Field '{$field}' wajib diisi.";
            }
            continue;
        }

        switch ($rule['type']) {
            case 'string':
                $value = trim((string) $value);
                if (isset($rule['min']) && strlen($value) < $rule['min']) {
                    $errors[$field] = "'{$field}' minimal {$rule['min']} karakter.";
                }
                if (isset($rule['max']) && strlen($value) > $rule['max']) {
                    $errors[$field] = "'{$field}' maksimal {$rule['max']} karakter.";
                }
                $clean[$field] = $value;
                break;

            case 'int':
                if (!filter_var($value, FILTER_VALIDATE_INT) && $value !== 0) {
                    $errors[$field] = "'{$field}' harus berupa bilangan bulat.";
                    break;
                }
                $value = (int) $value;
                if (isset($rule['min']) && $value < $rule['min']) {
                    $errors[$field] = "'{$field}' minimal {$rule['min']}.";
                }
                if (isset($rule['max']) && $value > $rule['max']) {
                    $errors[$field] = "'{$field}' maksimal {$rule['max']}.";
                }
                $clean[$field] = $value;
                break;

            case 'float':
                if (!is_numeric($value)) {
                    $errors[$field] = "'{$field}' harus berupa angka.";
                    break;
                }
                $value = (float) $value;
                if (isset($rule['min']) && $value < $rule['min']) {
                    $errors[$field] = "'{$field}' minimal {$rule['min']}.";
                }
                if (isset($rule['max']) && $value > $rule['max']) {
                    $errors[$field] = "'{$field}' maksimal {$rule['max']}.";
                }
                $clean[$field] = $value;
                break;
        }
    }

    if (!empty($errors)) {
        jsonResponse(['success' => false, 'message' => 'Validasi gagal.', 'data' => $errors], 422);
    }

    return $clean;
}
