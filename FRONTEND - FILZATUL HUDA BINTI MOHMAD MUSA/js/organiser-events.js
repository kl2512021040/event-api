
document.addEventListener("DOMContentLoaded", () => {
    // =====================================
    // AUTHENTICATION
    // =====================================

    const token = sessionStorage.getItem("token");

    let currentUser = null;

    try {
        currentUser = JSON.parse(
            sessionStorage.getItem("user") || "null"
        );
    } catch {
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

    const userId = currentUser.user_id ?? currentUser.id;

    // =====================================
    // ELEMENTS
    // =====================================

    const el = {
        organiserName: document.getElementById("organiserName"),
        organiserAvatar: document.getElementById("organiserAvatar"),
        currentDate: document.getElementById("currentDate"),
        logoutButton: document.getElementById("logoutButton"),

        totalEvents: document.getElementById("totalEvents"),
        availableTickets: document.getElementById("availableTickets"),
        totalTickets: document.getElementById("totalTickets"),

        eventsTable: document.getElementById("eventsTable"),
        searchEvents: document.getElementById("searchEvents"),
        refreshButton: document.getElementById("refreshButton"),
        pageAlert: document.getElementById("pageAlert"),

        addEventButton: document.getElementById("addEventButton"),
        eventModal: document.getElementById("eventModal"),
        eventModalTitle: document.getElementById("eventModalTitle"),
        eventModalDescription: document.getElementById("eventModalDescription"),
        closeModalButton: document.getElementById("closeModalButton"),
        cancelModalButton: document.getElementById("cancelModalButton"),

        eventForm: document.getElementById("eventForm"),
        eventId: document.getElementById("eventId"),
        eventTitle: document.getElementById("eventTitle"),
        eventDescription: document.getElementById("eventDescription"),
        eventVenue: document.getElementById("eventVenue"),
        venueHint: document.getElementById("venueHint"),
        eventDate: document.getElementById("eventDate"),
        ticketPrice: document.getElementById("ticketPrice"),
        totalTicketCount: document.getElementById("totalTicketCount"),
        saveEventButton: document.getElementById("saveEventButton"),
        formAlert: document.getElementById("formAlert")
    };

    let myEvents = [];
    let venues = [];

    // =====================================
    // PROFILE
    // =====================================

    const displayName =
        currentUser.full_name ||
        currentUser.name ||
        "Organiser";

    el.organiserName.textContent = displayName;
    el.organiserAvatar.textContent =
        displayName.trim().charAt(0).toUpperCase() || "O";

    el.currentDate.textContent =
        new Intl.DateTimeFormat("en-MY", {
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(new Date());

    // =====================================
    // HELPERS
    // =====================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function showAlert(element, message, success = false) {
        element.textContent = message;
        element.className = success
            ? "oe-alert success"
            : "oe-alert";
        element.style.display = "block";
    }

    function hideAlert(element) {
        element.textContent = "";
        element.style.display = "none";
    }

    function showTableMessage(message) {
        el.eventsTable.innerHTML = `
            <tr>
                <td colspan="6" class="org-empty">
                    ${escapeHTML(message)}
                </td>
            </tr>
        `;
    }

    function formatMoney(value) {
        const amount = Number(value);

        return Number.isFinite(amount)
            ? "RM " + amount.toLocaleString("en-MY", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
            : "RM —";
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
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function toDateTimeLocal(value) {
        if (!value) return "";

        // MySQL DATETIME: 2026-12-18 09:00:00
        // HTML datetime-local: 2026-12-18T09:00
        return String(value).replace(" ", "T").slice(0, 16);
    }

    function toMySQLDateTime(value) {
        return value.replace("T", " ") + ":00";
    }

    function describeError(error, action) {
        if (error.status === 403) {
            return "Access denied. You can only manage your own events.";
        }

        if (error.status === 404) {
            return "The requested record or API endpoint was not found.";
        }

        if (error.status === 400 || error.status === 422) {
            return "The server rejected the event details. Check the required fields.";
        }

        if (error.status === 409) {
            return "This event cannot be changed because it conflicts with existing records.";
        }

        if (error.status === 500 && action === "delete") {
            return "Unable to delete this event. Existing bookings may be linked to it.";
        }

        return error.message ||
            `Unable to ${action} the event. Please try again.`;
    }

    // =====================================
    // API
    // =====================================

    async function apiRequest(endpoint, options = {}) {
        const headers = {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        let response;

        try {
            response = await fetch(
                `${API_BASE_URL}${endpoint}`,
                { ...options, headers }
            );
        } catch {
            throw new Error(
                "Unable to connect to the server. Check Apache and MySQL."
            );
        }

        if (response.status === 401) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
            window.location.replace("../index.html");

            throw new Error(
                "Your session has expired. Please sign in again."
            );
        }

        let payload;

        try {
            payload = await response.json();
        } catch {
            throw new Error(
                "The server returned an invalid response."
            );
        }

        if (!response.ok || payload.status === false) {
            const error = new Error(
                "The request could not be completed."
            );

            error.status = response.status;
            throw error;
        }

        return payload;
    }

    // =====================================
    // LOAD ALL EVENT PAGES
    // =====================================

    async function fetchAllEvents() {
        const first = await apiRequest(
            "/events?page=1&limit=100"
        );

        if (!Array.isArray(first.data?.events)) {
            throw new Error(
                "The events API returned an unexpected format."
            );
        }

        const results = [...first.data.events];

        const totalPages = Number(
            first.data.pagination?.total_pages ?? 1
        );

        if (
            !Number.isFinite(totalPages) ||
            totalPages < 1 ||
            totalPages > 100
        ) {
            throw new Error(
                "Event pagination information is invalid or exceeds the supported limit."
            );
        }

        for (let page = 2; page <= totalPages; page++) {
            const payload = await apiRequest(
                `/events?page=${page}&limit=100`
            );

            if (!Array.isArray(payload.data?.events)) {
                throw new Error(
                    "An event page returned an unexpected format."
                );
            }

            results.push(...payload.data.events);
        }

        return results;
    }

    function isMyEvent(event) {
        const ownerId =
            event.organiser_id ??
            event.organizer_id ??
            event.created_by;

        return (
            userId != null &&
            ownerId != null &&
            String(ownerId) === String(userId)
        );
    }

    // =====================================
    // RENDER EVENTS
    // =====================================

    function renderEvents() {
        const query = el.searchEvents.value
            .trim()
            .toLowerCase();

        const filtered = myEvents.filter(event => {
            const text = [
                event.title,
                event.venue_name,
                event.city
            ].join(" ").toLowerCase();

            return text.includes(query);
        });

        if (filtered.length === 0) {
            showTableMessage(
                myEvents.length === 0
                    ? "You have not created any events yet."
                    : "No events match your search."
            );
            return;
        }

        el.eventsTable.innerHTML = filtered.map(event => {
            const available = Number(
                event.available_tickets ?? 0
            );

            const total = Number(
                event.total_tickets ?? 0
            );

            return `
                <tr>
                    <td>
                        <div class="org-event-name">
                            ${escapeHTML(event.title || "Untitled Event")}
                        </div>

                        <div class="oe-event-description">
                            ${escapeHTML(event.description || "No description")}
                        </div>
                    </td>

                    <td>
                        <div class="org-event-name">
                            ${escapeHTML(event.venue_name || "Unknown Venue")}
                        </div>

                        <div class="org-event-subtext">
                            ${escapeHTML(event.city || "—")}
                        </div>
                    </td>

                    <td>
                        ${escapeHTML(formatDate(event.event_date))}
                    </td>

                    <td class="oe-price">
                        ${escapeHTML(formatMoney(event.ticket_price))}
                    </td>

                    <td>
                        <span class="org-ticket-pill">
                            ${escapeHTML(available)} /
                            ${escapeHTML(total)}
                        </span>
                    </td>

                    <td>
                        <div class="oe-actions">
                            <button
                                type="button"
                                class="oe-icon-button"
                                data-action="edit"
                                data-id="${escapeHTML(event.event_id)}"
                                title="Edit event"
                                aria-label="Edit event"
                            >
                                <i class="bi bi-pencil-square"></i>
                            </button>

                            <button
                                type="button"
                                class="oe-icon-button danger"
                                data-action="delete"
                                data-id="${escapeHTML(event.event_id)}"
                                title="Delete event"
                                aria-label="Delete event"
                            >
                                <i class="bi bi-trash3"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function updateStats() {
        const available = myEvents.reduce(
            (sum, event) =>
                sum + (Number(event.available_tickets) || 0),
            0
        );

        const total = myEvents.reduce(
            (sum, event) =>
                sum + (Number(event.total_tickets) || 0),
            0
        );

        el.totalEvents.textContent =
            myEvents.length.toLocaleString("en-MY");

        el.availableTickets.textContent =
            available.toLocaleString("en-MY");

        el.totalTickets.textContent =
            total.toLocaleString("en-MY");
    }

    // =====================================
    // LOAD EVENTS
    // =====================================

    async function loadEvents() {
        hideAlert(el.pageAlert);

        el.refreshButton.disabled = true;
        el.refreshButton.textContent = "Loading...";

        showTableMessage("Loading events...");

        try {
            if (userId == null) {
                throw new Error(
                    "Your account ID is missing. Please sign in again."
                );
            }

            const allEvents = await fetchAllEvents();

            if (
                allEvents.length > 0 &&
                allEvents.every(event =>
                    event.organiser_id == null &&
                    event.organizer_id == null &&
                    event.created_by == null
                )
            ) {
                throw new Error(
                    "The events API does not provide organiser ownership information."
                );
            }

            myEvents = allEvents.filter(isMyEvent);

            updateStats();
            renderEvents();

        } catch (error) {
            console.error("Load events error:", error);

            myEvents = [];

            el.totalEvents.textContent = "—";
            el.availableTickets.textContent = "—";
            el.totalTickets.textContent = "—";

            showTableMessage("Unable to load events.");
            showAlert(
                el.pageAlert,
                describeError(error, "load")
            );
        } finally {
            el.refreshButton.disabled = false;

            el.refreshButton.innerHTML =
                '<i class="bi bi-arrow-clockwise"></i> Refresh';
        }
    }

    // =====================================
    // LOAD VENUES
    // =====================================

    async function loadVenues() {
        const payload = await apiRequest("/venues");

        const venueList = Array.isArray(payload.data)
            ? payload.data
            : payload.data?.venues;

        if (!Array.isArray(venueList)) {
            throw new Error(
                "The venues API returned an unexpected format."
            );
        }

        venues = venueList;

        el.eventVenue.innerHTML = `
            <option value="">Select a venue</option>
            ${venues.map(venue => `
                <option value="${escapeHTML(venue.venue_id)}">
                    ${escapeHTML(venue.name)}
                    — ${escapeHTML(venue.city)}
                </option>
            `).join("")}
        `;
    }

    // =====================================
    // MODAL
    // =====================================

    function openModal() {
        el.eventModal.hidden = false;
        document.body.style.overflow = "hidden";
        el.eventTitle.focus();
    }

    function closeModal() {
        el.eventModal.hidden = true;
        document.body.style.overflow = "";

        el.eventForm.reset();
        el.eventId.value = "";

        hideAlert(el.formAlert);
    }

    async function openAddModal() {
        el.eventForm.reset();
        el.eventId.value = "";

        el.eventModalTitle.textContent = "Add Event";
        el.eventModalDescription.textContent =
            "Complete the details to create a new event.";

        el.eventVenue.disabled = false;
        el.totalTicketCount.disabled = false;

        el.venueHint.textContent =
            "Select a venue for your new event.";

        el.saveEventButton.innerHTML =
            '<i class="bi bi-check-lg"></i> Create Event';

        hideAlert(el.formAlert);
        openModal();

        try {
            await loadVenues();
        } catch (error) {
            showAlert(
                el.formAlert,
                "Unable to load venue options. Please try again."
            );
        }
    }

    async function openEditModal(event) {
        el.eventForm.reset();
        hideAlert(el.formAlert);

        el.eventId.value = event.event_id;
        el.eventTitle.value = event.title || "";
        el.eventDescription.value = event.description || "";
        el.eventDate.value = toDateTimeLocal(event.event_date);
        el.ticketPrice.value = event.ticket_price ?? "";
        el.totalTicketCount.value = event.total_tickets ?? "";

        el.eventModalTitle.textContent = "Edit Event";
        el.eventModalDescription.textContent =
            "Update the event information.";

        el.venueHint.textContent =
            "The venue cannot be changed when editing an event.";

        el.saveEventButton.innerHTML =
            '<i class="bi bi-check-lg"></i> Save Changes';

        openModal();

        try {
            await loadVenues();

            el.eventVenue.value = String(event.venue_id);

            // Backend PUT does not support these fields.
            el.eventVenue.disabled = true;
            el.totalTicketCount.disabled = true;

            if (!el.eventVenue.value) {
                showAlert(
                    el.formAlert,
                    "The event venue is unavailable. Please refresh the page."
                );
            }
        } catch {
            showAlert(
                el.formAlert,
                "Unable to load venue details. Please try again."
            );
        }
    }

    // =====================================
    // CREATE / UPDATE
    // =====================================

    el.eventForm.addEventListener("submit", async e => {
        e.preventDefault();
        hideAlert(el.formAlert);

        const id = el.eventId.value.trim();
        const isEditing = Boolean(id);

        const title = el.eventTitle.value.trim();
        const description = el.eventDescription.value.trim();
        const eventDate = el.eventDate.value;
        const ticketPriceText = el.ticketPrice.value.trim();
        const ticketPrice = Number(ticketPriceText);

        if (!title || !eventDate || ticketPriceText === "") {
            showAlert(
                el.formAlert,
                "Please complete all required event details."
            );
            return;
        }

        if (
            !Number.isFinite(ticketPrice) ||
            ticketPrice < 0
        ) {
            showAlert(
                el.formAlert,
                "Ticket price must be zero or greater."
            );
            return;
        }

        if (Number.isNaN(new Date(eventDate).getTime())) {
            showAlert(
                el.formAlert,
                "Please enter a valid event date and time."
            );
            return;
        }

        const eventData = {
            title,
            description,
            event_date: toMySQLDateTime(eventDate),
            ticket_price: ticketPrice
        };

        if (!isEditing) {
            const venueId = Number(el.eventVenue.value);
            const totalTickets = Number(
                el.totalTicketCount.value
            );

            if (!Number.isInteger(venueId) || venueId < 1) {
                showAlert(
                    el.formAlert,
                    "Please select a venue."
                );
                return;
            }

            if (
                !Number.isInteger(totalTickets) ||
                totalTickets < 1
            ) {
                showAlert(
                    el.formAlert,
                    "Total tickets must be a positive whole number."
                );
                return;
            }

            const selectedVenue = venues.find(
                venue =>
                    Number(venue.venue_id) === venueId
            );

            if (
                selectedVenue &&
                Number.isFinite(Number(selectedVenue.capacity)) &&
                totalTickets > Number(selectedVenue.capacity)
            ) {
                showAlert(
                    el.formAlert,
                    "Total tickets cannot exceed the selected venue capacity."
                );
                return;
            }

            eventData.venue_id = venueId;
            eventData.total_tickets = totalTickets;
        }

        el.saveEventButton.disabled = true;
        el.saveEventButton.textContent = "Saving...";

        try {
            if (isEditing) {
                await apiRequest(
                    `/events/${encodeURIComponent(id)}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(eventData)
                    }
                );
            } else {
                await apiRequest("/events", {
                    method: "POST",
                    body: JSON.stringify(eventData)
                });
            }

            closeModal();

            await loadEvents();

            showAlert(
                el.pageAlert,
                isEditing
                    ? "Event updated successfully."
                    : "Event created successfully.",
                true
            );

        } catch (error) {
            console.error("Save event error:", error);

            showAlert(
                el.formAlert,
                describeError(
                    error,
                    isEditing ? "update" : "create"
                )
            );
        } finally {
            el.saveEventButton.disabled = false;

            el.saveEventButton.innerHTML = isEditing
                ? '<i class="bi bi-check-lg"></i> Save Changes'
                : '<i class="bi bi-check-lg"></i> Create Event';
        }
    });

    // =====================================
    // EDIT / DELETE BUTTONS
    // =====================================

    el.eventsTable.addEventListener("click", async e => {
        const button = e.target.closest(
            "button[data-action]"
        );

        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;

        const event = myEvents.find(
            item => String(item.event_id) === String(id)
        );

        if (!event) {
            showAlert(
                el.pageAlert,
                "The selected event was not found. Refresh and try again."
            );
            return;
        }

        if (action === "edit") {
            await openEditModal(event);
            return;
        }

        if (action === "delete") {
            const confirmed = window.confirm(
                `Delete "${event.title}"?\n\n` +
                "This action cannot be undone."
            );

            if (!confirmed) return;

            button.disabled = true;

            try {
                await apiRequest(
                    `/events/${encodeURIComponent(id)}`,
                    { method: "DELETE" }
                );

                await loadEvents();

                showAlert(
                    el.pageAlert,
                    "Event deleted successfully.",
                    true
                );

            } catch (error) {
                console.error("Delete event error:", error);

                showAlert(
                    el.pageAlert,
                    describeError(error, "delete")
                );
            } finally {
                button.disabled = false;
            }
        }
    });

    // =====================================
    // BUTTON EVENTS
    // =====================================

    el.addEventButton.addEventListener(
        "click",
        openAddModal
    );

    el.closeModalButton.addEventListener(
        "click",
        closeModal
    );

    el.cancelModalButton.addEventListener(
        "click",
        closeModal
    );

    el.eventModal.addEventListener("click", e => {
        if (e.target === el.eventModal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && !el.eventModal.hidden) {
            closeModal();
        }
    });

    el.searchEvents.addEventListener(
        "input",
        renderEvents
    );

    el.refreshButton.addEventListener(
        "click",
        loadEvents
    );

    el.logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        window.location.replace("../index.html");
    });

    // Initial load
    loadEvents();
});
