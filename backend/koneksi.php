<?php
// Koneksi database MySQL — digunakan oleh seluruh API.
$host = getenv('MYSQL_HOST') ?: (getenv('DB_HOST') ?: "localhost");
$port = (int) (getenv('MYSQL_PORT') ?: (getenv('DB_PORT') ?: 3306));
$user = getenv('MYSQL_USER') ?: (getenv('DB_USER') ?: "root");
$pass = getenv('MYSQL_PASSWORD') ?: (getenv('DB_PASSWORD') ?: "");
$db   = getenv('MYSQL_DATABASE') ?: (getenv('DB_NAME') ?: "jember_db");

$conn = new mysqli($host, $user, $pass, $db, $port);

if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode([
        "success"  => false,
        "message"  => "Koneksi database gagal.",
        "data"     => null
    ]));
}

$conn->set_charset("utf8mb4");
