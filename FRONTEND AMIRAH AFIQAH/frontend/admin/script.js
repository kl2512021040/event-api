
"use strict";

const API_BASE = "../../backend";
const token = sessionStorage.getItem("authToken");

let currentUser = null;
let allUsers = [];

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

  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
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
    throw new Error(result.message || "Unable to load data.");
  }

  return result.data;
}

function textNode(tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
}

function renderUsers() {
  const search = el("user-search").value.trim().toLowerCase();
  const role = el("role-filter").value;

  const filtered = allUsers.filter(user => {
    const name = String(user.full_name || "").toLowerCase();
    const email = String(user.email || "").toLowerCase();

    return (name.includes(search) || email.includes(search)) &&
      (role === "all" || user.role === role);
  });

  const tbody = el("users-body");
  tbody.replaceChildren();

  el("users-count").textContent =
    allUsers.length + " Users";

  el("users-message").textContent = filtered.length
    ? ""
    : "No matching users found.";

  filtered.forEach(user => {
    const row = document.createElement("tr");

    const id = textNode("td", "", "#" + user.user_id);
    const name = textNode("td", "user-name", user.full_name || "—");
    const email = textNode("td", "", user.email || "—");

    const roleCell = document.createElement("td");
    const roleBadge = textNode(
      "span",
      "role-badge " + String(user.role || ""),
      user.role || "Unknown"
    );
    roleCell.appendChild(roleBadge);

    const joined = textNode("td", "", formatDate(user.created_at));

    row.append(id, name, email, roleCell, joined);
    tbody.appendChild(row);
  });
}

async function loadUsers() {
  el("users-message").textContent = "Loading users...";

  try {
    const users = await api("/users");

    if (!Array.isArray(users)) {
      throw new Error("Unexpected users response.");
    }

    allUsers = users;

    el("total-users").textContent = users.length;
    el("total-customers").textContent =
      users.filter(user => user.role === "customer").length;
    el("total-organisers").textContent =
      users.filter(user => user.role === "organiser").length;

    renderUsers();

  } catch (error) {
    el("users-message").textContent =
      "Unable to load users: " + error.message;
  }
}

async function loadEventsCount() {
  try {
    // The Events API provides total_records in pagination.
    const data = await api("/events?page=1&limit=1");

    const total = Number(data?.pagination?.total_records);

    if (!Number.isFinite(total)) {
      throw new Error("Event count unavailable.");
    }

    el("total-events").textContent = total;
    el("event-summary").textContent =
      total + " events registered on the platform";

  } catch (error) {
    el("event-summary").textContent =
      "Unable to load events: " + error.message;
  }
}

async function loadVenuesCount() {
  try {
    const venues = await api("/venues");

    if (!Array.isArray(venues)) {
      throw new Error("Unexpected venues response.");
    }

    el("total-venues").textContent = venues.length;
    el("venue-summary").textContent =
      venues.length + " venues registered on the platform";

  } catch (error) {
    el("venue-summary").textContent =
      "Unable to load venues: " + error.message;
  }
}

async function refreshDashboard() {
  el("refresh-btn").disabled = true;

  await Promise.all([
    loadUsers(),
    loadEventsCount(),
    loadVenuesCount()
  ]);

  el("refresh-btn").disabled = false;
}

function initialize() {
  if (
    !token ||
    !currentUser ||
    currentUser.role !== "admin"
  ) {
    window.location.replace("../../index.html");
    return;
  }

  const firstName = String(
    currentUser.full_name || "Admin"
  ).trim().split(/\s+/)[0];

  el("welcome-name").textContent =
    "Hi, " + firstName + "!";

  el("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    window.location.replace("../../index.html");
  });

  el("user-search").addEventListener("input", renderUsers);
  el("role-filter").addEventListener("change", renderUsers);
  el("refresh-btn").addEventListener("click", refreshDashboard);

  refreshDashboard();
}

document.addEventListener("DOMContentLoaded", initialize);
