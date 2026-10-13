// frontend/assets/js/customer.js

let currentEventPrice = 0;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Semak kebenaran akses (Akses untuk Customer, Admin & Super Admin)
    checkAuth(['customer', 'admin', 'super_admin']);

    // 2. Paparkan nama user dalam Navbar
    const user = getUser();
    if (user) {
        document.getElementById('navUserName').innerText = `Hai, ${user.full_name}`;
    }

    // 3. Muatkan senarai acara pertama kali
    loadEvents();
});

function switchCustomerTab(tab) {
    const sectionEvents = document.getElementById('sectionEvents');
    const sectionBookings = document.getElementById('sectionBookings');
    const tabs = document.querySelectorAll('.tab-btn');

    if (tab === 'events') {
        sectionEvents.style.display = 'block';
        sectionBookings.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
        loadEvents();
    } else {
        sectionEvents.style.display = 'none';
        sectionBookings.style.display = 'block';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
        loadMyBookings();
    }
}

async function loadEvents() {
    const search = document.getElementById('searchInput').value.trim();
    const city = document.getElementById('cityInput').value.trim();

    let endpoint = '/events?';
    if (search) endpoint += `search=${encodeURIComponent(search)}&`;
    if (city) endpoint += `city=${encodeURIComponent(city)}`;

    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '<p>Memuatkan senarai acara...</p>';

    const result = await apiFetch(endpoint, 'GET');

    if (result && result.status && result.data.events.length > 0) {
        eventsList.innerHTML = '';
        result.data.events.forEach(event => {
            eventsList.innerHTML += `
                <div class="event-card">
                    <h3>${event.title}</h3>
                    <p style="color: #666; font-size: 14px; margin: 8px 0;">${event.description || 'Tiada penerangan.'}</p>
                    <p><strong>Tarikh:</strong> ${event.event_date}</p>
                    <p><strong>Lokasi:</strong> ${event.venue_name || 'Dewan'} (${event.city || 'N/A'})</p>
                    <p><strong>Harga:</strong> RM ${parseFloat(event.ticket_price).toFixed(2)}</p>
                    <p><strong>Baki Tiket:</strong> ${event.available_tickets}</p>
                    <br>
                    <button class="btn-primary" 
                            ${event.available_tickets <= 0 ? 'disabled style="background:#ccc;"' : ''} 
                            onclick="openBuyModal(${event.event_id}, '${event.title}', ${event.ticket_price}, ${event.available_tickets})">
                        ${event.available_tickets > 0 ? 'Beli Tiket' : 'Tiket Habis'}
                    </button>
                </div>
            `;
        });
    } else {
        eventsList.innerHTML = '<p>Tiada acara dijumpai.</p>';
    }
}

function openBuyModal(eventId, title, price, availableTickets) {
    currentEventPrice = parseFloat(price);
    document.getElementById('modalEventId').value = eventId;
    document.getElementById('modalEventTitle').innerText = title;
    document.getElementById('modalEventPrice').innerText = `RM ${currentEventPrice.toFixed(2)}`;
    document.getElementById('ticketQty').value = 1;
    document.getElementById('ticketQty').max = availableTickets;
    calculateTotal();

    document.getElementById('buyTicketModal').style.display = 'flex';
}

function calculateTotal() {
    const qty = parseInt(document.getElementById('ticketQty').value) || 1;
    const total = currentEventPrice * qty;
    document.getElementById('modalTotalPrice').innerText = `RM ${total.toFixed(2)}`;
}

document.getElementById('buyTicketForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const event_id = document.getElementById('modalEventId').value;
    const quantity = parseInt(document.getElementById('ticketQty').value);

    const result = await apiFetch('/bookings', 'POST', { event_id, quantity });

    if (result && result.status) {
        showToast('Tempahan berjaya dibuat!', 'success');
        closeModal('buyTicketModal');
        switchCustomerTab('bookings');
    } else {
        showToast((result && result.message) || 'Gagal membuat tempahan.', 'error');
    }
});

async function loadMyBookings() {
    const bookingsList = document.getElementById('bookingsList');
    bookingsList.innerHTML = '<p>Memuatkan tempahan anda...</p>';

    const result = await apiFetch('/bookings', 'GET');

    if (result && result.status && result.data.length > 0) {
        bookingsList.innerHTML = '';
        result.data.forEach(item => {
            const isConfirmed = item.status === 'confirmed';
            bookingsList.innerHTML += `
                <div class="booking-card">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${item.booking_code}</strong>
                        <span class="badge ${isConfirmed ? 'badge-confirmed' : 'badge-cancelled'}">
                            ${item.status.toUpperCase()}
                        </span>
                    </div>
                    <h4 style="margin: 10px 0;">${item.event_title}</h4>
                    <p>Tarikh: ${item.event_date}</p>
                    <p>Kuantiti: ${item.quantity} Tiket</p>
                    <p>Jumlah: <strong>RM ${parseFloat(item.total_amount).toFixed(2)}</strong></p>
                    
                    ${isConfirmed ? `<img src="${item.qr_code_url}" alt="QR Tiket" class="qr-img">` : ''}

                    ${isConfirmed ? `
                        <button class="btn-primary" style="background-color: #e74c3c; width:100%; margin-top:10px;" 
                                onclick="cancelBooking(${item.booking_id})">
                            Batal Tempahan
                        </button>
                    ` : ''}
                </div>
            `;
        });
    } else {
        bookingsList.innerHTML = '<p>Anda belum membuat sebarang tempahan.</p>';
    }
}

async function cancelBooking(bookingId) {
    if (!confirm('Adakah anda pasti mahu membatalkan tempahan ini?')) return;

    const result = await apiFetch(`/bookings/${bookingId}/cancel`, 'POST');

    if (result && result.status) {
        showToast('Tempahan berjaya dibatalkan.', 'success');
        loadMyBookings();
    } else {
        showToast((result && result.message) || 'Gagal membatalkan tempahan.', 'error');
    }
}

function openProfileModal() {
    const user = getUser();
    if (user) {
        document.getElementById('profileDetails').innerHTML = `
            <p style="margin-bottom:8px;"><strong>Nama Penuh:</strong> ${user.full_name}</p>
            <p style="margin-bottom:8px;"><strong>E-mel:</strong> ${user.email}</p>
            <p style="margin-bottom:8px;"><strong>Peranan Akaun:</strong> <span style="text-transform:capitalize;">${user.role}</span></p>
        `;
        document.getElementById('profileModal').style.display = 'flex';
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}