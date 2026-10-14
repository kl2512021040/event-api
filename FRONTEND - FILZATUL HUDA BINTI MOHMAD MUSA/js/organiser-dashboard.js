
document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // 1. AUTHENTICATION
    // ========================================

    const token = sessionStorage.getItem("token");

    let currentUser = null;

    try {
        currentUser = JSON.parse(
            sessionStorage.getItem("user") || "null"
        );
    } catch (error) {
        currentUser = null;
    }

    if (
        !token ||
        !currentUser ||
        currentUser.role !== "organiser"
    ) {
        window.location.replace("../index.html");
        return;
    }

    // ========================================
    // 2. ELEMENTS
    // ========================================

    const el = {
        organiserName: document.getElementById("organiserName"),
        organiserAvatar: document.getElementById("organiserAvatar"),
        welcomeHeading: document.getElementById("welcomeHeading"),
        currentDate: document.getElementById("currentDate"),

        totalEvents: document.getElementById("totalEvents"),
        availableTickets: document.getElementById("availableTickets"),
        ticketCapacity: document.getElementById("ticketCapacity"),

        eventsTable: document.getElementById("eventsTable"),
        dashboardMessage: document.getElementById("dashboardMessage"),

        refreshButton: document.getElementById("refreshButton"),
        logoutButton: document.getElementById("logoutButton")
    };

    // ========================================
    // 3. USER DETAILS
    // ========================================

    const displayName =
        currentUser.full_name ||
        currentUser.name ||
        "Organiser";

    el.organiserName.textContent = displayName;

    el.organiserAvatar.textContent =
        displayName.trim().charAt(0).toUpperCase() || "O";

    el.welcomeHeading.textContent =
        `Welcome back, ${displayName.split(/\s+/)[0]}.`;

    el.currentDate.textContent = new Date().toLocaleDateString(
        "en-MY",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

    // ========================================
    // 4. HELPERS
    // ========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
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

        if (!Number.isFinite(amount)) {
            return "RM —";
        }

        return "RM " + amount.toLocaleString("en-MY", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function showMessage(message) {
        el.dashboardMessage.textContent = message;
        el.dashboardMessage.style.display = "block";
    }

    function hideMessage() {
        el.dashboardMessage.textContent = "";
        el.dashboardMessage.style.display = "none";
    }

    function showTableMessage(message) {
        el.eventsTable.innerHTML = `
            <tr>
                <td colspan="5" class="org-empty">
                    ${escapeHTML(message)}
                </td>
            </tr>
        `;
    }

    function getEvents(payload) {
        if (Array.isArray(payload?.data?.events)) {
            return payload.data.events;
        }

        if (Array.isArray(payload?.data)) {
            return payload.data;
        }

        return null;
    }

    function getEventOwnerId(event) {
        return (
            event.organiser_id ??
            event.organizer_id ??
            event.created_by ??
            null
        );
    }

    function getCurrentUserId() {
        return (
            currentUser.user_id ??
            currentUser.id ??
            null
        );
    }

    // ========================================
    // 5. FETCH ALL EVENT PAGES
    // ========================================

    async function fetchEventPage(page) {
        const response = await fetch(
            `${API_BASE_URL}/events?page=${page}&limit=100`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (response.status === 401) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");

            window.location.replace("../index.html");

            throw new Error(
                "Your session has expired. Please sign in again."
            );
        }

        if (response.status === 403) {
            throw new Error(
                "Access denied. You do not have permission to view these events."
            );
        }

        if (!response.ok) {
            throw new Error(
                "Unable to load events from the server."
            );
        }

        const payload = await response.json();

        if (payload.status === false) {
            throw new Error(
                "The server could not retrieve event information."
            );
        }

        return payload;
    }

    async function fetchAllEvents() {
        const firstPayload = await fetchEventPage(1);
        const firstEvents = getEvents(firstPayload);

        if (!firstEvents) {
            throw new Error(
                "The event response format is not supported."
            );
        }

        const pagination = firstPayload.data?.pagination;

        const totalPages = Number(
            pagination?.total_pages ?? 1
        );

        const allEvents = [...firstEvents];

        if (
            !Number.isFinite(totalPages) ||
            totalPages < 1
        ) {
            return allEvents;
        }

        // Safety limit prevents an accidental endless request loop.
        for (
            let page = 2;
            page <= Math.min(totalPages, 100);
            page++
        ) {
            const payload = await fetchEventPage(page);
            const pageEvents = getEvents(payload);

            if (!pageEvents) {
                throw new Error(
                    "An event page returned an unsupported format."
                );
            }

            allEvents.push(...pageEvents);
        }

        return allEvents;
    }

    // ========================================
    // 6. RENDER EVENTS
    // ========================================

    function renderEvents(events) {
        if (events.length === 0) {
            showTableMessage(
                "No events are linked to your organiser account."
            );
            return;
        }

        el.eventsTable.innerHTML = events.map(event => {
            const available = Number(
                event.available_tickets ?? 0
            );

            const total = Number(
                event.total_tickets ?? 0
            );

            const venue =
                event.venue_name ||
                "Venue unavailable";

            const city =
                event.city ||
                "City unavailable";

            return `
                <tr>
                    <td>
                        <div class="org-event-name">
                            ${escapeHTML(event.title || "Untitled event")}
                        </div>

                        <div class="org-event-subtext">
                            Event #${escapeHTML(event.event_id ?? "—")}
                        </div>
                    </td>

                    <td>
                        <div class="org-event-name">
                            ${escapeHTML(venue)}
                        </div>

                        <div class="org-event-subtext">
                            ${escapeHTML(city)}
                        </div>
                    </td>

                    <td>
                        ${escapeHTML(formatDate(event.event_date))}
                    </td>

                    <td>
                        ${escapeHTML(formatMoney(event.ticket_price))}
                    </td>

                    <td>
                        <span class="org-ticket-pill">
                            ${escapeHTML(available)} /
                            ${escapeHTML(total)}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // ========================================
    // 7. LOAD DASHBOARD
    // ========================================

    async function loadDashboard() {
        hideMessage();

        el.refreshButton.disabled = true;
        el.refreshButton.textContent = "Loading...";

        showTableMessage("Loading events...");

        try {
            const allEvents = await fetchAllEvents();

            const userId = getCurrentUserId();

            if (userId === null) {
                throw new Error(
                    "Your organiser account ID is missing. Please sign in again."
                );
            }

            /*
             * Only show events whose ownership can be verified.
             * Never treat all public events as this organiser's events.
             */
            const myEvents = allEvents.filter(event => {
                const ownerId = getEventOwnerId(event);

                return (
                    ownerId !== null &&
                    String(ownerId) === String(userId)
                );
            });

            const availableTickets = myEvents.reduce(
                (sum, event) =>
                    sum + (Number(event.available_tickets) || 0),
                0
            );

            const ticketCapacity = myEvents.reduce(
                (sum, event) =>
                    sum + (Number(event.total_tickets) || 0),
                0
            );

            el.totalEvents.textContent =
                myEvents.length.toLocaleString("en-MY");

            el.availableTickets.textContent =
                availableTickets.toLocaleString("en-MY");

            el.ticketCapacity.textContent =
                ticketCapacity.toLocaleString("en-MY");

            renderEvents(myEvents);

            if (
                allEvents.length > 0 &&
                allEvents.every(
                    event => getEventOwnerId(event) === null
                )
            ) {
                el.totalEvents.textContent = "—";
                el.availableTickets.textContent = "—";
                el.ticketCapacity.textContent = "—";

                showTableMessage(
                    "Event ownership information is unavailable."
                );

                showMessage(
                    "The events API does not expose an organiser ID. " +
                    "The dashboard cannot safely identify your events. " +
                    "Check the API response before continuing."
                );
            }

        } catch (error) {
            console.error("Organiser dashboard error:", error);

            el.totalEvents.textContent = "—";
            el.availableTickets.textContent = "—";
            el.ticketCapacity.textContent = "—";

            showTableMessage("Unable to load events.");
            showMessage(
                error.message ||
                "Unable to load dashboard information."
            );
        } finally {
            el.refreshButton.disabled = false;

            el.refreshButton.innerHTML =
                '<i class="bi bi-arrow-clockwise"></i> Refresh';
        }
    }

    // ========================================
    // 8. BUTTON ACTIONS
    // ========================================

    el.refreshButton.addEventListener(
        "click",
        loadDashboard
    );

    el.logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        window.location.replace("../index.html");
    });

    loadDashboard();
});
