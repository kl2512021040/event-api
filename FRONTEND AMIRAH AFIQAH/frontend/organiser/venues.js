
"use strict";

const API_BASE = "../../backend";
const token = sessionStorage.getItem("authToken");

let currentUser = null;
let allVenues = [];
let busy = false;

try {
  currentUser = JSON.parse(
    sessionStorage.getItem("currentUser") || "null"
  );
} catch {
  currentUser = null;
}

const el = id => document.getElementById(id);

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

function textNode(tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
}

function isOwner(venue) {
  return String(venue.created_by) === String(currentUser.user_id);
}

function createVenueCard(venue) {
  const card = textNode("article", "venue-card", "");

  const badge = textNode(
    "span",
    "venue-badge" + (isOwner(venue) ? " mine" : ""),
    isOwner(venue) ? "MY VENUE" : "AVAILABLE VENUE"
  );

  const title = textNode("h3", "", venue.name || "Unnamed Venue");
  const details = textNode("div", "venue-details", "");

  details.append(
    textNode("p", "", "•" + (venue.location || "Location unavailable")),
    textNode("p", "", "• " + (venue.city || "City unavailable")),
    textNode("p", "", "• Capacity: " + (venue.capacity ?? "—") + " people"),
    textNode("p", "", "• Added by: " + (venue.created_by_name || "Unknown"))
  );

  card.append(badge, title, details);

  if (isOwner(venue)) {
    const actions = textNode("div", "venue-bottom", "");

    const edit = textNode("button", "edit-btn", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => openEdit(venue.venue_id));

    const remove = textNode("button", "delete-btn", "Delete");
    remove.type = "button";
    remove.addEventListener("click", () => deleteVenue(venue, remove));

    actions.append(edit, remove);
    card.appendChild(actions);
  }

  return card;
}

function renderVenues() {
  const query = el("search-input").value.trim().toLowerCase();
  const filter = el("ownership-filter").value;

  const filtered = allVenues.filter(venue => {
    const searchable = [
      venue.name,
      venue.location,
      venue.city
    ].join(" ").toLowerCase();

    return searchable.includes(query) &&
      (filter === "all" || isOwner(venue));
  });

  const grid = el("venues-grid");
  grid.replaceChildren();

  el("venue-count").textContent =
    allVenues.length + " Venues";

  el("page-message").textContent =
    filtered.length ? "" : "No matching venues found.";

  filtered.forEach(venue => {
    grid.appendChild(createVenueCard(venue));
  });
}

async function loadVenues() {
  el("page-message").textContent = "Loading venues...";
  el("refresh-btn").disabled = true;

  try {
    const data = await api("/venues");

    if (!Array.isArray(data)) {
      throw new Error("Unexpected venues response.");
    }

    allVenues = data;
    renderVenues();
  } catch (error) {
    el("page-message").textContent =
      "Unable to load venues: " + error.message;
  } finally {
    el("refresh-btn").disabled = false;
  }
}

function openCreate() {
  if (busy) return;

  el("venue-form").reset();
  el("venue-id").value = "";
  el("dialog-title").textContent = "Add New Venue";
  el("save-venue-btn").textContent = "Create Venue →";
  el("form-message").textContent = "";

  el("venue-dialog").showModal();
}

function openEdit(id) {
  if (busy) return;

  const venue = allVenues.find(
    item => String(item.venue_id) === String(id)
  );

  if (!venue || !isOwner(venue)) return;

  el("venue-id").value = venue.venue_id;
  el("venue-name").value = venue.name || "";
  el("venue-location").value = venue.location || "";
  el("venue-city").value = venue.city || "";
  el("venue-capacity").value = venue.capacity || "";

  el("dialog-title").textContent = "Edit Venue";
  el("save-venue-btn").textContent = "Save Changes →";
  el("form-message").textContent = "";

  el("venue-dialog").showModal();
}

function getPayload() {
  const name = el("venue-name").value.trim();
  const location = el("venue-location").value.trim();
  const city = el("venue-city").value.trim();
  const capacity = Number(el("venue-capacity").value);

  if (!name || !location || !city) {
    throw new Error("Please complete all venue details.");
  }

  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new Error("Capacity must be a positive whole number.");
  }

  return { name, location, city, capacity };
}

async function saveVenue(event) {
  event.preventDefault();
  if (busy) return;

  let payload;

  try {
    payload = getPayload();
  } catch (error) {
    el("form-message").textContent = error.message;
    return;
  }

  const id = el("venue-id").value;
  const editing = Boolean(id);

  if (editing) {
    const venue = allVenues.find(
      item => String(item.venue_id) === String(id)
    );

    if (!venue || !isOwner(venue)) {
      el("form-message").textContent =
        "You can only edit your own venues.";
      return;
    }
  }

  busy = true;
  el("save-venue-btn").disabled = true;
  el("save-venue-btn").textContent = "Saving...";

  try {
    await api(
      editing
        ? "/venues/" + encodeURIComponent(id)
        : "/venues",
      {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      }
    );

    el("venue-dialog").close();
    await loadVenues();

    window.alert(
      editing
        ? "Venue updated successfully!"
        : "Venue created successfully!"
    );

  } catch (error) {
    el("form-message").textContent = error.message;
  } finally {
    busy = false;
    el("save-venue-btn").disabled = false;
    el("save-venue-btn").textContent =
      editing ? "Save Changes →" : "Create Venue →";
  }
}

async function deleteVenue(venue, button) {
  if (busy || !isOwner(venue)) return;

  const confirmed = window.confirm(
    'Delete venue "' + venue.name + '" permanently?\n\n' +
    "Events using this venue may prevent deletion."
  );

  if (!confirmed) return;

  busy = true;
  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    await api(
      "/venues/" + encodeURIComponent(venue.venue_id),
      { method: "DELETE" }
    );

    await loadVenues();
    window.alert("Venue deleted successfully!");

  } catch (error) {
    window.alert(
      "Unable to delete venue: " + error.message
    );

    button.disabled = false;
    button.textContent = "Delete";
  } finally {
    busy = false;
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

  el("welcome-name").textContent =
    "Hi, " + firstName + "!";

  el("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    window.location.replace("../../index.html");
  });

  el("add-venue-btn").addEventListener("click", openCreate);
  el("refresh-btn").addEventListener("click", loadVenues);

  el("search-input").addEventListener("input", renderVenues);
  el("ownership-filter").addEventListener("change", renderVenues);

  el("venue-form").addEventListener("submit", saveVenue);

  el("close-dialog").addEventListener("click", () => {
    if (!busy) el("venue-dialog").close();
  });

  el("cancel-dialog").addEventListener("click", () => {
    if (!busy) el("venue-dialog").close();
  });

  el("venue-dialog").addEventListener("cancel", event => {
    if (busy) event.preventDefault();
  });

  loadVenues();
}

document.addEventListener("DOMContentLoaded", initialize);
