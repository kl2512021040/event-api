<?php
// backend/middleware/auth.php
require_once __DIR__ . "/../helpers/response.php";

class AuthMiddleware {
    private static $secret_key = "event_booking_secret_key_123!";

    // Semak dan periksa Token Authorization
    public static function authenticate() {
        $headers = getallheaders();
        $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : (isset($headers['authorization']) ? $headers['authorization'] : '');

        if (!$authHeader || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            sendResponse(401, false, "Akses ditolak. Token authentication tidak disediakan.");
        }

        $token = $matches[1];
        $decoded = self::decodeToken($token);

        if (!$decoded) {
            sendResponse(401, false, "Token tidak sah atau telah tamat tempoh.");
        }

        return $decoded; // Mengembalikan data payload user (user_id, email, role)
    }

    // Semak Peranan / Role Pengguna (Admin / Organiser / Customer)
    public static function authorize($allowedRoles = []) {
        $user = self::authenticate();
        if (!in_array($user['role'], $allowedRoles)) {
            sendResponse(403, false, "Akses ditolak. Anda tidak mempunyai kebenaran untuk fungsi ini.");
        }
        return $user;
    }

    // Helper Ringkas Cipta Token Base64-JWT (Simulasi JWT Selamat)
    public static function generateToken($payload) {
        $payload['exp'] = time() + (3600 * 24); // Tamat tempoh dalam 24 jam
        $base64Payload = base64_encode(json_encode($payload));
        $signature = hash_hmac('sha256', $base64Payload, self::$secret_key);
        return $base64Payload . "." . $signature;
    }

    // Helper Dekod Token
    private static function decodeToken($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 2) return false;

        list($base64Payload, $signature) = $parts;
        $validSignature = hash_hmac('sha256', $base64Payload, self::$secret_key);

        if (!hash_equals($validSignature, $signature)) return false;

        $payload = json_decode(base64_decode($base64Payload), true);
        if (isset($payload['exp']) && $payload['exp'] < time()) return false;

        return $payload;
    }
}