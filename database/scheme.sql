-- Cipta Database jika belum wujud
CREATE DATABASE IF NOT EXISTS `event_booking_db`;
USE `event_booking_db`;

-- 1. Jadual Users
CREATE TABLE IF NOT EXISTS `users` (
    `user_id` INT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'organiser', 'customer') DEFAULT 'customer',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Jadual Venues
CREATE TABLE IF NOT EXISTS `venues` (
    `venue_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `location` TEXT NOT NULL,
    `capacity` INT NOT NULL,
    `city` VARCHAR(50) NOT NULL,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL
);

-- 3. Jadual Events
CREATE TABLE IF NOT EXISTS `events` (
    `event_id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT,
    `event_date` DATETIME NOT NULL,
    `ticket_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_tickets` INT NOT NULL,
    `available_tickets` INT NOT NULL,
    `venue_id` INT,
    `organiser_id` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`venue_id`) REFERENCES `venues`(`venue_id`) ON DELETE CASCADE,
    FOREIGN KEY (`organiser_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
);

-- 4. Jadual Bookings
CREATE TABLE IF NOT EXISTS `bookings` (
    `booking_id` INT AUTO_INCREMENT PRIMARY KEY,
    `booking_code` VARCHAR(20) NOT NULL UNIQUE,
    `user_id` INT NOT NULL,
    `event_id` INT NOT NULL,
    `quantity` INT NOT NULL,
    `total_amount` DECIMAL(10,2) NOT NULL,
    `status` ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`event_id`) REFERENCES `events`(`event_id`) ON DELETE CASCADE
);