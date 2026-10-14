
"use strict";

const API_BASE = "../../backend";
const token = sessionStorage.getItem("authToken");

let currentUser = null;
let allEvents = [];
let lastFocusedElement = null;

try {
  currentUser = JSON.parse(
    sessionStorage.getItem("currentUser") || "null"
  );
} catch {
  currentUser = null;
}

const el = id => document.getElementById(id);

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function eventTime(value) {
  const time = new Date(String(value || "").replace(" ", "T"));
  return Number.isNaN(time.getTime()) ? 0 : time.getTime();
}

function eventStatus(event) {
  return eventTime(event.event_date) >= Date.now()
    ? "upcoming"
    : "past";
}

function money(value) {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? "RM " + amount.toFixed(2)
    : "—";
}

async function api(path) {
  const response = await fetch(API_BASE + path, {
    headers: {
      Authorization: "Bearer " + token
    }
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid server response.");
  }

  if (!response.ok || result.status !== true) {
    throw new Error(result.message || "Unable to load events.");
  }

  return result.data;
}

function create(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function makeMeta(label, value) {
  const line = create("p");
  const strong = create("strong", "", label + ": ");
  line.append(strong, document.createTextNode(value || "—"));
  return line;
}

function makeEventCard(event) {
  const card = create("article", "event-card");

  const top = create("div", "card-top");
  const id = create("span", "event-id", "EVENT #" + event.event_id);

  const status = eventStatus(event);
  const badge = create(
    "span",
    "event-status " + (status === "past" ? "past" : ""),
    status === "upcoming" ? "Upcoming" : "Past"
  );

  top.append(id, badge);

  const title = create("h3", "", event.title || "Untitled Event");

  const meta = create("div", "event-meta");
  meta.append(
    makeMeta("Date", formatDate(event.event_date)),
    makeMeta("Organiser", event.organiser_name),
    makeMeta("Venue", event.venue_name),
    makeMeta("City", event.city)
  );

  const bottom = create("div", "card-bottom");

  const price = create("div", "ticket-price");
  price.append(
    create("small", "", "TICKET PRICE"),
    document.createTextNode(money(event.ticket_price))
  );

  const details = create("button", "details-btn", "View Details →");
  details.type = "button";
  details.addEventListener("click", () => {
    openEventDetails(event.event_id);
  });

  bottom.append(price, details);
  card.append(top, title, meta, bottom);

  return card;
}

function updateStats() {
  el("stat-total").textContent = allEvents.length;
  el("stat-upcoming").textContent =
    allEvents.filter(e => eventStatus(e) === "upcoming").length;
  el("stat-past").textContent =
    allEvents.filter(e => eventStatus(e) === "past").length;
}

function renderEvents() {
  const search = el("event-search").value.trim().toLowerCase();
  const status = el("status-filter").value;
  const sort = el("sort-filter").value;

  const filtered = allEvents.filter(event => {
    const searchable = [
      event.title,
      event.organiser_name,
      event.venue_name,
      event.city
    ].map(value => String(value || "").toLowerCase()).join(" ");

    return searchable.includes(search) &&
      (status === "all" || eventStatus(event) === status);
  });

  filtered.sort((a, b) => {
    if (sort === "name") {
      return String(a.title || "").localeCompare(String(b.title || ""));
    }

    if (sort === "oldest") {
      return eventTime(a.event_date) - eventTime(b.event_date);
    }

    return eventTime(b.event_date) - eventTime(a.event_date);
  });

  el("results-count").textContent =
    filtered.length + " of " + allEvents.length + " events";

  const grid = el("events-grid");
  grid.replaceChildren();

  el("events-message").textContent =
    filtered.length ? "" : "No matching events found.";

  filtered.forEach(event => {
    grid.appendChild(makeEventCard(event));
  });
}

async function loadAllEvents() {
  const button = el("refresh-events");
  button.disabled = true;

  el("events-message").textContent = "Loading events...";
  el("events-grid").replaceChildren();

  try {
    const events = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await api(
        "/events?page=" + page + "&limit=100"
      );

      if (!Array.isArray(result?.events)) {
        throw new Error("Unexpected events response.");
      }

      events.push(...result.events);

      const parsedPages = Number(result.pagination?.total_pages);
      totalPages = Number.isFinite(parsedPages)
        ? Math.max(1, parsedPages)
        : 1;

      page++;

    } while (page <= totalPages);

    allEvents = events;
    updateStats();
    renderEvents();

  } catch (error) {
    el("events-message").textContent =
      "Unable to load events: " + error.message;
  } finally {
    button.disabled = false;
  }
}

function addDetail(container, label, value) {
  const row = create("div", "detail-row");
  row.append(
    create("span", "detail-label", label),
    create("span", "detail-value", String(value ?? "—"))
  );
  container.appendChild(row);
}

async function openEventDetails(eventId) {
  lastFocusedElement = document.activeElement;

  const modal = el("event-modal");
  const content = el("modal-content");

  modal.hidden = false;
  document.body.classList.add("modal-open");
  content.replaceChildren(create("p", "", "Loading event details..."));
  el("modal-title").textContent = "Event Details";
  el("close-modal").focus();

  try {
    const event = await api(
      "/events/" + encodeURIComponent(eventId)
    );

    if (modal.hidden) return;

    content.replaceChildren();

    el("modal-title").textContent =
      event.title || "Event Details";

    addDetail(content, "Event ID", "#" + event.event_id);
    addDetail(content, "Event Name", event.title);
    addDetail(content, "Description", event.description || "No description");
    addDetail(content, "Date & Time", formatDate(event.event_date));
    addDetail(content, "Organiser", event.organiser_name);
    addDetail(content, "Venue", event.venue_name);
    addDetail(content, "Location", event.location);
    addDetail(content, "City", event.city);
    addDetail(content, "Ticket Price", money(event.ticket_price));
    addDetail(content, "Total Tickets", event.total_tickets);
    addDetail(content, "Available Tickets", event.available_tickets);
    addDetail(
      content,
      "Tickets Reserved",
      Math.max(
        0,
        Number(event.total_tickets || 0) -
        Number(event.available_tickets || 0)
      )
    );
    addDetail(
      content,
      "Status",
      eventStatus(event) === "upcoming" ? "Upcoming" : "Past"
    );

  } catch (error) {
    content.replaceChildren(
      create("p", "", "Unable to load details: " + error.message)
    );
  }
}

function closeModal() {
  el("event-modal").hidden = true;
  document.body.classList.remove("modal-open");

  if (lastFocusedElement?.isConnected) {
    lastFocusedElement.focus();
  }
}

function initialize() {
  if (!token || !currentUser || currentUser.role !== "admin") {
    window.location.replace("../../index.html");
    return;
  }

  const firstName = String(
    currentUser.full_name || "Admin"
  ).trim().split(/\s+/)[0];

  el("welcome-name").textContent = "Hi, " + firstName + "!";

  el("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    window.location.replace("../../index.html");
  });

  el("refresh-events").addEventListener("click", loadAllEvents);
  el("event-search").addEventListener("input", renderEvents);
  el("status-filter").addEventListener("change", renderEvents);
  el("sort-filter").addEventListener("change", renderEvents);

  el("close-modal").addEventListener("click", closeModal);
  el("close-modal-bottom").addEventListener("click", closeModal);

  el("event-modal").addEventListener("click", event => {
    if (event.target === el("event-modal")) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !el("event-modal").hidden) {
      closeModal();
    }
  });

  loadAllEvents();
}

document.addEventListener("DOMContentLoaded", initialize);
