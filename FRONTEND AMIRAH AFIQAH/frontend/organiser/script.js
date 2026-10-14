
"use strict";

const API_BASE = "../../backend";
const token = sessionStorage.getItem("authToken");

let currentUser = null;

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
  if (!value) return "Date unavailable";

  const date = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function apiGet(path) {
  const response = await fetch(API_BASE + path);

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Unable to read API response.");
  }

  if (!response.ok || result.status !== true) {
    throw new Error(result.message || "Unable to load events.");
  }

  return result.data;
}

async function fetchAllEvents() {
  const first = await apiGet("/events?page=1&limit=100&sort=desc");

  if (!first || !Array.isArray(first.events)) {
    throw new Error("Invalid events response.");
  }

  const allEvents = [...first.events];
  const totalPages = Number(first.pagination?.total_pages) || 1;

  for (let page = 2; page <= totalPages; page++) {
    const data = await apiGet(
      "/events?page=" + page + "&limit=100&sort=desc"
    );

    if (!data || !Array.isArray(data.events)) {
      throw new Error("Invalid events response.");
    }

    allEvents.push(...data.events);
  }

  return allEvents;
}

function isUpcoming(event) {
  const date = new Date(
    String(event.event_date || "").replace(" ", "T")
  );

  return !Number.isNaN(date.getTime()) &&
    date.getTime() >= Date.now();
}

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";

  const badge = document.createElement("span");
  badge.className = "event-badge";
  badge.textContent = isUpcoming(event)
    ? "UPCOMING EVENT"
    : "PAST EVENT";

  const title = document.createElement("h3");
  title.textContent = event.title || "Untitled Event";

  const info = document.createElement("div");
  info.className = "event-info";

  const date = document.createElement("p");
  date.textContent = "▣ " + formatDate(event.event_date);

  const venue = document.createElement("p");
  venue.textContent = "⌖ " +
    [event.venue_name, event.city]
      .filter(Boolean).join(", ");

  const tickets = document.createElement("p");
  tickets.textContent = "◈ " +
    (event.available_tickets ?? 0) +
    " / " +
    (event.total_tickets ?? 0) +
    " tickets available";

  info.append(date, venue, tickets);

  const bottom = document.createElement("div");
  bottom.className = "card-bottom";

  const price = document.createElement("strong");
  price.textContent = formatMoney(event.ticket_price);

  const link = document.createElement("a");
  link.href = "my-events.html";
  link.textContent = "Manage →";

  bottom.append(price, link);
  card.append(badge, title, info, bottom);

  return card;
}

async function loadDashboard() {
  const status = el("status-message");
  const grid = el("recent-events");

  status.textContent = "Loading your events...";
  grid.replaceChildren();

  el("refresh-btn").disabled = true;

  try {
    const events = await fetchAllEvents();

    const ownEvents = events.filter(
      event =>
        String(event.organiser_id) ===
        String(currentUser.user_id)
    );

    const upcoming = ownEvents.filter(isUpcoming);

    const availableTickets = ownEvents.reduce(
      (sum, event) =>
        sum + (Number(event.available_tickets) || 0),
      0
    );

    const reservedTickets = ownEvents.reduce(
      (sum, event) =>
        sum + Math.max(
          0,
          (Number(event.total_tickets) || 0) -
          (Number(event.available_tickets) || 0)
        ),
      0
    );

    el("total-events").textContent = ownEvents.length;
    el("upcoming-events").textContent = upcoming.length;
    el("available-tickets").textContent = availableTickets;
    el("reserved-tickets").textContent = reservedTickets;

    const recent = [...ownEvents]
      .sort((a, b) => Number(b.event_id) - Number(a.event_id))
      .slice(0, 3);

    if (recent.length === 0) {
      status.textContent =
        "You haven't created any events yet. Create your first event!";
      return;
    }

    status.textContent = "";

    recent.forEach(event => {
      grid.appendChild(createEventCard(event));
    });

  } catch (error) {
    status.textContent =
      "Unable to load dashboard: " + error.message;
  } finally {
    el("refresh-btn").disabled = false;
  }
}

function initialize() {
  if (
    !token ||
    !currentUser ||
    currentUser.role !== "organiser" ||
    !currentUser.user_id
  ) {
    window.location.replace("../../index.html");
    return;
  }

  const firstName = String(
    currentUser.full_name || "Organiser"
  ).trim().split(/\s+/)[0];

  el("welcome-name").textContent = "Hi, " + firstName + "!";

  el("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    window.location.replace("../../index.html");
  });

  el("refresh-btn").addEventListener("click", loadDashboard);

  loadDashboard();
}

document.addEventListener("DOMContentLoaded", initialize);
