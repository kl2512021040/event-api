USE `event_booking_db`;

-- 1. Rekod Contoh Users (5 Rekod)
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password`, `role`) VALUES
(1, 'System Admin', 'admin@eventhub.com', '$2y$10$e8p2u7sU74y/G/KxXjL3S.L.VIn12aD9xM1/DkM1084bC9kE12345', 'admin'),
(2, 'Ahmad Organiser', 'ahmad@events.com', '$2y$10$e8p2u7sU74y/G/KxXjL3S.L.VIn12aD9xM1/DkM1084bC9kE12345', 'organiser'),
(3, 'Siti Event Planner', 'siti@events.com', '$2y$10$e8p2u7sU74y/G/KxXjL3S.L.VIn12aD9xM1/DkM1084bC9kE12345', 'organiser'),
(4, 'Muhammad Ameer', 'ameer@customer.com', '$2y$10$e8p2u7sU74y/G/KxXjL3S.L.VIn12aD9xM1/DkM1084bC9kE12345', 'customer'),
(5, 'Nur Sarah', 'sarah@customer.com', '$2y$10$e8p2u7sU74y/G/KxXjL3S.L.VIn12aD9xM1/DkM1084bC9kE12345', 'customer');

-- 2. Rekod Contoh Venues (5 Rekod)
INSERT INTO `venues` (`venue_id`, `name`, `location`, `capacity`, `city`, `created_by`) VALUES
(1, 'Axiata Arena', 'Bukit Jalil', 10000, 'Kuala Lumpur', 2),
(2, 'Penang International Convention Centre', 'Bayan Lepas', 5000, 'Penang', 2),
(3, 'Shah Alam Stadium Hall', 'Section 13', 3000, 'Shah Alam', 3),
(4, 'Sabah International Convention Centre', 'Kota Kinabalu', 4000, 'Kota Kinabalu', 3),
(5, 'Johor Convention Centre', 'Johor Bahru', 2500, 'Johor Bahru', 2);

-- 3. Rekod Contoh Events (5 Rekod)
INSERT INTO `events` (`event_id`, `title`, `description`, `event_date`, `ticket_price`, `total_tickets`, `available_tickets`, `venue_id`, `organiser_id`) VALUES
(1, 'Tech Conference 2026', 'A gathering of IT professionals and developer talks.', '2026-11-15 09:00:00', 150.00, 500, 497, 1, 2),
(2, 'Indie Music Fest', 'Live outdoor musical performances.', '2026-12-01 17:00:00', 80.00, 1000, 998, 2, 2),
(3, 'Cyber Security Summit', 'Deep dive into cloud security & API defenses.', '2026-11-20 10:00:00', 200.00, 300, 300, 3, 3),
(4, 'E-Sports Championship', 'National level gaming tournament.', '2026-12-10 10:00:00', 50.00, 2000, 2000, 1, 2),
(5, 'AI & Data Analytics Expo', 'Exhibition on AI tools and data intelligence.', '2026-12-18 09:00:00', 120.00, 400, 400, 4, 3);

-- 4. Rekod Contoh Bookings (5 Rekod)
INSERT INTO `bookings` (`booking_id`, `booking_code`, `user_id`, `event_id`, `quantity`, `total_amount`, `status`) VALUES
(1, 'BK-20261001-001', 4, 1, 2, 300.00, 'confirmed'),
(2, 'BK-20261001-002', 5, 2, 2, 160.00, 'confirmed'),
(3, 'BK-20261002-003', 4, 1, 1, 150.00, 'confirmed'),
(4, 'BK-20261003-004', 5, 3, 1, 200.00, 'cancelled'),
(5, 'BK-20261004-005', 4, 4, 4, 200.00, 'confirmed');