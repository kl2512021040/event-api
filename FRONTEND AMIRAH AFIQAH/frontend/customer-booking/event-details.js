
"use strict";

const API_BASE = "../../backend";
const token = sessionStorage.getItem("authToken");

let currentUser = null;
let currentEvent = null;
let bookingCompleted = false;
let bookingInProgress = false;

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

function formatMoney(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR"
  }).format(Number(value) || 0);
}

function formatEventDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Authorization": "Bearer " + token,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Unable to read server response.");
  }

  if (!response.ok || result.status !== true) {
    throw new Error(result.message || "Request failed.");
  }

  return result.data;
}

function showError(message) {
  const feedback = el("booking-feedback");
  feedback.textContent = message;
  feedback.hidden = false;
}

function getAvailableTickets() {
  return Math.max(0, Number(currentEvent?.available_tickets) || 0);
}

function isPastEvent() {
  if (!currentEvent?.event_date) return false;

  const date = new Date(
    String(currentEvent.event_date).replace(" ", "T")
  );

  return !Number.isNaN(date.getTime()) &&
    date.getTime() < Date.now();
}

function updateSummary() {
  if (!currentEvent) return;

  const input = el("ticket-quantity");
  const quantity = Number(input.value);
  const available = getAvailableTickets();

  const valid =
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= available;

  const price = Number(currentEvent.ticket_price) || 0;

  el("summary-unit-price").textContent = formatMoney(price);
  el("summary-quantity").textContent =
    valid ? quantity + (quantity === 1 ? " ticket" : " tickets") : "—";
  el("summary-total").textContent =
    valid ? formatMoney(price * quantity) : "—";

  el("confirm-btn").disabled =
    !valid ||
    isPastEvent() ||
    bookingInProgress ||
    bookingCompleted;

  el("decrease-btn").disabled = quantity <= 1;
  el("increase-btn").disabled = quantity >= available;
}

function changeQuantity(amount) {
  const input = el("ticket-quantity");
  const current = Number(input.value) || 1;
  const maximum = getAvailableTickets();

  if (maximum < 1) return;

  input.value = Math.max(
    1,
    Math.min(maximum, current + amount)
  );

  updateSummary();
}

function renderEvent(event) {
  currentEvent = event;

  el("event-title").textContent = event.title || "Untitled Event";
  el("event-description").textContent =
    event.description || "No description available.";

  el("event-date").textContent =
    formatEventDate(event.event_date);

  el("event-venue").textContent =
    event.venue_name || "Venue unavailable";

  el("event-location").textContent =
    [event.location, event.city].filter(Boolean).join(", ") ||
    "Location unavailable";

  el("event-availability").textContent =
    getAvailableTickets() + " tickets remaining";

  el("event-organiser").textContent =
    event.organiser_name || "Event Organiser";

  el("ticket-price").textContent =
    formatMoney(event.ticket_price);

  const available = getAvailableTickets();

  el("ticket-quantity").max = available;
  el("ticket-quantity").value = 1;

  if (available <= 0) {
    el("event-status").textContent = "SOLD OUT";
    showError("Sorry, this event is sold out.");
  } else if (isPastEvent()) {
    el("event-status").textContent = "PAST EVENT";
    showError("Booking is unavailable because this event has ended.");
  } else {
    el("event-status").textContent = "UPCOMING EVENT";
  }

  el("page-message").textContent = "";
  el("details-content").hidden = false;

  updateSummary();
}

async function loadEvent() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("id");

  if (!eventId || !/^\d+$/.test(eventId)) {
    el("page-message").textContent = "Invalid event ID.";
    return;
  }

  try {
    const event = await apiRequest(
      "/events/" + encodeURIComponent(eventId)
    );

    if (!event || !event.event_id) {
      throw new Error("Event not found.");
    }

    renderEvent(event);
  } catch (error) {
    el("page-message").textContent =
      "Unable to load event: " + error.message;
  }
}

async function submitBooking(event) {
  event.preventDefault();

  if (!currentEvent || bookingCompleted || bookingInProgress) {
    return;
  }

  const quantity = Number(el("ticket-quantity").value);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > getAvailableTickets() ||
    isPastEvent()
  ) {
    showError("Please select a valid ticket quantity.");
    return;
  }

  el("booking-feedback").hidden = true;

  const confirmed = window.confirm(
    "Confirm booking for " +
    quantity + (quantity === 1 ? " ticket" : " tickets") +
    "?\nTotal: " +
    formatMoney(Number(currentEvent.ticket_price) * quantity)
  );

  if (!confirmed) return;

  bookingInProgress = true;
  el("confirm-btn").textContent = "Processing Booking...";
  updateSummary();

  try {
    const result = await apiRequest("/bookings", {
      method: "POST",
      body: JSON.stringify({
        event_id: Number(currentEvent.event_id),
        quantity: quantity
      })
    });

    bookingCompleted = true;

    el("booking-code").textContent =
      result.booking_code || "Unavailable";

    el("success-total").textContent =
      formatMoney(result.total_amount);

    if (result.qr_code_url) {
      const qrUrl = new URL(
        result.qr_code_url,
        window.location.href
      );

      // Accept only the QR provider used by the original backend.
      if (
        qrUrl.protocol === "https:" &&
        qrUrl.hostname === "api.qrserver.com"
      ) {
        el("booking-qr").src = qrUrl.href;
        el("qr-container").hidden = false;
      }
    }

    el("details-content").hidden = true;
    el("booking-success").hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });

  } catch (error) {
    showError(error.message);
  } finally {
    bookingInProgress = false;
    el("confirm-btn").textContent = "Confirm Booking →";
    updateSummary();
  }
}

function initialize() {
  if (!token || !currentUser || currentUser.role !== "customer") {
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

  el("decrease-btn").addEventListener("click", () => {
    changeQuantity(-1);
  });

  el("increase-btn").addEventListener("click", () => {
    changeQuantity(1);
  });

  el("ticket-quantity").addEventListener("input", updateSummary);

  el("booking-form").addEventListener("submit", submitBooking);

  loadEvent();
}

document.addEventListener("DOMContentLoaded", initialize);
