
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // AUTHENTICATION
    // ==========================================

    const token = sessionStorage.getItem("token");

    let user = null;

    try {
        user = JSON.parse(
            sessionStorage.getItem("user") || "null"
        );
    } catch {
        user = null;
    }

    const allowedRoles = ["admin", "super_admin"];

    if (!token || !user || !allowedRoles.includes(user.role)) {
        window.location.replace("../index.html");
        return;
    }

    // ==========================================
    // ELEMENTS
    // ==========================================

    const el = {
        sidebarAdminName: document.getElementById("sidebarAdminName"),
        logoutButton: document.getElementById("logoutButton"),
        refreshButton: document.getElementById("refreshButton"),

        totalEvents: document.getElementById("totalEvents"),
        availableTickets: document.getElementById("availableTickets"),
        totalOrganisers: document.getElementById("totalOrganisers"),

        eventCount: document.getElementById("eventCount"),
        searchInput: document.getElementById("searchInput"),
        cityFilter: document.getElementById("cityFilter"),
        errorMessage: document.getElementById("errorMessage"),
        eventsTable: document.getElementById("eventsTable"),

        eventDetailsModal: document.getElementById("eventDetailsModal"),
        eventDetailsTitle: document.getElementById("eventDetailsTitle"),
        modalDescription: document.getElementById("modalDescription"),
        modalOrganiser: document.getElementById("modalOrganiser"),
        modalDate: document.getElementById("modalDate"),
        modalVenue: document.getElementById("modalVenue"),
        modalCity: document.getElementById("modalCity"),
        modalPrice: document.getElementById("modalPrice"),
        modalTickets: document.getElementById("modalTickets")
    };

    let allEvents = [];

    const name = user.full_name || user.name || "Administrator";
    el.sidebarAdminName.textContent = name;

    // ==========================================
    // HELPERS
    // ==========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function formatMoney(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) return "RM —";

        return "RM " + number.toLocaleString("en-MY", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDate(value) {
        if (!value) return "Date unavailable";

        const date = new Date(
            String(value).replace(" ", "T")
        );

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString("en-MY", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function showError(message) {
        el.errorMessage.textContent = message;
        el.errorMessage.hidden = false;
    }

    function hideError() {
        el.errorMessage.textContent = "";
        el.errorMessage.hidden = true;
    }

    function number(value) {
        return Number(value || 0).toLocaleString("en-MY");
    }

    // ==========================================
    // LOAD ALL EVENTS
    // ==========================================

    async function loadEvents() {
        hideError();

        el.refreshButton.disabled = true;
        el.refreshButton.innerHTML = `
            <i class="bi bi-arrow-clockwise"></i>
            Loading...
        `;

        el.eventsTable.innerHTML = `
            <tr>
                <td colspan="7" class="ae-empty">
                    Loading events...
                </td>
            </tr>
        `;

        try {
            const firstPage = await fetchEventsPage(1);

            const events = [...firstPage.events];
            const totalPages = firstPage.totalPages;

            for (let page = 2; page <= totalPages; page++) {
                const result = await fetchEventsPage(page);
                events.push(...result.events);
            }

            allEvents = events;

            updateStats();
            updateCityFilter();
            renderEvents();

        } catch (error) {
            console.error("Admin events error:", error);

            showError(
                error.message || "Unable to load events."
            );

            el.eventsTable.innerHTML = `
                <tr>
                    <td colspan="7" class="ae-empty">
                        Unable to load events.
                    </td>
                </tr>
            `;

        } finally {
            el.refreshButton.disabled = false;
            el.refreshButton.innerHTML = `
                <i class="bi bi-arrow-clockwise"></i>
                Refresh
            `;
        }
    }

    async function fetchEventsPage(page) {
        const response = await fetch(
            `${API_BASE_URL}/events?page=${page}&limit=100`,
            {
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                },
                cache: "no-store"
            }
        );

        if (response.status === 401) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
            window.location.replace("../index.html");
            throw new Error("Your session has expired.");
        }

        if (!response.ok) {
            throw new Error(
                `Unable to load events (HTTP ${response.status}).`
            );
        }

        const payload = await response.json();

        if (payload.status === false) {
            throw new Error("Unable to retrieve events.");
        }

        if (!Array.isArray(payload.data?.events)) {
            throw new Error("Unexpected events API response.");
        }

        return {
            events: payload.data.events,
            totalPages: Math.max(
                1,
                Math.min(
                    100,
                    Number(payload.data.pagination?.total_pages) || 1
                )
            )
        };
    }

    // ==========================================
    // STATS
    // ==========================================

    function updateStats() {
        el.totalEvents.textContent = number(allEvents.length);

        const available = allEvents.reduce(
            (sum, event) =>
                sum + Math.max(
                    0,
                    Number(event.available_tickets) || 0
                ),
            0
        );

        el.availableTickets.textContent = number(available);

        const organisers = new Set(
            allEvents
                .map(event => String(event.organiser_id ?? ""))
                .filter(Boolean)
        );

        el.totalOrganisers.textContent = number(organisers.size);
    }

    // ==========================================
    // CITY FILTER
    // ==========================================

    function updateCityFilter() {
        const previousValue = el.cityFilter.value;

        const cities = [
            ...new Set(
                allEvents
                    .map(event => String(event.city || "").trim())
                    .filter(Boolean)
            )
        ].sort((a, b) => a.localeCompare(b));

        el.cityFilter.innerHTML =
            `<option value="">All Cities</option>`;

        cities.forEach(city => {
            const option = document.createElement("option");
            option.value = city;
            option.textContent = city;
            el.cityFilter.appendChild(option);
        });

        if (cities.includes(previousValue)) {
            el.cityFilter.value = previousValue;
        }
    }

    // ==========================================
    // RENDER EVENTS
    // ==========================================

    function renderEvents() {
        const search = el.searchInput.value
            .trim()
            .toLowerCase();

        const city = el.cityFilter.value;

        const filtered = allEvents.filter(event => {
            const haystack = [
                event.title,
                event.description,
                event.organiser_name,
                event.venue_name,
                event.city
            ].join(" ").toLowerCase();

            const matchesSearch =
                !search || haystack.includes(search);

            const matchesCity =
                !city || String(event.city || "") === city;

            return matchesSearch && matchesCity;
        });

        el.eventCount.textContent =
            `${filtered.length} event${filtered.length === 1 ? "" : "s"}`;

        if (filtered.length === 0) {
            el.eventsTable.innerHTML = `
                <tr>
                    <td colspan="7" class="ae-empty">
                        No events found.
                    </td>
                </tr>
            `;
            return;
        }

        el.eventsTable.innerHTML = filtered.map(event => {
            const available =
                Math.max(0, Number(event.available_tickets) || 0);

            const total =
                Math.max(0, Number(event.total_tickets) || 0);

            const soldOut = available === 0;

            return `
                <tr>
                    <td>
                        <div class="ae-event-name">
                            ${escapeHTML(event.title || "Untitled Event")}
                        </div>

                        <div class="ae-event-id">
                            Event #${escapeHTML(event.event_id)}
                        </div>
                    </td>

                    <td>
                        ${escapeHTML(
                            event.organiser_name || "Unknown Organiser"
                        )}
                    </td>

                    <td>
                        <strong class="ae-venue-name">
                            ${escapeHTML(event.venue_name || "—")}
                        </strong>

                        <small class="ae-city-name">
                            ${escapeHTML(event.city || "—")}
                        </small>
                    </td>

                    <td>${escapeHTML(formatDate(event.event_date))}</td>

                    <td class="ae-price">
                        ${escapeHTML(formatMoney(event.ticket_price))}
                    </td>

                    <td>
                        <span class="ae-availability ${
                            soldOut ? "sold-out" : "available"
                        }">
                            ${escapeHTML(number(available))}
                            /
                            ${escapeHTML(number(total))}
                        </span>
                    </td>

                    <td>
                        <button
                            type="button"
                            class="ae-view-btn"
                            data-event-id="${escapeHTML(event.event_id)}"
                        >
                            <i class="bi bi-eye"></i>
                            View
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // ==========================================
    // EVENT DETAILS MODAL
    // ==========================================

    const detailsModal = new bootstrap.Modal(
        el.eventDetailsModal
    );

    el.eventsTable.addEventListener("click", event => {
        const button = event.target.closest("[data-event-id]");

        if (!button) return;

        const eventId = button.dataset.eventId;

        const selected = allEvents.find(
            item => String(item.event_id) === String(eventId)
        );

        if (!selected) {
            showError("The selected event could not be found.");
            return;
        }

        el.eventDetailsTitle.textContent =
            selected.title || "Event Details";

        el.modalDescription.textContent =
            selected.description || "No description available.";

        el.modalOrganiser.textContent =
            selected.organiser_name || "Unknown Organiser";

        el.modalDate.textContent =
            formatDate(selected.event_date);

        el.modalVenue.textContent =
            selected.venue_name || "Venue unavailable";

        el.modalCity.textContent =
            selected.city || "City unavailable";

        el.modalPrice.textContent =
            formatMoney(selected.ticket_price);

        el.modalTickets.textContent =
            `${number(selected.available_tickets)} / ${number(selected.total_tickets)}`;

        detailsModal.show();
    });

    // ==========================================
    // EVENTS
    // ==========================================

    el.searchInput.addEventListener("input", renderEvents);

    el.cityFilter.addEventListener("change", renderEvents);

    el.refreshButton.addEventListener("click", loadEvents);

    el.logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        window.location.replace("../index.html");
    });

    // ==========================================
    // INITIALISE
    // ==========================================

    loadEvents();

});
