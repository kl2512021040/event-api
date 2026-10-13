<?php
// backend/create_admin.php
require_once __DIR__ . '/config/db.php';

// Ambil sambungan database mengikut konfigurasi projek korang
if (isset($pdo)) {
    $conn = $pdo;
} elseif (isset($db)) {
    $conn = $db;
} elseif (isset($conn)) {
    $conn = $conn;
} elseif (class_exists('Database')) {
    $database = new Database();
    $conn = method_exists($database, 'connect') ? $database->connect() : $database->getConnection();
} else {
    die("Gagal mengesan pembolehubah sambungan pangkalan data.");
}

$fullName = 'Master Super Admin';
$email    = 'superadmin@eventhub.com';
$password = 'super123';
$role     = 'super_admin';

// Jana hash kata laluan PHP yang sah
$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

try {
    $stmt = $conn->prepare("INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)");
    $stmt->execute([$fullName, $email, $hashedPassword, $role]);
    
    echo "<h2 style='color:green;'>Akaun Admin Berjaya Dicipta!</h2>";
    echo "<p>E-mel: <strong>$email</strong></p>";
    echo "<p>Kata Laluan: <strong>$password</strong></p>";
    echo "<br><a href='../frontend/login.html'>Klik di sini untuk Log Masuk</a>";
} catch (PDOException $e) {
    echo "<h3 style='color:red;'>Gagal mencipta admin: " . $e->getMessage() . "</h3>";
}