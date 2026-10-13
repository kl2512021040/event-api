<?php
// backend/controllers/EventController.php
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

// -------------------------------------------------------------
// GET /backend/events
// -------------------------------------------------------------
if ($method === 'GET') {
    if ($hasId) {
        $query = "SELECT e.*, v.name as venue_name, v.location, v.city, u.full_name as organiser_name 
                  FROM events e 
                  LEFT JOIN venues v ON e.venue_id = v.venue_id 
                  LEFT JOIN users u ON e.organiser_id = u.user_id 
                  WHERE e.event_id = :id";
        $stmt = $db->prepare($query);
        $stmt->execute([':id' => $id]);
        $event = $stmt->fetch();

        if ($event) {
            sendResponse(200, true, "Maklumat acara berjaya diambil.", $event);
        } else {
            sendResponse(404, false, "Acara tidak dijumpai.");
        }
    } else {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $city = isset($_GET['city']) ? trim($_GET['city']) : '';
        $sort = isset($_GET['sort']) && strtolower($_GET['sort']) === 'asc' ? 'ASC' : 'DESC';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        
        // DIBAIKE: Pengiraan Offset
        $offset = ($page - 1) * $limit;

        $whereClause = "WHERE 1=1";
        $params = [];

        if (!empty($search)) {
            $whereClause .= " AND (e.title LIKE :search OR e.description LIKE :search)";
            $params[':search'] = "%$search%";
        }

        if (!empty($city)) {
            $whereClause .= " AND v.city = :city";
            $params[':city'] = $city;
        }

        $countQuery = "SELECT COUNT(*) as total FROM events e LEFT JOIN venues v ON e.venue_id = v.venue_id $whereClause";
        $countStmt = $db->prepare($countQuery);
        $countStmt->execute($params);
        $totalRecords = $countStmt->fetch()['total'];

        $query = "SELECT e.*, v.name as venue_name, v.city, u.full_name as organiser_name 
                  FROM events e 
                  LEFT JOIN venues v ON e.venue_id = v.venue_id 
                  LEFT JOIN users u ON e.organiser_id = u.user_id 
                  $whereClause 
                  ORDER BY e.event_date $sort 
                  LIMIT $limit OFFSET $offset";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $events = $stmt->fetchAll();

        $pagination = [
            "total_records" => (int)$totalRecords,
            "current_page" => $page,
            "total_pages" => ceil($totalRecords / $limit),
            "limit" => $limit
        ];

        sendResponse(200, true, "Senarai acara berjaya diambil.", [
            "events" => $events,
            "pagination" => $pagination
        ]);
    }
}

// -------------------------------------------------------------
// POST /backend/events (Organiser, Admin, Super Admin)
// -------------------------------------------------------------
if ($method === 'POST') {
    $currentUser = AuthMiddleware::authorize(['admin', 'super_admin', 'organiser']);
    $input = json_decode(file_get_contents("php://input"), true);

    if (empty($input['title']) || empty($input['event_date']) || empty($input['ticket_price']) || empty($input['total_tickets']) || empty($input['venue_id'])) {
        sendResponse(400, false, "Sila lengkapkan tajuk, tarikh, harga, jumlah tiket, dan lokasi acara.");
    }

    $query = "INSERT INTO events (title, description, event_date, ticket_price, total_tickets, available_tickets, venue_id, organiser_id) 
              VALUES (:title, :description, :event_date, :price, :total, :available, :venue_id, :organiser_id)";
    $stmt = $db->prepare($query);

    if ($stmt->execute([
        ':title' => $input['title'],
        ':description' => isset($input['description']) ? $input['description'] : '',
        ':event_date' => $input['event_date'],
        ':price' => $input['ticket_price'],
        ':total' => $input['total_tickets'],
        ':available' => $input['total_tickets'],
        ':venue_id' => $input['venue_id'],
        ':organiser_id' => $currentUser['user_id']
    ])) {
        sendResponse(201, true, "Acara baru berjaya dicipta!");
    } else {
        sendResponse(500, false, "Gagal mencipta acara.");
    }
}

// -------------------------------------------------------------
// PUT /backend/events/{id}
// -------------------------------------------------------------
if ($method === 'PUT' && $hasId) {
    AuthMiddleware::authorize(['admin', 'super_admin', 'organiser']);
    $input = json_decode(file_get_contents("php://input"), true);

    if (empty($input['title']) || empty($input['event_date']) || empty($input['ticket_price'])) {
        sendResponse(400, false, "Sila lengkapkan maklumat asas acara untuk dikemaskini.");
    }

    $query = "UPDATE events SET title = :title, description = :desc, event_date = :event_date, ticket_price = :price WHERE event_id = :id";
    $stmt = $db->prepare($query);

    if ($stmt->execute([
        ':title' => $input['title'],
        ':desc' => isset($input['description']) ? $input['description'] : '',
        ':event_date' => $input['event_date'],
        ':price' => $input['ticket_price'],
        ':id' => $id
    ])) {
        sendResponse(200, true, "Maklumat acara berjaya dikemaskini!");
    } else {
        sendResponse(500, false, "Gagal mengemaskini acara.");
    }
}

// -------------------------------------------------------------
// DELETE /backend/events/{id}
// -------------------------------------------------------------
if ($method === 'DELETE' && $hasId) {
    AuthMiddleware::authorize(['admin', 'super_admin', 'organiser']);

    $stmt = $db->prepare("DELETE FROM events WHERE event_id = :id");
    if ($stmt->execute([':id' => $id])) {
        sendResponse(200, true, "Acara berjaya dipadam!");
    } else {
        sendResponse(500, false, "Gagal memadam acara.");
    }
}

sendResponse(405, false, "Method tidak dibenarkan.");