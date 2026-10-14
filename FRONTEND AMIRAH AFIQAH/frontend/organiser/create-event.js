
"use strict";

const API_BASE = "../../backend";
const token = sessionStorage.getItem("authToken");

let currentUser = null;
let isSubmitting = false;
let venues = [];

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

function formatDate(value) {
  if (!value) return "Choose a date and time";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Choose a valid date and time";
  }

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showMessage(message, type = "error") {
  const messageElement = el("form-message");
  messageElement.textContent = message;
  messageElement.className = "form-message " + type;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
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

async function loadVenues() {
  const select = el("event-venue");

  select.replaceChildren(new Option("Loading venues...", ""));
  select.disabled = true;
  el("submit-btn").disabled = true;

  try {
    const data = await apiRequest("/venues");

    // Supports an array response, or an object containing venues.
    const venueList = Array.isArray(data)
      ? data
      : Array.isArray(data?.venues)
        ? data.venues
        : null;

    if (!venueList) {
      throw new Error("Unexpected venue response format.");
    }

    venues = venueList;

    select.replaceChildren(new Option("Select a venue", ""));

    venues.forEach(venue => {
      const label = [
        venue.name,
        venue.city
      ].filter(Boolean).join(" — ");

      select.add(
        new Option(label, String(venue.venue_id))
      );
    });

    if (venues.length === 0) {
      select.replaceChildren(
        new Option("No venues available", "")
      );

      el("venue-help").textContent =
        "No venues found. A venue must be created before publishing an event.";
      return;
    }

    select.disabled = false;
    el("submit-btn").disabled = false;

    el("venue-help").textContent =
      "Select the location where your event will take place.";

  } catch (error) {
    select.replaceChildren(
      new Option("Unable to load venues", "")
    );

    el("venue-help").textContent =
      "Could not load venues. Please refresh the page.";

    showMessage(error.message);
  }
}

function updatePreview() {
  const title = el("event-title").value.trim();
  const date = el("event-date").value;
  const venueId = el("event-venue").value;
  const tickets = Number(el("total-tickets").value);
  const price = Number(el("ticket-price").value);

  const selectedVenue = venues.find(
    venue => String(venue.venue_id) === venueId
  );

  el("preview-title").textContent =
    title || "Your amazing event title";

  el("preview-date").textContent = formatDate(date);

  el("preview-venue").textContent = selectedVenue
    ? [selectedVenue.name, selectedVenue.city]
        .filter(Boolean).join(", ")
    : "Choose a venue";

  el("preview-tickets").textContent =
    Number.isInteger(tickets) && tickets > 0
      ? tickets + " tickets available"
      : "0 tickets available";

  el("preview-price").textContent =
    formatMoney(price > 0 ? price : 0);
}

function toSqlDateTime(value) {
  // datetime-local supplies YYYY-MM-DDTHH:mm.
  // MySQL DATETIME accepts YYYY-MM-DD HH:mm:ss.
  return value.replace("T", " ") + ":00";
}

function validateForm() {
  const title = el("event-title").value.trim();
  const eventDate = el("event-date").value;
  const venueId = Number(el("event-venue").value);
  const price = Number(el("ticket-price").value);
  const tickets = Number(el("total-tickets").value);

  if (!title) {
    throw new Error("Please enter an event title.");
  }

  if (!eventDate || Number.isNaN(new Date(eventDate).getTime())) {
    throw new Error("Please select a valid event date and time.");
  }

  if (new Date(eventDate).getTime() <= Date.now()) {
    throw new Error("Please select a future date and time.");
  }

  if (
    !Number.isInteger(venueId) ||
    !venues.some(venue => Number(venue.venue_id) === venueId)
  ) {
    throw new Error("Please select a valid venue.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(
      "Ticket price must be greater than RM 0.00."
    );
  }

  if (!Number.isInteger(tickets) || tickets <= 0) {
    throw new Error(
      "Total tickets must be a positive whole number."
    );
  }

  return {
    title: title,
    description: el("event-description").value.trim(),
    event_date: toSqlDateTime(eventDate),
    ticket_price: price,
    total_tickets: tickets,
    venue_id: venueId
  };
}

async function submitEvent(event) {
  event.preventDefault();

  if (isSubmitting) return;

  let payload;

  try {
    payload = validateForm();
  } catch (error) {
    showMessage(error.message);
    return;
  }

  const confirmed = window.confirm(
    "Publish \"" + payload.title + "\"?\n\n" +
    "Date: " + formatDate(el("event-date").value) + "\n" +
    "Tickets: " + payload.total_tickets + "\n" +
    "Price: " + formatMoney(payload.ticket_price)
  );

  if (!confirmed) return;

  isSubmitting = true;
  el("submit-btn").disabled = true;
  el("submit-btn").textContent = "Publishing Event...";
  showMessage("", "success");

  try {
    await apiRequest("/events", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    el("create-event-form").reset();
    updatePreview();

    document.querySelector(".create-layout").hidden = true;
    document.querySelector(".create-heading").hidden = true;
    el("success-panel").hidden = false;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {
    showMessage(
      "Unable to publish event: " + error.message
    );
  } finally {
    isSubmitting = false;
    el("submit-btn").textContent = "Publish Event →";
    el("submit-btn").disabled = venues.length === 0;
  }
}

function createAnotherEvent() {
  el("success-panel").hidden = true;
  document.querySelector(".create-layout").hidden = false;
  document.querySelector(".create-heading").hidden = false;

  el("create-event-form").reset();
  showMessage("", "success");
  updatePreview();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function initialize() {
  if (
    !token ||
    !currentUser ||
    currentUser.role !== "organiser"
  ) {
    window.location.replace("../../index.html");
    return;
  }

  const firstName = String(
    currentUser.full_name || "Organiser"
  ).trim().split(/\s+/)[0];

  el("welcome-name").textContent =
    "Hi, " + firstName + "!";

  el("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    window.location.replace("../../index.html");
  });

  const form = el("create-event-form");

  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);
  form.addEventListener("submit", submitEvent);

  el("create-another-btn").addEventListener(
    "click",
    createAnotherEvent
  );

  loadVenues();
}

document.addEventListener("DOMContentLoaded", initialize);
