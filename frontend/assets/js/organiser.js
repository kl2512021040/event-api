// frontend/assets/js/organiser.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Semak kebenaran akses (Organiser, Admin & Super Admin)
    checkAuth(['organiser', 'admin', 'super_admin']);

    // 2. Papar nama user
    const user = getUser();
    if (user) {
        document.getElementById('navUserName').innerText = `Hai, ${user.full_name} (${user.role.toUpperCase()})`;
    }

    // 3. Load awal
    loadVenues();
    loadOrganiserEvents();
});

function switchOrganiserTab(tab) {
    const sectionEvents = document.getElementById('sectionEvents');
    const sectionVenues = document.getElementById('sectionVenues');
    const tabs = document.querySelectorAll('.tab-btn');

    if (tab === 'events') {
        sectionEvents.style.display = 'block';
        sectionVenues.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
        loadOrganiserEvents();
    } else {
        sectionEvents.style.display = 'none';
        sectionVenues.style.display = 'block';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
        loadVenues();
    }
}

async function loadVenues() {
    const venuesTable = document.getElementById('venuesTable');
    const eventVenueSelect = document.getElementById('eventVenueId');

    const result = await apiFetch('/venues', 'GET');

    if (result && result.status) {
        venuesTable.innerHTML = '';
        eventVenueSelect.innerHTML = '<option value="">-- Pilih Lokasi --</option>';

        result.data.forEach(v => {
            venuesTable.innerHTML += `
                <tr>
                    <td><strong>${v.name}</strong><br><small>${v.location}</small></td>
                    <td>${v.city}</td>
                    <td>${v.capacity} pax</td>
                    <td>
                        <button class="btn-sm btn-delete" onclick="deleteVenue(${v.venue_id})">Padam</button>
                    </td>
                </tr>
            `;

            eventVenueSelect.innerHTML += `<option value="${v.venue_id}">${v.name} (${v.city})</option>`;
        });
    }
}

document.getElementById('createVenueForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('venueName').value.trim();
    const location = document.getElementById('venueLocation').value.trim();
    const city = document.getElementById('venueCity').value.trim();
    const capacity = parseInt(document.getElementById('venueCapacity').value);

    const result = await apiFetch('/venues', 'POST', { name, location, city, capacity });

    if (result && result.status) {
        showToast('Lokasi baru berjaya ditambah!', 'success');
        document.getElementById('createVenueForm').reset();
        loadVenues();
    } else {
        showToast((result && result.message) || 'Gagal menambah lokasi.', 'error');
    }
});

async function deleteVenue(venueId) {
    if (!confirm('Padam lokasi ini?')) return;

    const result = await apiFetch(`/venues/${venueId}`, 'DELETE');
    if (result && result.status) {
        showToast('Lokasi berjaya dipadam.', 'success');
        loadVenues();
    } else {
        showToast((result && result.message) || 'Gagal memadam lokasi.', 'error');
    }
}

async function loadOrganiserEvents() {
    const eventsTable = document.getElementById('organiserEventsTable');
    eventsTable.innerHTML = '<tr><td colspan="5">Memuatkan acara...</td></tr>';

    const result = await apiFetch('/events', 'GET');

    if (result && result.status && result.data.events.length > 0) {
        eventsTable.innerHTML = '';
        result.data.events.forEach(e => {
            eventsTable.innerHTML += `
                <tr>
                    <td><strong>${e.title}</strong><br><small>${e.venue_name || 'Tiada venue'}</small></td>
                    <td>${e.event_date}</td>
                    <td>RM ${parseFloat(e.ticket_price).toFixed(2)}</td>
                    <td>${e.available_tickets} / ${e.total_tickets}</td>
                    <td>
                        <button class="btn-sm btn-delete" onclick="deleteEvent(${e.event_id})">Padam</button>
                    </td>
                </tr>
            `;
        });
    } else {
        eventsTable.innerHTML = '<tr><td colspan="5">Tiada acara dicipta lagi.</td></tr>';
    }
}

document.getElementById('createEventForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDesc').value.trim();
    const venue_id = document.getElementById('eventVenueId').value;
    const event_date = document.getElementById('eventDate').value;
    const ticket_price = parseFloat(document.getElementById('eventPrice').value);
    const total_tickets = parseInt(document.getElementById('eventTotalTickets').value);

    const result = await apiFetch('/events', 'POST', {
        title, description, venue_id, event_date, ticket_price, total_tickets
    });

    if (result && result.status) {
        showToast('Acara berjaya dicipta!', 'success');
        document.getElementById('createEventForm').reset();
        loadOrganiserEvents();
    } else {
        showToast((result && result.message) || 'Gagal mencipta acara.', 'error');
    }
});

async function deleteEvent(eventId) {
    if (!confirm('Adakah anda pasti mahu memadam acara ini?')) return;

    const result = await apiFetch(`/events/${eventId}`, 'DELETE');
    if (result && result.status) {
        showToast('Acara berjaya dipadam.', 'success');
        loadOrganiserEvents();
    } else {
        showToast((result && result.message) || 'Gagal memadam acara.', 'error');
    }
}

function openProfileModal() {
    const user = getUser();
    if (user) {
        document.getElementById('profileDetails').innerHTML = `
            <p style="margin-bottom:8px;"><strong>Nama Penuh:</strong> ${user.full_name}</p>
            <p style="margin-bottom:8px;"><strong>E-mel:</strong> ${user.email}</p>
            <p style="margin-bottom:8px;"><strong>Peranan:</strong> <span style="text-transform:capitalize;">${user.role}</span></p>
        `;
        document.getElementById('profileModal').style.display = 'flex';
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}