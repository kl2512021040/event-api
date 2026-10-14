
document.addEventListener("DOMContentLoaded", () => {
    const token = sessionStorage.getItem("token");

    let currentUser = null;

    try {
        currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
    } catch (error) {
        currentUser = null;
    }

    const allowedRoles = ["admin", "super_admin"];

    if (
        !token ||
        !currentUser ||
        !allowedRoles.includes(currentUser.role)
    ) {
        window.location.href = "../index.html";
        return;
    }

    const el = {
        adminName: document.getElementById("adminName"),
        adminRole: document.getElementById("adminRole"),
        adminAvatar: document.getElementById("adminAvatar"),
        currentDate: document.getElementById("currentDate"),

        pageAlert: document.getElementById("pageAlert"),
        totalVenues: document.getElementById("totalVenues"),
        venuesTableBody: document.getElementById("venuesTableBody"),

        searchVenues: document.getElementById("searchVenues"),
        refreshButton: document.getElementById("refreshButton"),
        logoutButton: document.getElementById("logoutButton"),

        addVenueButton: document.getElementById("addVenueButton"),
        venueModal: document.getElementById("venueModal"),
        venueModalTitle: document.getElementById("venueModalTitle"),
        venueModalDescription: document.getElementById("venueModalDescription"),
        closeVenueModal: document.getElementById("closeVenueModal"),
        cancelVenueButton: document.getElementById("cancelVenueButton"),

        venueForm: document.getElementById("venueForm"),
        venueId: document.getElementById("venueId"),
        venueName: document.getElementById("venueName"),
        venueLocation: document.getElementById("venueLocation"),
        venueCity: document.getElementById("venueCity"),
        venueCapacity: document.getElementById("venueCapacity"),

        saveVenueButton: document.getElementById("saveVenueButton"),
        formAlert: document.getElementById("formAlert")
    };

    let venues = [];

    // -----------------------------------------
    // ADMIN PROFILE
    // -----------------------------------------

    const adminName =
        currentUser.full_name ||
        currentUser.name ||
        currentUser.email ||
        "Administrator";

    el.adminName.textContent = adminName;
    el.adminRole.textContent =
        String(currentUser.role || "admin").replaceAll("_", " ");

    el.adminAvatar.textContent =
        adminName.trim().charAt(0).toUpperCase() || "A";

    el.currentDate.textContent = new Intl.DateTimeFormat("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date());

    // -----------------------------------------
    // API HELPERS
    // -----------------------------------------

    async function apiRequest(endpoint, options = {}) {
        const headers = {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        };

        if (options.body) {
            headers["Content-Type"] = "application/json";
        }

        let response;

        try {
            response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });
        } catch (error) {
            throw new Error(
                "Unable to connect to the server. Check that Apache and MySQL are running."
            );
        }

        if (response.status === 401) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
            window.location.href = "../index.html";
            throw new Error("Your session has expired. Please sign in again.");
        }

        let payload = {};

        try {
            payload = await response.json();
        } catch (error) {
            payload = {};
        }

        if (!response.ok || payload.status === false) {
            const error = new Error("The request could not be completed.");
            error.status = response.status;
            error.apiMessage = String(payload.message || "");
            throw error;
        }

        return payload;
    }

    function extractVenues(payload) {
        const candidates = [
            payload?.data,
            payload?.data?.venues,
            payload?.data?.data,
            payload?.venues
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entities[character];
        });
    }

    function getVenueId(venue) {
        return venue.venue_id ?? venue.id ?? "";
    }

    function getVenueName(venue) {
        return venue.name ?? venue.venue_name ?? "Unnamed Venue";
    }

    function getVenueLocation(venue) {
        return venue.location ?? "—";
    }

    function getVenueCity(venue) {
        return venue.city ?? "—";
    }

    function getVenueCapacity(venue) {
        const capacity = Number(venue.capacity);
        return Number.isFinite(capacity) && capacity > 0
            ? capacity.toLocaleString("en-MY")
            : "—";
    }

    // -----------------------------------------
    // ALERTS
    // -----------------------------------------

    function showPageAlert(message, type = "error") {
        el.pageAlert.textContent = message;
        el.pageAlert.className =
            type === "success" ? "um-alert success" : "um-alert";
        el.pageAlert.style.display = "block";
    }

    function hidePageAlert() {
        el.pageAlert.style.display = "none";
        el.pageAlert.textContent = "";
    }

    function showFormAlert(message, type = "error") {
        el.formAlert.textContent = message;
        el.formAlert.className =
            type === "success" ? "um-alert success" : "um-alert";
        el.formAlert.style.display = "block";
    }

    function hideFormAlert() {
        el.formAlert.style.display = "none";
        el.formAlert.textContent = "";
    }

    function showTableMessage(message) {
        el.venuesTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="um-table-message">
                    ${escapeHTML(message)}
                </td>
            </tr>
        `;
    }

    function describeApiError(error, action = "complete the request") {
        if (error.status === 403) {
            return `Access denied. Your account does not have permission to ${action}.`;
        }

        if (error.status === 404) {
            return "The requested API endpoint was not found. Check the backend route.";
        }

        if (error.status === 400 || error.status === 422) {
            return "The server rejected the submitted details. Check the venue information.";
        }

        if (error.status === 409) {
            return "This operation conflicts with an existing record. Check whether the venue is already in use.";
        }

        return error.message || `Unable to ${action}. Please try again.`;
    }

    // -----------------------------------------
    // RENDER VENUES
    // -----------------------------------------

    function renderVenues() {
        const searchTerm = el.searchVenues.value.trim().toLowerCase();

        const filteredVenues = venues.filter(venue => {
            const searchableText = [
                getVenueName(venue),
                getVenueLocation(venue),
                getVenueCity(venue)
            ].join(" ").toLowerCase();

            return searchableText.includes(searchTerm);
        });

        el.totalVenues.textContent = venues.length.toLocaleString("en-MY");

        if (filteredVenues.length === 0) {
            showTableMessage(
                venues.length === 0
                    ? "No venues are available. Select Add Venue to create one."
                    : "No venues match your search."
            );
            return;
        }

        el.venuesTableBody.innerHTML = filteredVenues.map(venue => {
            const id = getVenueId(venue);

            return `
                <tr>
                    <td>${escapeHTML(id)}</td>

                    <td>
                        <span class="um-user-name">
                            ${escapeHTML(getVenueName(venue))}
                        </span>
                    </td>

                    <td>
                        <span class="vm-location">
                            <i class="bi bi-geo-alt"></i>
                            ${escapeHTML(getVenueLocation(venue))}
                        </span>
                    </td>

                    <td>${escapeHTML(getVenueCity(venue))}</td>

                    <td>
                        <span class="vm-capacity">
                            ${escapeHTML(getVenueCapacity(venue))} people
                        </span>
                    </td>

                    <td>
                        <div class="vm-actions">
                            <button
                                type="button"
                                class="vm-action-button"
                                data-action="edit"
                                data-id="${escapeHTML(id)}"
                                aria-label="Edit venue"
                                title="Edit venue"
                            >
                                <i class="bi bi-pencil-square"></i>
                            </button>

                            <button
                                type="button"
                                class="vm-action-button delete"
                                data-action="delete"
                                data-id="${escapeHTML(id)}"
                                aria-label="Delete venue"
                                title="Delete venue"
                            >
                                <i class="bi bi-trash3"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // -----------------------------------------
    // LOAD VENUES
    // -----------------------------------------

    async function loadVenues() {
        hidePageAlert();

        el.refreshButton.disabled = true;
        el.refreshButton.innerHTML =
            '<i class="bi bi-arrow-clockwise"></i> Loading...';

        showTableMessage("Loading venues...");

        try {
            const payload = await apiRequest("/venues");
            venues = extractVenues(payload);
            renderVenues();
        } catch (error) {
            venues = [];
            el.totalVenues.textContent = "—";
            showTableMessage("Unable to load venues.");
            showPageAlert(describeApiError(error, "view venues"));
        } finally {
            el.refreshButton.disabled = false;
            el.refreshButton.innerHTML =
                '<i class="bi bi-arrow-clockwise"></i> Refresh';
        }
    }

    // -----------------------------------------
    // MODAL
    // -----------------------------------------

    function openAddModal() {
        el.venueForm.reset();
        el.venueId.value = "";

        el.venueModalTitle.textContent = "Add Venue";
        el.venueModalDescription.textContent =
            "Enter the details for the new venue.";

        el.saveVenueButton.innerHTML =
            '<i class="bi bi-check-lg"></i> Create Venue';

        hideFormAlert();
        el.venueModal.hidden = false;
        el.venueName.focus();
    }

    function openEditModal(venue) {
        el.venueForm.reset();
        hideFormAlert();

        el.venueId.value = getVenueId(venue);
        el.venueName.value = getVenueName(venue);
        el.venueLocation.value = venue.location ?? "";
        el.venueCity.value = venue.city ?? "";
        el.venueCapacity.value = venue.capacity ?? "";

        el.venueModalTitle.textContent = "Edit Venue";
        el.venueModalDescription.textContent =
            "Update the selected venue information.";

        el.saveVenueButton.innerHTML =
            '<i class="bi bi-check-lg"></i> Save Changes';

        el.venueModal.hidden = false;
        el.venueName.focus();
    }

    function closeModal() {
        el.venueModal.hidden = true;
        el.venueForm.reset();
        hideFormAlert();
    }

    el.addVenueButton.addEventListener("click", openAddModal);
    el.closeVenueModal.addEventListener("click", closeModal);
    el.cancelVenueButton.addEventListener("click", closeModal);

    el.venueModal.addEventListener("click", event => {
        if (event.target === el.venueModal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !el.venueModal.hidden) {
            closeModal();
        }
    });

    // -----------------------------------------
    // CREATE OR UPDATE VENUE
    // -----------------------------------------

    el.venueForm.addEventListener("submit", async event => {
        event.preventDefault();
        hideFormAlert();

        const id = el.venueId.value.trim();
        const name = el.venueName.value.trim();
        const location = el.venueLocation.value.trim();
        const city = el.venueCity.value.trim();
        const capacity = Number(el.venueCapacity.value);

        if (!name || !location || !city) {
            showFormAlert("Please complete all required fields.");
            return;
        }

        if (!Number.isInteger(capacity) || capacity < 1) {
            showFormAlert("Capacity must be a whole number greater than zero.");
            return;
        }

        const venueData = {
            name,
            location,
            city,
            capacity
        };

        el.saveVenueButton.disabled = true;
        el.saveVenueButton.textContent = "Saving...";

        try {
            if (id) {
                await apiRequest(`/venues/${encodeURIComponent(id)}`, {
                    method: "PUT",
                    body: JSON.stringify(venueData)
                });
            } else {
                await apiRequest("/venues", {
                    method: "POST",
                    body: JSON.stringify(venueData)
                });
            }

            closeModal();
            await loadVenues();

            showPageAlert(
                id
                    ? "Venue updated successfully."
                    : "Venue created successfully.",
                "success"
            );
        } catch (error) {
            showFormAlert(describeApiError(error, id ? "update this venue" : "create a venue"));
        } finally {
            el.saveVenueButton.disabled = false;
            el.saveVenueButton.innerHTML = id
                ? '<i class="bi bi-check-lg"></i> Save Changes'
                : '<i class="bi bi-check-lg"></i> Create Venue';
        }
    });

    // -----------------------------------------
    // EDIT AND DELETE ACTIONS
    // -----------------------------------------

    el.venuesTableBody.addEventListener("click", async event => {
        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const venueId = button.dataset.id;
        const action = button.dataset.action;

        const venue = venues.find(
            item => String(getVenueId(item)) === String(venueId)
        );

        if (!venue) {
            showPageAlert("The selected venue could not be found. Refresh and try again.");
            return;
        }

        if (action === "edit") {
            openEditModal(venue);
            return;
        }

        if (action === "delete") {
            const confirmed = window.confirm(
                `Are you sure you want to delete "${getVenueName(venue)}"?\n\nThis action cannot be undone.`
            );

            if (!confirmed) {
                return;
            }

            button.disabled = true;

            try {
                await apiRequest(`/venues/${encodeURIComponent(venueId)}`, {
                    method: "DELETE"
                });

                await loadVenues();
                showPageAlert("Venue deleted successfully.", "success");
            } catch (error) {
                showPageAlert(
                    error.status === 409 || error.status === 500
                        ? "Unable to delete this venue. It may be linked to existing events, or the backend may restrict deletion."
                        : describeApiError(error, "delete this venue")
                );
            } finally {
                button.disabled = false;
            }
        }
    });

    // -----------------------------------------
    // SEARCH, REFRESH AND SIGN OUT
    // -----------------------------------------

    el.searchVenues.addEventListener("input", renderVenues);
    el.refreshButton.addEventListener("click", loadVenues);

    el.logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        window.location.href = "../index.html";
    });

    // Initial page load
    loadVenues();
});
