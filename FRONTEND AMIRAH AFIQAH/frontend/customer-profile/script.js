
"use strict";

const API_BASE = "../../backend";

const token = sessionStorage.getItem("authToken");
let currentUser = null;
let allBookings = [];
let isLoading = false;

try {
  currentUser = JSON.parse(
    sessionStorage.getItem("currentUser") || "null"
  );
} catch {
  currentUser = null;
}

function el(id) {
  return document.getElementById(id);
}

function money(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR"
  }).format(Number(value) || 0);
}

function dateText(value) {
  if (!value) return "Not available";

  const date = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      ...options.headers
    }
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Unable to read the server response.");
  }

  if (!response.ok || result.status !== true) {
    throw new Error(result.message || "Request failed.");
  }

  return result.data;
}

function createText(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function addInfo(container, symbol, value) {
  const row = createText("div", "booking-info-row", "");
  row.append(
    createText("span", "info-icon", symbol),
    createText("span", "", value)
  );
  container.appendChild(row);
}

function getStatus(booking) {
  return String(booking.status || "").toLowerCase();
}

function createBookingCard(booking) {
  const card = createText("article", "booking-card", "");

  const top = createText("div", "booking-card-top", "");
  const code = createText(
    "span",
    "booking-code",
    booking.booking_code || "Booking #" + booking.booking_id
  );

  const status = getStatus(booking);
  const badge = createText(
    "span",
    "status-badge " +
      (status === "confirmed" ? "status-confirmed" : "status-cancelled"),
    status || "Unknown"
  );

  top.append(code, badge);

  const title = createText(
    "h3",
    "",
    booking.event_title || "Event Unavailable"
  );

  const info = createText("div", "booking-info", "");

  addInfo(info, "•", dateText(booking.event_date));
  addInfo(
    info,
    "•",
    booking.quantity + (
      Number(booking.quantity) === 1 ? " ticket" : " tickets"
    )
  );

  const total = createText("div", "booking-total", "");
  total.append(
    createText("span", "", "TOTAL AMOUNT"),
    createText("strong", "", money(booking.total_amount))
  );

  const actions = createText("div", "booking-actions", "");

  const viewButton = createText(
    "button",
    "primary-btn",
    "View Ticket →"
  );
  viewButton.type = "button";
  viewButton.addEventListener("click", () => {
    viewTicket(booking.booking_id);
  });

  actions.appendChild(viewButton);

  if (status === "confirmed") {
    const cancelButton = createText(
      "button",
      "cancel-btn",
      "Cancel Booking"
    );
    cancelButton.type = "button";

    cancelButton.addEventListener("click", () => {
      cancelBooking(booking, cancelButton);
    });

    actions.appendChild(cancelButton);
  }

  card.append(top, title, info, total, actions);

  return card;
}

function updateStatistics() {
  const confirmed = allBookings.filter(
    booking => getStatus(booking) === "confirmed"
  ).length;

  const cancelled = allBookings.filter(
    booking => getStatus(booking) === "cancelled"
  ).length;

  el("total-bookings").textContent = allBookings.length;
  el("confirmed-bookings").textContent = confirmed;
  el("cancelled-bookings").textContent = cancelled;
  el("booking-count").textContent =
    allBookings.length + " Bookings";
}

function renderBookings() {
  const filter = el("status-filter").value;

  const bookings = filter === "all"
    ? allBookings
    : allBookings.filter(
        booking => getStatus(booking) === filter
      );

  const list = el("bookings-list");
  list.replaceChildren();

  if (bookings.length === 0) {
    el("page-message").textContent =
      filter === "all"
        ? "You haven't booked any events yet. Explore events to get started!"
        : "No " + filter + " bookings found.";
    return;
  }

  el("page-message").textContent = "";

  bookings.forEach(booking => {
    list.appendChild(createBookingCard(booking));
  });
}

async function loadBookings() {
  if (isLoading) return;

  isLoading = true;
  el("refresh-btn").disabled = true;
  el("page-message").textContent = "Loading your bookings...";

  try {
    const data = await apiRequest("/bookings");

    if (!Array.isArray(data)) {
      throw new Error("Unexpected bookings response.");
    }

    // The original API returns bookings belonging to the
    // authenticated non-admin user. Check again in the UI.
    allBookings = data.filter(
      booking =>
        String(booking.user_id) === String(currentUser.user_id)
    );

    updateStatistics();
    renderBookings();

  } catch (error) {
    el("page-message").textContent =
      "Unable to load bookings: " + error.message;
  } finally {
    isLoading = false;
    el("refresh-btn").disabled = false;
  }
}

function addTicketDetail(container, label, value) {
  const row = createText("div", "ticket-detail", "");

  row.append(
    createText("span", "", label),
    createText("strong", "", value)
  );

  container.appendChild(row);
}

async function viewTicket(bookingId) {
  const dialog = el("ticket-dialog");
  const content = el("dialog-content");

  content.replaceChildren(
    createText("p", "page-message", "Loading ticket...")
  );

  if (!dialog.open) {
    dialog.showModal();
  }

  try {
    const booking = await apiRequest(
      "/bookings/" + encodeURIComponent(bookingId)
    );

    if (
      String(booking.user_id) !== String(currentUser.user_id)
    ) {
      throw new Error("You cannot view this booking.");
    }

    const details = createText("div", "ticket-details", "");

    addTicketDetail(
      details,
      "Booking Code",
      booking.booking_code || "—"
    );

    addTicketDetail(
      details,
      "Event",
      booking.event_title || "—"
    );

    addTicketDetail(
      details,
      "Date",
      dateText(booking.event_date)
    );

    addTicketDetail(
      details,
      "Venue",
      [booking.venue_name, booking.location]
        .filter(Boolean)
        .join(", ") || "—"
    );

    addTicketDetail(
      details,
      "Quantity",
      String(booking.quantity)
    );

    addTicketDetail(
      details,
      "Total Amount",
      money(booking.total_amount)
    );

    addTicketDetail(
      details,
      "Status",
      String(booking.status || "Unknown").toUpperCase()
    );

    content.replaceChildren(details);

    if (
      getStatus(booking) === "confirmed" &&
      booking.qr_code_url
    ) {
      const qrUrl = new URL(
        booking.qr_code_url,
        window.location.href
      );

      if (
        qrUrl.protocol === "https:" &&
        qrUrl.hostname === "api.qrserver.com"
      ) {
        const qrSection = createText("div", "qr-section", "");
        const image = document.createElement("img");

        image.src = qrUrl.href;
        image.alt = "QR code for booking " +
          booking.booking_code;
        image.width = 200;
        image.height = 200;

        qrSection.append(
          image,
          createText(
            "p",
            "",
            "Present this QR code when attending the event."
          )
        );

        content.appendChild(qrSection);
      }
    } else if (getStatus(booking) === "cancelled") {
      content.appendChild(
        createText(
          "p",
          "page-message",
          "This booking has been cancelled."
        )
      );
    }

  } catch (error) {
    content.replaceChildren(
      createText(
        "p",
        "page-message",
        "Unable to load ticket: " + error.message
      )
    );
  }
}

async function cancelBooking(booking, button) {
  if (getStatus(booking) !== "confirmed") return;

  // Only permit cancellation of the current user's
  // own bookings in this frontend.
  if (
    String(booking.user_id) !== String(currentUser.user_id)
  ) {
    window.alert("You cannot cancel this booking.");
    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to cancel booking " +
    booking.booking_code +
    "?\n\nThis action will return the tickets to the event."
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Cancelling...";

  try {
    await apiRequest(
      "/bookings/" +
      encodeURIComponent(booking.booking_id) +
      "/cancel",
      { method: "PATCH" }
    );

    window.alert("Booking cancelled successfully!");

    await loadBookings();

  } catch (error) {
    window.alert(
      "Unable to cancel booking: " + error.message
    );

    button.disabled = false;
    button.textContent = "Cancel Booking";
  }
}

function initialize() {
  if (
    !token ||
    !currentUser ||
    currentUser.role !== "customer" ||
    !currentUser.user_id
  ) {
    window.location.replace("../../index.html");
    return;
  }

  const firstName = String(
    currentUser.full_name || "Customer"
  ).trim().split(/\s+/)[0];

  el("welcome-name").textContent = "Hi, " + firstName + "!";

  el("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    window.location.replace("../../index.html");
  });

  el("status-filter").addEventListener(
    "change",
    renderBookings
  );

  el("refresh-btn").addEventListener(
    "click",
    loadBookings
  );

  el("close-dialog").addEventListener("click", () => {
    el("ticket-dialog").close();
  });

  el("close-dialog-bottom").addEventListener("click", () => {
    el("ticket-dialog").close();
  });

  loadBookings();
}

document.addEventListener("DOMContentLoaded", initialize);
