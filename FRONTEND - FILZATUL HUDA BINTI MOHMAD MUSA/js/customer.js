
document.addEventListener("DOMContentLoaded", () => {
    // =========================================
    // 1. CUSTOMER AUTHENTICATION
    // =========================================

    const token = sessionStorage.getItem("token");
    let user = null;

    try {
        user = JSON.parse(sessionStorage.getItem("user") || "null");
    } catch {
        user = null;
    }

    if (!token || !user || user.role !== "customer") {
        window.location.replace("../index.html");
        return;
    }

    // =========================================
    // 2. ELEMENTS & STATE
    // =========================================

    const el = {
        customerName: document.getElementById("customerName"),
        logoutButton: document.getElementById("logoutButton"),
        eventSearch: document.getElementById("eventSearch"),
        cityFilter: document.getElementById("cityFilter"),
        refreshButton: document.getElementById("refreshButton"),
        eventCount: document.getElementById("eventCount"),
        eventGrid: document.getElementById("eventGrid"),
        pageAlert: document.getElementById("pageAlert"),

        eventModal: document.getElementById("eventModal"),
        closeModalButton: document.getElementById("closeModalButton"),
        modalTitle: document.getElementById("modalTitle"),
        modalDescription: document.getElementById("modalDescription"),
        modalDate: document.getElementById("modalDate"),
        modalVenue: document.getElementById("modalVenue"),
        modalTickets: document.getElementById("modalTickets"),
        modalPrice: document.getElementById("modalPrice"),
        modalBookButton: document.getElementById("modalBookButton")
    };

    let allEvents = [];
    let activeEventId = null;

    const displayName = user.full_name || user.name || "Customer";
    const firstName = displayName.trim().split(/\s+/)[0];

    el.customerName.textContent = `Welcome, ${firstName}`;

    // =========================================
    // 3. HELPERS
    // =========================================

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

    function parseEventDate(value) {
        if (!value) return null;

        // MySQL DATETIME uses a space instead of T.
        const date = new Date(String(value).replace(" ", "T"));

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatEventDate(value) {
        const date = parseEventDate(value);

        if (!date) return "Date unavailable";

        return date.toLocaleString("en-MY", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getDateParts(value) {
        const date = parseEventDate(value);

        if (!date) {
            return { day: "—", month: "TBA" };
        }

        return {
            day: String(date.getDate()).padStart(2, "0"),
            month: date.toLocaleDateString("en-MY", {
                month: "short"
            }).toUpperCase()
        };
    }

    function showError(message) {
        el.pageAlert.textContent = message;
        el.pageAlert.hidden = false;
    }

    function hideError() {
        el.pageAlert.hidden = true;
        el.pageAlert.textContent = "";
    }

    function showGridMessage(message) {
        el.eventGrid.innerHTML = `
            <div class="cd-empty">
                ${escapeHTML(message)}
            </div>
        `;
    }

    function bookingLink(eventId) {
        return `bookings.html?event_id=${encodeURIComponent(eventId)}`;
    }

    // =========================================
    // 4. FETCH EVENTS FROM PHP REST API
    // =========================================

    async function fetchPage(page) {
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
            throw new Error("Unable to load events from the server.");
        }

        const payload = await response.json();

        if (payload.status === false) {
            throw new Error("The server could not retrieve events.");
        }

        if (!Array.isArray(payload.data?.events)) {
            throw new Error("The events API returned an unexpected format.");
        }

        return payload;
    }

    async function fetchAllEvents() {
        const first = await fetchPage(1);

        const events = [...first.data.events];
        const totalPages = Number(
            first.data.pagination?.total_pages ?? 1
        );

        if (
            !Number.isInteger(totalPages) ||
            totalPages < 1 ||
            totalPages > 100
        ) {
            throw new Error(
                "Event pagination is invalid or exceeds the supported limit."
            );
        }

        for (let page = 2; page <= totalPages; page++) {
            const result = await fetchPage(page);
            events.push(...result.data.events);
        }

        return events;
    }

    // =========================================
    // 5. CITY FILTER
    // =========================================

    function renderCityOptions() {
        const previousSelection = el.cityFilter.value;

        const cities = [...new Set(
            allEvents
                .map(event => String(event.city || "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        el.cityFilter.innerHTML =
            '<option value="">All Cities</option>';

        cities.forEach(city => {
            const option = document.createElement("option");
            option.value = city;
            option.textContent = city;
            el.cityFilter.appendChild(option);
        });

        if (cities.includes(previousSelection)) {
            el.cityFilter.value = previousSelection;
        }
    }

    // =========================================
    // 6. EVENT CARDS
    // =========================================

    function renderEvents() {
        const search = el.eventSearch.value.trim().toLowerCase();
        const selectedCity = el.cityFilter.value;

        const filtered = allEvents.filter(event => {
            const searchableText = [
                event.title,
                event.description,
                event.venue_name,
                event.city
            ].join(" ").toLowerCase();

            const matchesSearch = searchableText.includes(search);
            const matchesCity =
                !selectedCity || event.city === selectedCity;

            return matchesSearch && matchesCity;
        });

        el.eventCount.textContent =
            filtered.length.toLocaleString("en-MY");

        if (filtered.length === 0) {
            showGridMessage(
                allEvents.length === 0
                    ? "No events are available right now."
                    : "No events match your search. Try another keyword or city."
            );
            return;
        }

        el.eventGrid.innerHTML = filtered.map((event, index) => {
            const date = getDateParts(event.event_date);
            const available = Math.max(
                0,
                Number(event.available_tickets) || 0
            );

            const soldOut = available === 0;

            const venue = event.venue_name || "Venue to be announced";
            const city = event.city || "Location to be announced";

            const eventId = Number(event.event_id);

            return `
                <article class="cd-event-card">

                    <div class="cd-card-cover tone-${(index % 5) + 1}">
                        <span class="cd-cover-category">
                            LIVE EXPERIENCE
                        </span>

                        <i class="bi bi-stars cd-cover-icon"></i>

                        <div class="cd-cover-date">
                            <strong>${escapeHTML(date.day)}</strong>
                            <span>${escapeHTML(date.month)}</span>
                        </div>
                    </div>

                    <div class="cd-card-body">

                        <div class="cd-card-location">
                            <i class="bi bi-geo-alt"></i>
                            ${escapeHTML(city)}
                        </div>

                        <h3 class="cd-card-title">
                            ${escapeHTML(event.title || "Untitled Event")}
                        </h3>

                        <p class="cd-card-description">
                            ${escapeHTML(
                                event.description || "Explore this upcoming event."
                            )}
                        </p>

                        <div class="cd-card-meta">
                            <i class="bi bi-building"></i>
                            ${escapeHTML(venue)}
                            <span>·</span>
                            <i class="bi bi-ticket-perforated"></i>
                            ${available.toLocaleString("en-MY")} left
                        </div>

                        <div class="cd-card-footer">

                            <div class="cd-card-price">
                                <small>FROM</small>
                                <strong>
                                    ${escapeHTML(formatMoney(event.ticket_price))}
                                </strong>
                            </div>

                            <div class="cd-card-actions">

                                <button
                                    type="button"
                                    class="cd-card-details"
                                    data-action="details"
                                    data-id="${eventId}"
                                >
                                    Details
                                </button>

                                ${
                                    soldOut
                                        ? `<span class="cd-card-book disabled">
                                               Sold Out
                                           </span>`
                                        : `<a
                                               class="cd-card-book"
                                               href="${bookingLink(eventId)}"
                                           >
                                               Book
                                           </a>`
                                }
                            </div>

                        </div>
                    </div>
                </article>
            `;
        }).join("");
    }

    // =========================================
    // 7. EVENT DETAILS MODAL
    // =========================================

    function openEventDetails(eventId) {
        const event = allEvents.find(
            item => String(item.event_id) === String(eventId)
        );

        if (!event) {
            showError("The selected event could not be found.");
            return;
        }

        activeEventId = event.event_id;

        const available = Math.max(
            0,
            Number(event.available_tickets) || 0
        );

        el.modalTitle.textContent =
            event.title || "Untitled Event";

        el.modalDescription.textContent =
            event.description || "No description available.";

        el.modalDate.textContent =
            formatEventDate(event.event_date);

        el.modalVenue.textContent = [
            event.venue_name,
            event.city
        ].filter(Boolean).join(", ") || "Venue unavailable";

        el.modalTickets.textContent =
            `${available.toLocaleString("en-MY")} tickets remaining`;

        el.modalPrice.textContent =
            formatMoney(event.ticket_price);

        el.modalBookButton.href = bookingLink(activeEventId);

        if (available === 0) {
            el.modalBookButton.textContent = "Sold Out";
            el.modalBookButton.removeAttribute("href");
            el.modalBookButton.style.pointerEvents = "none";
            el.modalBookButton.style.opacity = "0.6";
        } else {
            el.modalBookButton.innerHTML = `
                Book Tickets
                <i class="bi bi-arrow-right"></i>
            `;

            el.modalBookButton.style.pointerEvents = "";
            el.modalBookButton.style.opacity = "";
        }

        el.eventModal.hidden = false;
        document.body.style.overflow = "hidden";
        el.closeModalButton.focus();
    }

    function closeEventDetails() {
        el.eventModal.hidden = true;
        document.body.style.overflow = "";
        activeEventId = null;
    }

    // =========================================
    // 8. INITIAL LOAD & REFRESH
    // =========================================

    async function loadEvents() {
        hideError();

        el.refreshButton.disabled = true;
        el.refreshButton.textContent = "Loading...";

        el.eventGrid.innerHTML = `
            <div class="cd-loading">
                <div class="cd-spinner"></div>
                <p>Finding amazing events for you...</p>
            </div>
        `;

        try {
            allEvents = await fetchAllEvents();
            renderCityOptions();
            renderEvents();
        } catch (error) {
            console.error("Customer events error:", error);

            allEvents = [];
            el.eventCount.textContent = "—";

            showGridMessage("Unable to load events.");
            showError(
                error.message ||
                "Something went wrong. Please try again."
            );
        } finally {
            el.refreshButton.disabled = false;

            el.refreshButton.innerHTML = `
                <i class="bi bi-arrow-clockwise"></i>
                Refresh
            `;
        }
    }

    // =========================================
    // 9. EVENT LISTENERS
    // =========================================

    el.eventSearch.addEventListener("input", renderEvents);

    el.cityFilter.addEventListener("change", renderEvents);

    el.refreshButton.addEventListener("click", loadEvents);

    el.eventGrid.addEventListener("click", event => {
        const button = event.target.closest(
            'button[data-action="details"]'
        );

        if (!button) return;

        openEventDetails(button.dataset.id);
    });

    el.closeModalButton.addEventListener(
        "click",
        closeEventDetails
    );

    el.eventModal.addEventListener("click", event => {
        if (event.target === el.eventModal) {
            closeEventDetails();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !el.eventModal.hidden) {
            closeEventDetails();
        }
    });

    el.logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        window.location.replace("../index.html");
    });

    loadEvents();
});
