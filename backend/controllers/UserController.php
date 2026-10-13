<?php

require_once __DIR__ . "/../config/db.php";
require_once __DIR__ . "/../helpers/response.php";
require_once __DIR__ . "/../middleware/auth.php";

$database = new Database();
$db = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'];

if (strpos($requestUri, 'register') !== false) {
    $input = json_decode(file_get_contents("php://input"), true);

    if (empty($input['full_name']) || empty($input['email']) || empty($input['password'])) {
        sendResponse(400, false, "Sila lengkapkan nama, e-mel, dan kata laluan.");
    }

    $checkStmt = $db->prepare("SELECT user_id FROM users WHERE email = :email");
    $checkStmt->execute([':email' => $input['email']]);
    if ($checkStmt->rowCount() > 0) {
        sendResponse(400, false, "E-mel ini telah digunakan.");
    }

    $allowedRoles = ['customer', 'organiser', 'admin', 'super_admin'];
    $role = (isset($input['role']) && in_array($input['role'], $allowedRoles)) ? $input['role'] : 'customer';
    $hashedPassword = password_hash($input['password'], PASSWORD_BCRYPT);

    $query = "INSERT INTO users (full_name, email, password, role) VALUES (:name, :email, :pass, :role)";
    $stmt = $db->prepare($query);

    if ($stmt->execute([':name' => $input['full_name'], ':email' => $input['email'], ':pass' => $hashedPassword, ':role' => $role])) {
        sendResponse(201, true, "Pendaftaran akaun berjaya!");
    } else {
        sendResponse(500, false, "Gagal mendaftar pengguna.");
    }
}

if (strpos($requestUri, 'login') !== false) {
    $input = json_decode(file_get_contents("php://input"), true);

    if (empty($input['email']) || empty($input['password'])) {
        sendResponse(400, false, "Sila masukkan e-mel dan kata laluan.");
    }

    $query = "SELECT * FROM users WHERE email = :email";
    $stmt = $db->prepare($query);
    $stmt->execute([':email' => $input['email']]);
    $user = $stmt->fetch();

    if ($user && password_verify($input['password'], $user['password'])) {
        $payload = [
            "user_id" => $user['user_id'],
            "full_name" => $user['full_name'],
            "email" => $user['email'],
            "role" => $user['role']
        ];

        $token = AuthMiddleware::generateToken($payload);

        sendResponse(200, true, "Log masuk berjaya!", [
            "token" => $token,
            "user" => $payload
        ]);
    } else {
        sendResponse(401, false, "E-mel atau kata laluan tidak sah.");
    }
}

if (strpos($requestUri, 'profile') !== false) {
    $currentUser = AuthMiddleware::authenticate();
    
    $stmt = $db->prepare("SELECT user_id, full_name, email, role, created_at FROM users WHERE user_id = :id");
    $stmt->execute([':id' => $currentUser['user_id']]);
    $user = $stmt->fetch();

    sendResponse(200, true, "Maklumat profil berjaya diambil.", $user);
}

if (strpos($requestUri, 'users') !== false && strpos($requestUri, 'profile') === false) {
    AuthMiddleware::authorize(['admin', 'super_admin']);

    $stmt = $db->query("SELECT user_id, full_name, email, role, created_at FROM users ORDER BY user_id DESC");
    $users = $stmt->fetchAll();

    sendResponse(200, true, "Senarai semua pengguna berjaya diambil.", $users);
}

sendResponse(404, false, "Route tidak dijumpai.");
