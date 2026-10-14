
"use strict";

const API_BASE = "../../backend";
const token = sessionStorage.getItem("authToken");

let currentUser = null;
let ownEvents = [];
let busy = false;

try {
  currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
} catch {
  currentUser = null;
}

const el = id => document.getElementById(id);

function money(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency", currency: "MYR"
  }).format(Number(value) || 0);
}

function parseDate(value) {
  return new Date(String(value || "").replace(" ", "T"));
}

function dateText(value) {
  const date = parseDate(value);
  return Number.isNaN(date.getTime())
    ? String(value || "Unavailable")
    : date.toLocaleString("en-MY", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
}

function isUpcoming(event) {
  const date = parseDate(event.event_date);
  return !Number.isNaN(date.getTime()) && date >= new Date();
}

async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid server response.");
  }

  if (!response.ok || result.status !== true) {
    throw new Error(result.message || "Request failed.");
  }

  return result.data;
}

async function fetchAllEvents() {
  const events = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await api("/events?page=" + page + "&limit=100");

    if (!Array.isArray(result?.events)) {
      throw new Error("Unexpected events response.");
    }

    events.push(...result.events);
    totalPages = Number(result.pagination?.total_pages) || 1;
    page++;
  } while (page <= totalPages);

  return events;
}

function textNode(tag, className, content) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  return node;
}

function createCard(event) {
  const card = textNode("article", "managed-card", "");
  const upcoming = isUpcoming(event);

  const badge = textNode(
    "span",
    "managed-badge" + (upcoming ? "" : " past"),
    upcoming ? "UPCOMING EVENT" : "PAST EVENT"
  );

  const title = textNode("h3", "", event.title || "Untitled Event");
  const details = textNode("div", "managed-details", "");

  details.append(
    textNode("p", "", "• " + dateText(event.event_date)),
    textNode("p", "", "• " +
      [event.venue_name, event.city].filter(Boolean).join(", ")),
    textNode("p", "", "• " + event.available_tickets +
      " / " + event.total_tickets + " tickets available")
  );

  const bottom = textNode("div", "managed-bottom", "");
  const price = textNode("strong", "", money(event.ticket_price));
  const actions = textNode("div", "managed-actions", "");

  const edit = textNode("button", "edit-btn", "Edit");
  edit.type = "button";
  edit.addEventListener("click", () => openEdit(event.event_id));

  const remove = textNode("button", "delete-btn", "Delete");
  remove.type = "button";
  remove.addEventListener("click", () => deleteEvent(event, remove));

  actions.append(edit, remove);
  bottom.append(price, actions);
  card.append(badge, title, details, bottom);

  return card;
}

function render() {
  const query = el("search-input").value.trim().toLowerCase();
  const filter = el("status-filter").value;

  const filtered = ownEvents.filter(event => {
    const matchesSearch = String(event.title || "")
      .toLowerCase().includes(query);
    const matchesStatus = filter === "all" ||
      (filter === "upcoming" && isUpcoming(event)) ||
      (filter === "past" && !isUpcoming(event));
    return matchesSearch && matchesStatus;
  });

  el("event-count").textContent = ownEvents.length + " Events";
  el("events-list").replaceChildren();

  el("page-message").textContent = filtered.length
    ? ""
    : "No matching events found.";

  filtered.forEach(event => {
    el("events-list").appendChild(createCard(event));
  });
}

async function loadEvents() {
  el("page-message").textContent = "Loading your events...";
  el("refresh-btn").disabled = true;

  try {
    const events = await fetchAllEvents();

    ownEvents = events.filter(event =>
      String(event.organiser_id) === String(currentUser.user_id)
    );

    render();
  } catch (error) {
    el("page-message").textContent = "Error: " + error.message;
  } finally {
    el("refresh-btn").disabled = false;
  }
}

function toInputDate(value) {
  const raw = String(value || "").replace(" ", "T");
  return raw.slice(0, 16);
}

async function openEdit(id) {
  const event = ownEvents.find(item =>
    String(item.event_id) === String(id)
  );
  if (!event || busy) return;

  el("edit-id").value = event.event_id;
  el("edit-title").value = event.title || "";
  el("edit-description").value = event.description || "";
  el("edit-date").value = toInputDate(event.event_date);
  el("edit-price").value = event.ticket_price;
  el("edit-message").textContent = "";

  el("edit-dialog").showModal();
}

async function saveEdit(e) {
  e.preventDefault();
  if (busy) return;

  const id = el("edit-id").value;
  const event = ownEvents.find(item =>
    String(item.event_id) === String(id)
  );

  if (!event) return;

  const title = el("edit-title").value.trim();
  const description = el("edit-description").value.trim();
  const rawDate = el("edit-date").value;
  const price = Number(el("edit-price").value);

  if (!title || !rawDate || !Number.isFinite(price) || price <= 0) {
    el("edit-message").textContent = "Please enter valid event details.";
    return;
  }

  const date = parseDate(rawDate);
  if (Number.isNaN(date.getTime())) {
    el("edit-message").textContent = "Please enter a valid date.";
    return;
  }

  const payload = {
    title,
    description,
    event_date: rawDate.replace("T", " ") + ":00",
    ticket_price: price
  };

  busy = true;
  el("save-btn").disabled = true;
  el("save-btn").textContent = "Saving...";

  try {
    await api("/events/" + encodeURIComponent(id), {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    el("edit-dialog").close();
    await loadEvents();
    window.alert("Event updated successfully!");
  } catch (error) {
    el("edit-message").textContent = error.message;
  } finally {
    busy = false;
    el("save-btn").disabled = false;
    el("save-btn").textContent = "Save Changes →";
  }
}

async function deleteEvent(event, button) {
  if (busy) return;

  const owned = ownEvents.some(item =>
    String(item.event_id) === String(event.event_id)
  );
  if (!owned) return;

  const confirmed = window.confirm(
    'Delete "' + event.title + '" permanently?\n\n' +
    "This cannot be undone. Existing bookings may also be affected."
  );

  if (!confirmed) return;

  busy = true;
  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    await api("/events/" + encodeURIComponent(event.event_id), {
      method: "DELETE"
    });

    await loadEvents();
    window.alert("Event deleted successfully!");
  } catch (error) {
    window.alert("Unable to delete event: " + error.message);
    button.disabled = false;
    button.textContent = "Delete";
  } finally {
    busy = false;
  }
}

function initialize() {
  if (
    !token || !currentUser ||
    currentUser.role !== "organiser" ||
    !currentUser.user_id
  ) {
    window.location.replace("../../index.html");
    return;
  }

  const firstName = String(currentUser.full_name || "Organiser")
    .trim().split(/\s+/)[0];

  el("welcome-name").textContent = "Hi, " + firstName + "!";

  el("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    window.location.replace("../../index.html");
  });

  el("search-input").addEventListener("input", render);
  el("status-filter").addEventListener("change", render);
  el("refresh-btn").addEventListener("click", loadEvents);
  el("edit-form").addEventListener("submit", saveEdit);

  el("close-dialog").addEventListener("click", () => {
    if (!busy) el("edit-dialog").close();
  });

  el("cancel-edit").addEventListener("click", () => {
    if (!busy) el("edit-dialog").close();
  });

  el("edit-dialog").addEventListener("cancel", e => {
    if (busy) e.preventDefault();
  });

  loadEvents();
}

document.addEventListener("DOMContentLoaded", initialize);
