
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. AUTHENTICATION
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

        ticketAlert: document.getElementById("ticketAlert"),
        ticketLoading: document.getElementById("ticketLoading"),
        ticketSection: document.getElementById("ticketSection"),

        ticketEventTitle: document.getElementById("ticketEventTitle"),
        ticketBookingCode: document.getElementById("ticketBookingCode"),
        ticketStatus: document.getElementById("ticketStatus"),
        ticketEventDate: document.getElementById("ticketEventDate"),
        ticketVenue: document.getElementById("ticketVenue"),
        ticketQuantity: document.getElementById("ticketQuantity"),
        ticketTotal: document.getElementById("ticketTotal"),
        ticketInstructions: document.getElementById("ticketInstructions"),
        ticketCodeBottom: document.getElementById("ticketCodeBottom"),

        ticketQrImage: document.getElementById("ticketQrImage"),
        qrStatusText: document.getElementById("qrStatusText"),

        printTicketButton: document.getElementById("printTicketButton")
    };

    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get("id");

    const fullName = user.full_name || user.name || "Customer";

    el.customerName.textContent =
        `Welcome, ${fullName.trim().split(/\s+/)[0]}`;

    // ==========================================
    // 3. HELPERS
    // ==========================================

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

        const date = new Date(
            String(value).replace(" ", "T")
        );

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

    function showError(message) {
        el.ticketAlert.textContent = message;
        el.ticketAlert.hidden = false;
    }

    function hideError() {
        el.ticketAlert.textContent = "";
        el.ticketAlert.hidden = true;
    }

    // ==========================================
    // 4. FETCH BOOKING DETAILS
    // ==========================================

    async function loadTicket() {
        hideError();

        if (
            !bookingId ||
            !/^[1-9]\d*$/.test(bookingId)
        ) {
            el.ticketLoading.hidden = true;

            showError(
                "Invalid booking reference. Please return to My Bookings."
            );

            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/bookings/${encodeURIComponent(bookingId)}`,
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
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    "You do not have permission to view this ticket."
                );
            }

            if (response.status === 404) {
                throw new Error(
                    "This booking could not be found."
                );
            }

            if (!response.ok) {
                throw new Error(
                    "Unable to retrieve your ticket."
                );
            }

            const payload = await response.json();

            if (payload.status === false || !payload.data) {
                throw new Error(
                    "The ticket information is unavailable."
                );
            }

            renderTicket(payload.data);

            el.ticketLoading.hidden = true;
            el.ticketSection.hidden = false;

        } catch (error) {
            console.error("Ticket details error:", error);

            el.ticketLoading.hidden = true;
            el.ticketSection.hidden = true;

            showError(
                error.message ||
                "Something went wrong while loading your ticket."
            );
        }
    }

    // ==========================================
    // 5. RENDER TICKET
    // ==========================================

    function renderTicket(booking) {
        const cancelled =
            String(booking.status).toLowerCase() === "cancelled";

        el.ticketEventTitle.textContent =
            booking.event_title || "Untitled Event";

        el.ticketBookingCode.textContent =
            booking.booking_code || "—";

        el.ticketCodeBottom.textContent =
            booking.booking_code || "—";

        el.ticketEventDate.textContent =
            formatDate(booking.event_date);

        el.ticketVenue.textContent = [
            booking.venue_name,
            booking.location
        ].filter(Boolean).join(", ") || "Venue unavailable";

        const quantity = Number(booking.quantity) || 0;

        el.ticketQuantity.textContent =
            `${quantity} ${quantity === 1 ? "Ticket" : "Tickets"}`;

        el.ticketTotal.textContent =
            money(booking.total_amount);

        el.ticketStatus.textContent =
            cancelled ? "Cancelled" : "Confirmed";

        el.ticketStatus.className =
            `ct-status ${cancelled ? "cancelled" : "confirmed"}`;

        // QR code is generated by the backend.
        // The image URL points to an external QR service.
        const qrUrl = booking.qr_code_url;

        if (cancelled) {
            el.ticketInstructions.textContent =
                "This booking has been cancelled. " +
                "The ticket is no longer valid for event entry.";

            el.ticketQrImage.hidden = true;

            el.qrStatusText.textContent =
                "TICKET CANCELLED";

            document.getElementById("printableTicket")
                .classList.add("ct-ticket-cancelled");

        } else {
            el.ticketInstructions.textContent =
                "Present this QR code at the event " +
                "entrance for verification.";

            if (typeof qrUrl === "string" && qrUrl.startsWith(
                "https://api.qrserver.com/"
            )) {
                el.ticketQrImage.src = qrUrl;
                el.ticketQrImage.hidden = false;
            } else {
                el.ticketQrImage.hidden = true;

                el.qrStatusText.textContent =
                    "QR CODE UNAVAILABLE";
            }
        }
    }

    // ==========================================
    // 6. QR IMAGE ERROR HANDLING
    // ==========================================

    el.ticketQrImage.addEventListener("error", () => {
        el.ticketQrImage.hidden = true;

        if (el.ticketStatus.textContent !== "Cancelled") {
            el.qrStatusText.textContent =
                "QR CODE COULD NOT LOAD";
        }
    });

    // ==========================================
    // 7. PRINT TICKET
    // ==========================================

    el.printTicketButton.addEventListener("click", () => {
        window.print();
    });

    // ==========================================
    // 8. LOGOUT
    // ==========================================

    el.logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        window.location.replace("../index.html");
    });

    // ==========================================
    // 9. INITIALISE
    // ==========================================

    loadTicket();

});
