<?php
// backend/config/db.php

class Database {
    private $host = "localhost";
    private $db_name = "event_booking_db";
    private $username = "root";
    private $password = "";
    public $conn;

    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name,
                $this->username,
                $this->password
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        } catch(PDOException $exception) {
            header("Content-Type: application/json; charset=UTF-8");
            http_response_code(500);
            echo json_encode([
                "status" => false,
                "message" => "Database Connection Error: " . $exception->getMessage()
            ]);
            exit();
        }

        return $this->conn;
    }
}