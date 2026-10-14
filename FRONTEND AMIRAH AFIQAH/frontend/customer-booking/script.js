
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

if (!token || !currentUser || currentUser.role !== "customer") {
  window.location.replace("../../index.html");
} else {
  document.addEventListener("DOMContentLoaded", initialize);
}

const state = {
  page: 1,
  limit: 9,
  totalPages: 1,
  search: "",
  city: "",
  sort: "asc"
};

function element(id) {
  return document.getElementById(id);
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR"
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "Date unavailable";

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

async function apiGet(endpoint) {
  const response = await fetch(API_BASE + endpoint);

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid server response.");
  }

  if (!response.ok || result.status !== true) {
    throw new Error(result.message || "Unable to load data.");
  }

  return result.data;
}

function initialize() {
  const firstName = String(currentUser.full_name || "Customer")
    .trim()
    .split(/\s+/)[0];

  element("welcome-name").textContent = "Hi, " + firstName + "!";

  element("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    window.location.replace("../../index.html");
  });

  element("filter-form").addEventListener("submit", event => {
    event.preventDefault();

    state.search = element("search-input").value.trim();
    state.city = element("city-filter").value;
    state.sort = element("sort-filter").value;
    state.page = 1;

    loadEvents();
  });

  element("prev-btn").addEventListener("click", () => {
    if (state.page > 1) {
      state.page--;
      loadEvents();
    }
  });

  element("next-btn").addEventListener("click", () => {
    if (state.page < state.totalPages) {
      state.page++;
      loadEvents();
    }
  });

  loadCities();
  loadEvents();
}

async function loadCities() {
  try {
    const venues = await apiGet("/venues");

    if (!Array.isArray(venues)) {
      throw new Error("Invalid venues response.");
    }

    const cities = [...new Set(
      venues.map(venue => String(venue.city || "").trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    const select = element("city-filter");

    cities.forEach(city => {
      const option = document.createElement("option");
      option.value = city;
      option.textContent = city;
      select.appendChild(option);
    });

  } catch (error) {
    console.error("Unable to load cities:", error);
  }
}

async function loadEvents() {
  const grid = element("events-grid");
  const status = element("status-message");

  grid.replaceChildren();
  status.textContent = "Loading events...";

  element("prev-btn").disabled = true;
  element("next-btn").disabled = true;

  const params = new URLSearchParams({
    page: state.page,
    limit: state.limit,
    sort: state.sort
  });

  if (state.search) {
    params.set("search", state.search);
  }

  if (state.city) {
    params.set("city", state.city);
  }

  try {
    const data = await apiGet("/events?" + params.toString());

    if (!data || !Array.isArray(data.events)) {
      throw new Error("Unexpected events response.");
    }

    const pagination = data.pagination || {};

    state.totalPages = Math.max(
      1,
      Number(pagination.total_pages) || 1
    );

    element("event-count").textContent =
      String(pagination.total_records ?? data.events.length) +
      " Events Found";

    element("page-info").textContent =
      "Page " + state.page + " of " + state.totalPages;

    status.textContent = "";

    if (data.events.length === 0) {
      status.textContent =
        "No events found. Try another search or city.";
    }

    data.events.forEach(event => {
      grid.appendChild(createEventCard(event));
    });

    element("prev-btn").disabled = state.page <= 1;
    element("next-btn").disabled = state.page >= state.totalPages;

  } catch (error) {
    status.textContent = error.message;
    element("event-count").textContent = "Unavailable";
    element("page-info").textContent = "Page —";
  }
}

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";

  const top = document.createElement("div");
  top.className = "card-top";

  const badge = document.createElement("span");
  badge.className = "event-badge";

  const eventDate = new Date(
    String(event.event_date || "").replace(" ", "T")
  );

  badge.textContent = Number(event.available_tickets) <= 0
    ? "SOLD OUT"
    : (!Number.isNaN(eventDate.getTime()) &&
       eventDate.getTime() < Date.now())
      ? "PAST EVENT"
      : "UPCOMING EVENT";

  const icon = document.createElement("span");
  icon.className = "event-icon";
  icon.textContent = "";
  icon.setAttribute("aria-hidden", "true");

  top.append(badge, icon);

  const title = document.createElement("h3");
  title.textContent = event.title || "Untitled Event";

  const description = document.createElement("p");
  description.className = "event-description";

  const text = String(event.description || "").trim();
  description.textContent = text.length > 110
    ? text.slice(0, 110) + "..."
    : text || "Discover more about this event.";

  const info = document.createElement("div");
  info.className = "event-info";

  appendInfo(info, "▣", formatDate(event.event_date));

  appendInfo(
    info,
    "⌖",
    [event.venue_name, event.city]
      .filter(Boolean)
      .join(", ") || "Venue unavailable"
  );

  appendInfo(
    info,
    "◈",
    String(event.available_tickets ?? 0) +
    " tickets available"
  );

  const bottom = document.createElement("div");
  bottom.className = "card-bottom";

  const priceBlock = document.createElement("div");

  const priceLabel = document.createElement("span");
  priceLabel.className = "price-label";
  priceLabel.textContent = "PRICE PER TICKET";

  const price = document.createElement("strong");
  price.className = "price";
  price.textContent = formatPrice(event.ticket_price);

  priceBlock.append(priceLabel, price);

  const detailsLink = document.createElement("a");
  detailsLink.className = "details-btn";
  detailsLink.href =
    "event-details.html?id=" +
    encodeURIComponent(event.event_id);
  detailsLink.textContent = "View Details →";

  bottom.append(priceBlock, detailsLink);

  card.append(top, title, description, info, bottom);

  return card;
}

function appendInfo(container, symbol, value) {
  const row = document.createElement("div");
  row.className = "info-row";

  const icon = document.createElement("span");
  icon.className = "info-symbol";
  icon.textContent = symbol;
  icon.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.textContent = value;

  row.append(icon, text);
  container.appendChild(row);
}
