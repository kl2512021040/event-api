<?php
// backend/index.php
require_once __DIR__ . "/helpers/response.php";
require_once __DIR__ . "/config/db.php";

$request_uri = $_SERVER['REQUEST_URI'];
$script_name = $_SERVER['SCRIPT_NAME'];

// Padamkan direktori parent dan 'index.php' daripada URL
$path = str_replace(dirname($script_name), '', $request_uri);
$path = str_replace('/index.php', '', $path);
$path = parse_url($path, PHP_URL_PATH);
$uri = explode('/', trim($path, '/'));

$endpoint = isset($uri[0]) ? $uri[0] : '';

switch ($endpoint) {
    case 'auth':
    case 'users':
        require_once __DIR__ . "/controllers/UserController.php";
        break;

    case 'venues':
        require_once __DIR__ . "/controllers/VenueController.php";
        break;

    case 'events':
        require_once __DIR__ . "/controllers/EventController.php";
        break;

    case 'bookings':
        require_once __DIR__ . "/controllers/BookingController.php";
        break;

    case '':
        sendResponse(200, true, "Selamat datang ke Event Ticketing & Venue Booking API!");
        break;

    default:
        sendResponse(404, false, "Endpoint API '{$endpoint}' tidak dijumpai.");
        break;
}