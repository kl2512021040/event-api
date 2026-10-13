<?php

require_once __DIR__ . "/../config/db.php";
require_once __DIR__ . "/../helpers/response.php";
require_once __DIR__ . "/../middleware/auth.php";

$database = new Database();
$db = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'];

$uri = parse_url($requestUri, PHP_URL_PATH);
$parts = explode('/', trim($uri, '/'));
$id = end($parts);
$hasId = is_numeric($id);

if ($method === 'GET') {
    if ($hasId) {
        $stmt = $db->prepare("SELECT * FROM venues WHERE venue_id = :id");
        $stmt->execute([':id' => $id]);
        $venue = $stmt->fetch();

        if ($venue) {
            sendResponse(200, true, "Maklumat tempat berjaya diambil.", $venue);
        } else {
            sendResponse(404, false, "Tempat tidak dijumpai.");
        }
    } else {
        $stmt = $db->query("SELECT v.*, u.full_name as created_by_name FROM venues v LEFT JOIN users u ON v.created_by = u.user_id ORDER BY v.venue_id DESC");
        $venues = $stmt->fetchAll();
        sendResponse(200, true, "Senarai tempat berjaya diambil.", $venues);
    }
}

if ($method === 'POST') {
    $currentUser = AuthMiddleware::authorize(['admin', 'organiser']);
    $input = json_decode(file_get_contents("php://input"), true);

    if (empty($input['name']) || empty($input['location']) || empty($input['capacity']) || empty($input['city'])) {
        sendResponse(400, false, "Sila lengkapkan nama, lokasi, kapasiti, dan bandar.");
    }

    $query = "INSERT INTO venues (name, location, capacity, city, created_by) VALUES (:name, :location, :capacity, :city, :created_by)";
    $stmt = $db->prepare($query);

    if ($stmt->execute([
        ':name' => $input['name'],
        ':location' => $input['location'],
        ':capacity' => $input['capacity'],
        ':city' => $input['city'],
        ':created_by' => $currentUser['user_id']
    ])) {
        sendResponse(201, true, "Lokasi baru berjaya ditambah!");
    } else {
        sendResponse(500, false, "Gagal menambah lokasi.");
    }
}

if ($method === 'PUT' && $hasId) {
    AuthMiddleware::authorize(['admin', 'organiser']);
    $input = json_decode(file_get_contents("php://input"), true);

    if (empty($input['name']) || empty($input['location']) || empty($input['capacity']) || empty($input['city'])) {
        sendResponse(400, false, "Sila lengkapkan semua medan untuk dikemaskini.");
    }

    $query = "UPDATE venues SET name = :name, location = :location, capacity = :capacity, city = :city WHERE venue_id = :id";
    $stmt = $db->prepare($query);

    if ($stmt->execute([
        ':name' => $input['name'],
        ':location' => $input['location'],
        ':capacity' => $input['capacity'],
        ':city' => $input['city'],
        ':id' => $id
    ])) {
        sendResponse(200, true, "Maklumat tempat berjaya dikemaskini!");
    } else {
        sendResponse(500, false, "Gagal mengemaskini tempat.");
    }
}

if ($method === 'DELETE' && $hasId) {
    AuthMiddleware::authorize(['admin', 'organiser']);

    $stmt = $db->prepare("DELETE FROM venues WHERE venue_id = :id");
    if ($stmt->execute([':id' => $id])) {
        sendResponse(200, true, "Lokasi berjaya dipadam!");
    } else {
        sendResponse(500, false, "Gagal memadam lokasi.");
    }
}

sendResponse(405, false, "Method tidak dibenarkan.");
