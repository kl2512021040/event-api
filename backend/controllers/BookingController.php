<?php
// backend/controllers/BookingController.php
require_once __DIR__ . "/../config/db.php";
require_once __DIR__ . "/../helpers/response.php";
require_once __DIR__ . "/../middleware/auth.php";

$database = new Database();
$db = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'];

$uri = parse_url($requestUri, PHP_URL_PATH);
$parts = explode('/', trim($uri, '/'));
$lastPart = end($parts);
$secondLastPart = isset($parts[count($parts) - 2]) ? $parts[count($parts) - 2] : '';

// Pengecaman Aksi Batal (/bookings/{id}/cancel)
$isCancelAction = ($lastPart === 'cancel');
$bookingId = $isCancelAction ? $secondLastPart : $lastPart;
$hasId = is_numeric($bookingId);

// -------------------------------------------------------------
// 1. CANCEL BOOKING 
// -------------------------------------------------------------
if ($hasId && $isCancelAction) {
    if ($method === 'POST' || $method === 'PATCH' || $method === 'PUT' || $method === 'DELETE') {
        $currentUser = AuthMiddleware::authenticate();

        $stmt = $db->prepare("SELECT * FROM bookings WHERE booking_id = :id");
        $stmt->execute([':id' => $bookingId]);
        $booking = $stmt->fetch();

        if (!$booking) {
            sendResponse(404, false, "Tempahan tidak dijumpai.");
        }

        // Semak hak akses
        if (!in_array($currentUser['role'], ['admin', 'super_admin']) && $booking['user_id'] != $currentUser['user_id']) {
            sendResponse(403, false, "Akses ditolak.");
        }

        if ($booking['status'] === 'cancelled') {
            sendResponse(400, false, "Tempahan ini telah dibatalkan sebelum ini.");
        }

        $db->beginTransaction();

        try {
           
            $updateBooking = $db->prepare("UPDATE bookings SET status = 'cancelled' WHERE booking_id = :id");
            $updateBooking->execute([':id' => $bookingId]);

            
            $updateEvent = $db->prepare("UPDATE events SET available_tickets = available_tickets + :qty WHERE event_id = :event_id");
            $updateEvent->execute([
                ':qty' => $booking['quantity'],
                ':event_id' => $booking['event_id']
            ]);

            $db->commit();

            sendResponse(200, true, "Tempahan berjaya dibatalkan dan tiket telah dikembalikan.");
        } catch (Exception $e) {
            $db->rollBack();
            sendResponse(500, false, "Gagal membatalkan tempahan: " . $e->getMessage());
        }
    } else {
        sendResponse(405, false, "Method tidak dibenarkan untuk tindakan pembatalan.");
    }
}

// -------------------------------------------------------------
// 2. GET /backend/bookings ATAU /backend/bookings/{id}
// -------------------------------------------------------------
if ($method === 'GET') {
    $currentUser = AuthMiddleware::authenticate();

    if ($hasId) {
        $query = "SELECT b.*, e.title as event_title, e.event_date, v.name as venue_name, v.location 
                  FROM bookings b 
                  LEFT JOIN events e ON b.event_id = e.event_id 
                  LEFT JOIN venues v ON e.venue_id = v.venue_id 
                  WHERE b.booking_id = :id";
        $stmt = $db->prepare($query);
        $stmt->execute([':id' => $bookingId]);
        $booking = $stmt->fetch();

        if (!$booking) {
            sendResponse(404, false, "Tempahan tidak dijumpai.");
        }

        if (!in_array($currentUser['role'], ['admin', 'super_admin']) && $booking['user_id'] != $currentUser['user_id']) {
            sendResponse(403, false, "Akses ditolak.");
        }

        $qrData = urlencode("BOOKING_CODE:" . $booking['booking_code'] . "|EVENT:" . $booking['event_title']);
        $booking['qr_code_url'] = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" . $qrData;

        sendResponse(200, true, "Maklumat tempahan berjaya diambil.", $booking);
    } else {
        // Benarkan Admin DAN Super Admin lihat semua tempahan
        if (in_array($currentUser['role'], ['admin', 'super_admin'])) {
            $query = "SELECT b.*, u.full_name as customer_name, e.title as event_title, e.event_date 
                      FROM bookings b 
                      LEFT JOIN users u ON b.user_id = u.user_id 
                      LEFT JOIN events e ON b.event_id = e.event_id 
                      ORDER BY b.booking_id DESC";
            $stmt = $db->query($query);
        } else {
            $query = "SELECT b.*, e.title as event_title, e.event_date, e.ticket_price 
                      FROM bookings b 
                      LEFT JOIN events e ON b.event_id = e.event_id 
                      WHERE b.user_id = :user_id 
                      ORDER BY b.booking_id DESC";
            $stmt = $db->prepare($query);
            $stmt->execute([':user_id' => $currentUser['user_id']]);
        }

        $bookings = $stmt->fetchAll();

        foreach ($bookings as &$item) {
            $qrData = urlencode("BOOKING_CODE:" . $item['booking_code']);
            $item['qr_code_url'] = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" . $qrData;
        }

        sendResponse(200, true, "Senarai tempahan berjaya diambil.", $bookings);
    }
}

// -------------------------------------------------------------
// 3. POST /backend/bookings (BUAT TEMPAHAN BARU)
// -------------------------------------------------------------
if ($method === 'POST') {
    $currentUser = AuthMiddleware::authorize(['customer', 'admin', 'super_admin']);
    $input = json_decode(file_get_contents("php://input"), true);

    if (empty($input['event_id']) || empty($input['quantity']) || $input['quantity'] <= 0) {
        sendResponse(400, false, "Sila pilih acara dan kuantiti tiket yang sah.");
    }

    $eventStmt = $db->prepare("SELECT ticket_price, available_tickets, title FROM events WHERE event_id = :event_id");
    $eventStmt->execute([':event_id' => $input['event_id']]);
    $event = $eventStmt->fetch();

    if (!$event) {
        sendResponse(404, false, "Acara tidak wujud.");
    }

    if ($event['available_tickets'] < $input['quantity']) {
        sendResponse(400, false, "Baki tiket tidak mencukupi. Tiket tinggal " . $event['available_tickets'] . " sahaja.");
    }

    $totalAmount = $event['ticket_price'] * $input['quantity'];
    $bookingCode = "BK-" . date("Ymd") . "-" . rand(1000, 9999);

    $db->beginTransaction();

    try {
        $insertStmt = $db->prepare("INSERT INTO bookings (booking_code, user_id, event_id, quantity, total_amount, status) VALUES (:code, :user_id, :event_id, :qty, :total, 'confirmed')");
        $insertStmt->execute([
            ':code' => $bookingCode,
            ':user_id' => $currentUser['user_id'],
            ':event_id' => $input['event_id'],
            ':qty' => $input['quantity'],
            ':total' => $totalAmount
        ]);

        $updateStmt = $db->prepare("UPDATE events SET available_tickets = available_tickets - :qty WHERE event_id = :event_id");
        $updateStmt->execute([
            ':qty' => $input['quantity'],
            ':event_id' => $input['event_id']
        ]);

        $db->commit();

        $qrData = urlencode("BOOKING_CODE:" . $bookingCode . "|EVENT:" . $event['title']);
        $qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" . $qrData;

        sendResponse(201, true, "Tempahan tiket berjaya dibuat!", [
            "booking_code" => $bookingCode,
            "total_amount" => $totalAmount,
            "qr_code_url" => $qrCodeUrl
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        sendResponse(500, false, "Gagal membuat tempahan: " . $e->getMessage());
    }
}

sendResponse(405, false, "Method tidak dibenarkan.");
