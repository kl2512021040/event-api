
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. AUTHENTICATION
    // ==========================================

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

    // ==========================================
    // 2. ELEMENTS
    // ==========================================

    const el = {
        customerName: document.getElementById("customerName"),
        logoutButton: document.getElementById("logoutButton"),
        bookingAlert: document.getElementById("bookingAlert"),

        bookingSection: document.getElementById("bookingSection"),
        selectedEventTitle: document.getElementById("selectedEventTitle"),
        selectedEventDescription: document.getElementById("selectedEventDescription"),
        selectedEventDate: document.getElementById("selectedEventDate"),
        selectedEventVenue: document.getElementById("selectedEventVenue"),
        selectedEventAvailable: document.getElementById("selectedEventAvailable"),

        decreaseQuantity: document.getElementById("decreaseQuantity"),
        increaseQuantity: document.getElementById("increaseQuantity"),
        quantityValue: document.getElementById("quantityValue"),
        unitPrice: document.getElementById("unitPrice"),
        summaryQuantity: document.getElementById("summaryQuantity"),
        totalPrice: document.getElementById("totalPrice"),
        confirmBookingButton: document.getElementById("confirmBookingButton"),

        bookingSuccess: document.getElementById("bookingSuccess"),
        successBookingCode: document.getElementById("successBookingCode"),
        successTotalAmount: document.getElementById("successTotalAmount"),
        viewBookingsButton: document.getElementById("viewBookingsButton"),

        historySection: document.getElementById("historySection"),
        bookingsGrid: document.getElementById("bookingsGrid"),
        refreshBookingsButton: document.getElementById("refreshBookingsButton")
    };

    const params = new URLSearchParams(window.location.search);
    const selectedEventId = params.get("event_id");

    let selectedEvent = null;
    let quantity = 1;
    let submitting = false;

    const name = user.full_name || user.name || "Customer";

    el.customerName.textContent =
        `Welcome, ${name.trim().split(/\s+/)[0]}`;

    // ==========================================
    // 3. HELPERS
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

    function money(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "RM —";
        }

        return "RM " + number.toLocaleString("en-MY", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDate(value) {
        if (!value) return "Date unavailable";

        const date = new Date(String(value).replace(" ", "T"));

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString("en-MY", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function showAlert(message, type = "error") {
        el.bookingAlert.textContent = message;
        el.bookingAlert.hidden = false;

        el.bookingAlert.style.background =
            type === "success" ? "#e8f2e8" : "#fae9e3";

        el.bookingAlert.style.color =
            type === "success" ? "#386f45" : "#914b35";

        el.bookingAlert.style.borderColor =
            type === "success" ? "#b7d5bd" : "#e7b9aa";

        el.bookingAlert.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    function hideAlert() {
        el.bookingAlert.hidden = true;
        el.bookingAlert.textContent = "";
    }

    async function apiRequest(path, options = {}) {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options.headers || {})
            },
            cache: "no-store"
        });

        if (response.status === 401) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
            window.location.replace("../index.html");
            throw new Error("Your session has expired.");
        }

        let payload;

        try {
            payload = await response.json();
        } catch {
            throw new Error("The server returned an invalid response.");
        }

        if (!response.ok || payload.status === false) {
            // Keep the interface in English.
            const messages = {
                400: "The request could not be completed. Check your ticket quantity and availability.",
                403: "You do not have permission to perform this action.",
                404: "The requested event or booking could not be found.",
                405: "This action is not supported by the server.",
                500: "A server error occurred. Please try again."
            };

            throw new Error(
                messages[response.status] ||
                "Something went wrong. Please try again."
            );
        }

        return payload;
    }

    // ==========================================
    // 4. LOAD SELECTED EVENT
    // ==========================================

    async function loadSelectedEvent() {
        if (!selectedEventId) return;

        el.bookingSection.hidden = false;
        el.confirmBookingButton.disabled = true;

        try {
            const payload = await apiRequest(
                `/events/${encodeURIComponent(selectedEventId)}`
            );

            if (!payload.data || !payload.data.event_id) {
                throw new Error("The selected event is unavailable.");
            }

            selectedEvent = payload.data;

            el.selectedEventTitle.textContent =
                selectedEvent.title || "Untitled Event";

            el.selectedEventDescription.textContent =
                selectedEvent.description ||
                "No event description available.";

            el.selectedEventDate.textContent =
                formatDate(selectedEvent.event_date);

            el.selectedEventVenue.textContent = [
                selectedEvent.venue_name,
                selectedEvent.city
            ].filter(Boolean).join(", ") || "Venue unavailable";

            const available = Math.max(
                0,
                Number(selectedEvent.available_tickets) || 0
            );

            el.selectedEventAvailable.textContent =
                `${available.toLocaleString("en-MY")} tickets available`;

            quantity = 1;
            updateSummary();

            if (available === 0) {
                showAlert("This event is sold out.");
            }

        } catch (error) {
            console.error("Selected event error:", error);

            selectedEvent = null;
            el.bookingSection.hidden = true;

            showAlert(
                error.message || "Unable to load the selected event."
            );
        }
    }

    // ==========================================
    // 5. QUANTITY & TOTAL
    // ==========================================

    function updateSummary() {
        if (!selectedEvent) return;

        const available = Math.max(
            0,
            Number(selectedEvent.available_tickets) || 0
        );

        const price = Number(selectedEvent.ticket_price) || 0;

        const maxQuantity = Math.min(available, 10);

        if (maxQuantity > 0) {
            quantity = Math.max(1, Math.min(quantity, maxQuantity));
        } else {
            quantity = 0;
        }

        el.quantityValue.textContent = quantity;
        el.summaryQuantity.textContent = quantity;

        el.unitPrice.textContent = money(price);
        el.totalPrice.textContent = money(price * quantity);

        el.decreaseQuantity.disabled =
            submitting || quantity <= 1;

        el.increaseQuantity.disabled =
            submitting || quantity >= maxQuantity;

        el.confirmBookingButton.disabled =
            submitting || quantity <= 0 || available <= 0;

        el.confirmBookingButton.innerHTML = submitting
            ? `<span class="spinner-border spinner-border-sm"></span>
               Processing...`
            : `Confirm Booking <i class="bi bi-arrow-right"></i>`;
    }

    el.decreaseQuantity.addEventListener("click", () => {
        if (!selectedEvent || submitting) return;

        quantity--;
        updateSummary();
    });

    el.increaseQuantity.addEventListener("click", () => {
        if (!selectedEvent || submitting) return;

        quantity++;
        updateSummary();
    });

    // ==========================================
    // 6. CONFIRM BOOKING
    // ==========================================

    el.confirmBookingButton.addEventListener("click", async () => {
        if (!selectedEvent || submitting || quantity < 1) return;

        const confirmation = window.confirm(
            `Confirm ${quantity} ticket(s) for ${money(
                Number(selectedEvent.ticket_price) * quantity
            )}?`
        );

        if (!confirmation) return;

        submitting = true;
        updateSummary();
        hideAlert();

        try {
            const payload = await apiRequest("/bookings", {
                method: "POST",
                body: JSON.stringify({
                    event_id: Number(selectedEvent.event_id),
                    quantity: quantity
                })
            });

            el.bookingSection.hidden = true;
            el.bookingSuccess.hidden = false;

            el.successBookingCode.textContent =
                payload.data?.booking_code || "Confirmed";

            el.successTotalAmount.textContent =
                money(payload.data?.total_amount);

            // Avoid repeating a booking on browser refresh.
            window.history.replaceState(
                {},
                "",
                "bookings.html"
            );

            await loadBookings();

            el.bookingSuccess.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        } catch (error) {
            console.error("Booking error:", error);

            showAlert(
                error.message || "Unable to complete your booking."
            );

            // Refresh availability after a failed attempt.
            try {
                const refreshed = await apiRequest(
                    `/events/${encodeURIComponent(selectedEventId)}`
                );

                if (refreshed.data) {
                    selectedEvent = refreshed.data;

                    const available = Math.max(
                        0,
                        Number(selectedEvent.available_tickets) || 0
                    );

                    el.selectedEventAvailable.textContent =
                        `${available} tickets available`;
                }
            } catch {
                // Preserve the original error message.
            }

        } finally {
            submitting = false;
            updateSummary();
        }
    });

    // ==========================================
    // 7. LOAD MY BOOKINGS
    // ==========================================

    async function loadBookings() {
        el.refreshBookingsButton.disabled = true;

        el.refreshBookingsButton.innerHTML = `
            <i class="bi bi-arrow-clockwise"></i>
            Loading...
        `;

        el.bookingsGrid.innerHTML = `
            <div class="cd-loading">
                <div class="cd-spinner"></div>
                <p>Loading your bookings...</p>
            </div>
        `;

        try {
            const payload = await apiRequest("/bookings");

            if (!Array.isArray(payload.data)) {
                throw new Error(
                    "The bookings API returned an unexpected format."
                );
            }

            renderBookings(payload.data);

        } catch (error) {
            console.error("Load bookings error:", error);

            el.bookingsGrid.innerHTML = `
                <div class="cd-empty">
                    ${escapeHTML(
                        error.message || "Unable to load your bookings."
                    )}
                </div>
            `;

        } finally {
            el.refreshBookingsButton.disabled = false;

            el.refreshBookingsButton.innerHTML = `
                <i class="bi bi-arrow-clockwise"></i>
                Refresh
            `;
        }
    }

    // ==========================================
    // 8. RENDER MY BOOKINGS
    // ==========================================

    function renderBookings(bookings) {
        if (bookings.length === 0) {
            el.bookingsGrid.innerHTML = `
                <div class="cd-empty">
                    <i class="bi bi-ticket-perforated"
                       style="font-size: 32px; display: block; margin-bottom: 14px;"></i>

                    You haven't booked any events yet.

                    <div style="margin-top: 20px;">
                        <a href="index.html" class="cd-primary-button">
                            Discover Events
                        </a>
                    </div>
                </div>
            `;
            return;
        }

        el.bookingsGrid.innerHTML = bookings.map(booking => {
            const cancelled =
                String(booking.status).toLowerCase() === "cancelled";

            const bookingId = Number(booking.booking_id);

            return `
                <article class="cb-booking-card">

                    <div class="cb-booking-card-top">

                        <div>
                            <span class="cb-booking-reference">
                                ${escapeHTML(booking.booking_code)}
                            </span>

                            <h3>
                                ${escapeHTML(
                                    booking.event_title || "Untitled Event"
                                )}
                            </h3>
                        </div>

                        <span class="cb-status ${
                            cancelled ? "cancelled" : "confirmed"
                        }">
                            ${cancelled ? "Cancelled" : "Confirmed"}
                        </span>

                    </div>

                    <div class="cb-booking-card-meta">

                        <div>
                            <i class="bi bi-calendar3"></i>
                            ${escapeHTML(formatDate(booking.event_date))}
                        </div>

                        <div>
                            <i class="bi bi-ticket-perforated"></i>
                            ${escapeHTML(booking.quantity)} ticket(s)
                        </div>

                        <div>
                            <i class="bi bi-cash-stack"></i>
                            ${escapeHTML(money(booking.total_amount))}
                        </div>

                    </div>

                    <div class="cb-booking-card-actions">

                        <a
                            class="cb-outline-button"
                            href="ticket.html?id=${encodeURIComponent(bookingId)}"
                        >
                            <i class="bi bi-qr-code"></i>
                            View Ticket
                        </a>

                        ${
                            !cancelled
                                ? `<button
                                       type="button"
                                       class="cb-cancel-button"
                                       data-cancel-id="${bookingId}"
                                   >
                                       <i class="bi bi-x-circle"></i>
                                       Cancel Booking
                                   </button>`
                                : ""
                        }

                    </div>

                </article>
            `;
        }).join("");
    }

    // ==========================================
    // 9. CANCEL BOOKING
    // ==========================================

    el.bookingsGrid.addEventListener("click", async event => {
        const button = event.target.closest("[data-cancel-id]");

        if (!button) return;

        const bookingId = Number(button.dataset.cancelId);

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            showAlert("Invalid booking reference.");
            return;
        }

        const confirmed = window.confirm(
            "Are you sure you want to cancel this booking? " +
            "Your tickets will be returned to availability."
        );

        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Cancelling...";

        hideAlert();

        try {
            await apiRequest(`/bookings/${bookingId}/cancel`, {
                method: "PATCH"
            });

            await loadBookings();

            showAlert(
                "Your booking has been cancelled successfully.",
                "success"
            );

        } catch (error) {
            console.error("Cancel booking error:", error);

            showAlert(
                error.message || "Unable to cancel this booking."
            );

            button.disabled = false;
            button.innerHTML = `
                <i class="bi bi-x-circle"></i>
                Cancel Booking
            `;
        }
    });

    // ==========================================
    // 10. OTHER EVENTS
    // ==========================================

    el.refreshBookingsButton.addEventListener(
        "click",
        loadBookings
    );

    el.viewBookingsButton.addEventListener("click", () => {
        el.bookingSuccess.hidden = true;

        el.historySection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

    el.logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        window.location.replace("../index.html");
    });

    // ==========================================
    // 11. INITIALISE
    // ==========================================

    if (selectedEventId) {
        loadSelectedEvent();
    }

    loadBookings();

});
