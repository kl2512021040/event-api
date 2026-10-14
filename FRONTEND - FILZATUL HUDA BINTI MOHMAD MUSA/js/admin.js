
document.addEventListener("DOMContentLoaded", () => {
    // =========================================
    // 1. AUTHENTICATION AND ROLE GUARD
    // =========================================

    const token = sessionStorage.getItem("token");
    let user = null;

    try {
        user = JSON.parse(sessionStorage.getItem("user"));
    } catch (error) {
        user = null;
    }

    if (!token || !user) {
        window.location.replace("../index.html");
        return;
    }

    if (!["admin", "super_admin"].includes(user.role)) {
        window.location.replace("../index.html");
        return;
    }

    // =========================================
    // 2. INITIALISE USER DETAILS
    // =========================================

    const adminName = document.getElementById("adminName");
    const adminRole = document.getElementById("adminRole");
    const adminAvatar = document.getElementById("adminAvatar");
    const welcomeHeading = document.getElementById("welcomeHeading");
    const currentDate = document.getElementById("currentDate");

    const displayName = user.full_name || "Administrator";

    adminName.textContent = displayName;
    adminRole.textContent =
        user.role === "super_admin"
            ? "Super Administrator"
            : "System Administrator";

    adminAvatar.textContent = displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");

    welcomeHeading.textContent = `Welcome back, ${displayName.split(/\s+/)[0]}.`;

    currentDate.textContent = new Date().toLocaleDateString("en-MY", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    // =========================================
    // 3. API REQUEST HELPER
    // =========================================

    async function apiGet(endpoint) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${sessionStorage.getItem("token")}`
            }
        });

        let result;

        try {
            result = await response.json();
        } catch (error) {
            throw new Error("The server returned an invalid response.");
        }

        if (response.status === 401) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");

            window.location.replace("../index.html");

            throw new Error("Your session has expired. Please sign in again.");
        }

        if (response.status === 403) {
            throw new Error(
                "Access denied. Administrator permission is required."
            );
        }

        if (!response.ok || !result.status) {
            throw new Error("Unable to retrieve the requested information.");
        }

        return result.data;
    }

    // Allow individual sections to fail without breaking the
    // entire dashboard if one API endpoint is unavailable.
    async function loadResource(endpoint) {
        try {
            return {
                ok: true,
                data: await apiGet(endpoint)
            };
        } catch (error) {
            console.error(`Dashboard request failed: ${endpoint}`, error);

            return {
                ok: false,
                data: null
            };
        }
    }

    // =========================================
    // 4. REUSABLE DISPLAY HELPERS
    // =========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    function formatDate(value) {
        if (!value) return "Date unavailable";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleDateString("en-MY", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function formatMoney(value) {
        const amount = Number(value);

        if (!Number.isFinite(amount)) return "RM 0.00";

        return "RM " + amount.toLocaleString("en-MY", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function showDashboardAlert(message) {
        const alertBox = document.getElementById("dashboardAlert");

        alertBox.textContent = message;
        alertBox.className = "dashboard-message info";
    }

    function clearDashboardAlert() {
        const alertBox = document.getElementById("dashboardAlert");

        alertBox.textContent = "";
        alertBox.className = "dashboard-message info d-none";
    }

    function showTableMessage(tableId, columnCount, message) {
        document.getElementById(tableId).innerHTML = `
            <tr>
                <td colspan="${columnCount}" class="dashboard-loading">
                    ${escapeHTML(message)}
                </td>
            </tr>
        `;
    }

    // =========================================
    // 5. RENDER EVENT TABLE
    // =========================================

    function renderEvents(events) {
        const table = document.getElementById("eventsTable");

        if (!events.length) {
            showTableMessage(
                "eventsTable",
                4,
                "No events are currently available."
            );
            return;
        }

        table.innerHTML = events.map(event => {
            const available = Number(event.available_tickets ?? 0);
            const total = Number(event.total_tickets ?? 0);

            return `
                <tr>
                    <td>
                        <div class="table-primary-text">
                            ${escapeHTML(event.title || "Untitled event")}
                        </div>
                        <div class="table-secondary-text">
                            Event #${escapeHTML(event.event_id ?? "—")}
                        </div>
                    </td>

                    <td>
                        <div class="table-primary-text">
                            ${escapeHTML(event.venue_name || "Venue unavailable")}
                        </div>
                        <div class="table-secondary-text">
                            ${escapeHTML(event.city || "City unavailable")}
                        </div>
                    </td>

                    <td>${escapeHTML(formatDate(event.event_date))}</td>

                    <td>
                        <span class="status-pill ${
                            available > 0 ? "status-confirmed" : "status-cancelled"
                        }">
                            ${escapeHTML(available)} / ${escapeHTML(total)}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // =========================================
    // 6. RENDER RECENT BOOKINGS
    // =========================================

    function renderBookings(bookings) {
        const table = document.getElementById("bookingsTable");

        if (!bookings.length) {
            showTableMessage(
                "bookingsTable",
                4,
                "No booking records are currently available."
            );
            return;
        }

        // The API returns the newest bookings first.
        const recentBookings = bookings.slice(0, 5);

        table.innerHTML = recentBookings.map(booking => {
            const status = String(booking.status || "unknown").toLowerCase();

            let statusClass = "status-neutral";

            if (status === "confirmed") {
                statusClass = "status-confirmed";
            } else if (status === "cancelled") {
                statusClass = "status-cancelled";
            }

            return `
                <tr>
                    <td>
                        <div class="table-primary-text">
                            ${escapeHTML(booking.booking_code || "Booking")}
                        </div>
                        <div class="table-secondary-text">
                            #${escapeHTML(booking.booking_id ?? "—")}
                        </div>
                    </td>

                    <td>
                        <div class="table-primary-text">
                            ${escapeHTML(booking.customer_name || "Customer")}
                        </div>
                        <div class="table-secondary-text">
                            ${escapeHTML(booking.event_title || "Event unavailable")}
                        </div>
                        <div class="table-secondary-text">
                            ${escapeHTML(booking.quantity ?? 0)} ticket(s)
                        </div>
                    </td>

                    <td>${escapeHTML(formatMoney(booking.total_amount))}</td>

                    <td>
                        <span class="status-pill ${statusClass}">
                            ${escapeHTML(status)}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // =========================================
    // 7. LOAD DASHBOARD DATA
    // =========================================

    async function loadDashboard() {
        const refreshButton = document.getElementById("refreshButton");

        refreshButton.disabled = true;
        refreshButton.style.opacity = "0.65";

        clearDashboardAlert();

        showTableMessage("eventsTable", 4, "Loading events...");
        showTableMessage("bookingsTable", 4, "Loading bookings...");

        const [
            usersResult,
            venuesResult,
            eventsResult,
            bookingsResult
        ] = await Promise.all([
            loadResource("/users"),
            loadResource("/venues"),
            loadResource("/events?page=1&limit=5&sort=desc"),
            loadResource("/bookings")
        ]);

        // Users
        if (usersResult.ok && Array.isArray(usersResult.data)) {
            document.getElementById("statUsers").textContent =
                usersResult.data.length.toLocaleString("en-MY");
        } else {
            document.getElementById("statUsers").textContent = "—";
        }

        // Venues
        if (venuesResult.ok && Array.isArray(venuesResult.data)) {
            document.getElementById("statVenues").textContent =
                venuesResult.data.length.toLocaleString("en-MY");
        } else {
            document.getElementById("statVenues").textContent = "—";
        }

        // Events endpoint returns { events: [...], pagination: {...} }
        let events = [];

        if (eventsResult.ok) {
            if (Array.isArray(eventsResult.data?.events)) {
                events = eventsResult.data.events;
            } else if (Array.isArray(eventsResult.data)) {
                events = eventsResult.data;
            }

            const pagination = eventsResult.data?.pagination;

            // Use the API's total record count when available.
            const eventCount = pagination
                ? Number(pagination.total_records)
                : events.length;

            document.getElementById("statEvents").textContent =
                eventCount.toLocaleString("en-MY");

            renderEvents(events);
        } else {
            document.getElementById("statEvents").textContent = "—";

            showTableMessage(
                "eventsTable",
                4,
                "Unable to load events. Please refresh the dashboard."
            );
        }

        // Bookings
        if (bookingsResult.ok && Array.isArray(bookingsResult.data)) {
            const bookings = bookingsResult.data;

            const confirmedBookings = bookings.filter(
                booking =>
                    String(booking.status || "").toLowerCase() === "confirmed"
            );

            const confirmedRevenue = confirmedBookings.reduce(
                (sum, booking) => sum + (Number(booking.total_amount) || 0),
                0
            );

            document.getElementById("statBookings").textContent =
                confirmedBookings.length.toLocaleString("en-MY");

            document.getElementById("statRevenue").textContent =
                formatMoney(confirmedRevenue);

            renderBookings(bookings);
        } else {
            document.getElementById("statBookings").textContent = "—";
            document.getElementById("statRevenue").textContent = "RM —";

            showTableMessage(
                "bookingsTable",
                4,
                "Unable to load bookings. Please refresh the dashboard."
            );
        }

        // Inform the administrator if one or more API requests failed.
        const hasErrors = [
            usersResult,
            venuesResult,
            eventsResult,
            bookingsResult
        ].some(result => !result.ok);

        if (hasErrors) {
            showDashboardAlert(
                "Some dashboard information could not be loaded. " +
                "Check your connection and administrator permissions, " +
                "then refresh the dashboard."
            );
        }

        refreshButton.disabled = false;
        refreshButton.style.opacity = "1";
    }

    // =========================================
    // 8. BUTTON ACTIONS
    // =========================================

    document.getElementById("refreshButton").addEventListener(
        "click",
        loadDashboard
    );

    document.getElementById("logoutButton").addEventListener(
        "click",
        () => {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");

            window.location.replace("../index.html");
        }
    );

    // Start the dashboard.
    loadDashboard();
});
