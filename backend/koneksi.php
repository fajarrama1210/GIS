<?php
// Koneksi database MySQL — digunakan oleh seluruh API.
$host = getenv('DB_HOST') ?: "localhost";
$user = getenv('DB_USER') ?: "root";
$pass = getenv('DB_PASSWORD') ?: "";
$db   = getenv('DB_NAME') ?: "jember_db";

$conn = new mysqli($host, $user, $pass, $db);

if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode([
        "success"  => false,
        "message"  => "Koneksi database gagal.",
        "data"     => null
    ]));
}

$conn->set_charset("utf8mb4");
?>
