// frontend/assets/js/customer.js

let currentEventPrice = 0;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Semak kebenaran akses (Akses untuk Customer, Admin & Super Admin)
    checkAuth(['customer', 'admin', 'super_admin']);

    // 2. Paparkan nama user dalam Navbar
    const user = getUser();
    if (user) {
        const navName = document.getElementById('navUserName');
        if (navName) navName.innerText = `Hai, ${user.full_name}`;
    }

    // 3. Muatkan senarai acara pertama kali
    loadEvents();
});

function switchCustomerTab(tab) {
    const sectionEvents = document.getElementById('sectionEvents');
    const sectionBookings = document.getElementById('sectionBookings');
    const tabs = document.querySelectorAll('.tab-btn');

    if (tab === 'events') {
        if (sectionEvents) sectionEvents.style.display = 'block';
        if (sectionBookings) sectionBookings.style.display = 'none';
        if (tabs[0]) tabs[0].classList.add('active');
        if (tabs[1]) tabs[1].classList.remove('active');
        loadEvents();
    } else {
        if (sectionEvents) sectionEvents.style.display = 'none';
        if (sectionBookings) sectionBookings.style.display = 'block';
        if (tabs[0]) tabs[0].classList.remove('active');
        if (tabs[1]) tabs[1].classList.add('active');
        loadMyBookings();
    }
}

async function loadEvents() {
    const searchInput = document.getElementById('searchInput');
    const cityInput = document.getElementById('cityInput');

    const search = searchInput ? searchInput.value.trim() : '';
    const city = cityInput ? cityInput.value.trim() : '';

    let endpoint = '/events?';
    if (search) endpoint += `search=${encodeURIComponent(search)}&`;
    if (city) endpoint += `city=${encodeURIComponent(city)}`;

    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;

    eventsList.innerHTML = '<p>Memuatkan senarai acara...</p>';

    const result = await apiFetch(endpoint, 'GET');

    if (result && (result.status === true || result.status === 'success') && result.data && result.data.events && result.data.events.length > 0) {
        eventsList.innerHTML = '';
        result.data.events.forEach(event => {
            const isAvailable = parseInt(event.available_tickets) > 0;
            eventsList.innerHTML += `
                <div class="event-card">
                    <h3>${event.title}</h3>
                    <p style="color: #666; font-size: 14px; margin: 8px 0;">${event.description || 'Tiada penerangan.'}</p>
                    <p><strong>Tarikh:</strong> ${event.event_date}</p>
                    <p><strong>Lokasi:</strong> ${event.venue_name || 'Dewan'} (${event.city || 'N/A'})</p>
                    <p><strong>Harga:</strong> RM ${parseFloat(event.ticket_price).toFixed(2)}</p>
                    <p><strong>Baki Tiket:</strong> ${event.available_tickets}</p>
                    <br>
                    <button type="button" class="btn-primary" 
                            ${!isAvailable ? 'disabled style="background:#ccc; cursor:not-allowed;"' : ''} 
                            onclick="openBuyModal(${event.event_id}, '${event.title.replace(/'/g, "\\'")}', ${event.ticket_price}, ${event.available_tickets})">
                        ${isAvailable ? 'Beli Tiket' : 'Tiket Habis'}
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
    
    const qtyInput = document.getElementById('ticketQty');
    qtyInput.value = 1;
    qtyInput.max = availableTickets;
    
    calculateTotal();

    const modal = document.getElementById('buyTicketModal');
    if (modal) modal.style.display = 'flex';
}

function calculateTotal() {
    const qtyInput = document.getElementById('ticketQty');
    const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;
    const total = currentEventPrice * qty;
    const totalElement = document.getElementById('modalTotalPrice');
    if (totalElement) totalElement.innerText = `RM ${total.toFixed(2)}`;
}

// Submisi Borang Tempahan Tiket
const buyTicketForm = document.getElementById('buyTicketForm');
if (buyTicketForm) {
    buyTicketForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const event_id = document.getElementById('modalEventId').value;
        const quantity = parseInt(document.getElementById('ticketQty').value);

        if (!event_id || !quantity || quantity <= 0) {
            showToast('Sila masukkan kuantiti tiket yang sah.', 'error');
            return;
        }

        const result = await apiFetch('/bookings', 'POST', { event_id, quantity });

        if (result && (result.status === true || result.status === 'success')) {
            showToast('Tempahan berjaya dibuat!', 'success');
            closeModal('buyTicketModal');
            switchCustomerTab('bookings');
        } else {
            showToast((result && result.message) || 'Gagal membuat tempahan.', 'error');
        }
    });
}

// Muat Senarai Tempahan Saya
async function loadMyBookings() {
    const bookingsList = document.getElementById('bookingsList');
    if (!bookingsList) return;

    bookingsList.innerHTML = '<p>Memuatkan tempahan anda...</p>';

    const result = await apiFetch('/bookings', 'GET');

    if (result && (result.status === true || result.status === 'success') && result.data && result.data.length > 0) {
        bookingsList.innerHTML = '';
        result.data.forEach(item => {
            const bookingId = item.booking_id || item.id;
            const isConfirmed = item.status === 'confirmed';
            
            // Jana QR code sekiranya backend tidak menghantar URL
            const qrUrl = item.qr_code_url || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=BOOKING-${bookingId}`;

            bookingsList.innerHTML += `
                <div class="booking-card">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${item.booking_code || 'BK-' + bookingId}</strong>
                        <span class="badge ${isConfirmed ? 'badge-confirmed' : 'badge-cancelled'}" 
                              style="padding: 4px 8px; border-radius: 4px; color: white; background-color: ${isConfirmed ? '#28a745' : '#dc3545'};">
                            ${item.status ? item.status.toUpperCase() : 'UNKNOWN'}
                        </span>
                    </div>
                    <h4 style="margin: 10px 0;">${item.event_title || 'Acara'}</h4>
                    <p>Tarikh: ${item.event_date || '-'}</p>
                    <p>Kuantiti: ${item.quantity} Tiket</p>
                    <p>Jumlah: <strong>RM ${parseFloat(item.total_amount || item.total_price || 0).toFixed(2)}</strong></p>
                    
                    ${isConfirmed ? `
                        <div style="text-align:center; margin: 10px 0;">
                            <img src="${qrUrl}" alt="QR Tiket" class="qr-img" style="width:120px; height:120px;">
                        </div>
                        <button type="button" class="btn-primary" style="background-color: #dc3545; color: white; border: none; width:100%; padding: 8px; border-radius: 4px; cursor: pointer;" 
                                onclick="cancelBooking(${bookingId})">
                            Batal Tempahan
                        </button>
                    ` : '<p style="color:#dc3545; font-size:13px; margin-top:10px;"><em>Tempahan telah dibatalkan.</em></p>'}
                </div>
            `;
        });
    } else {
        bookingsList.innerHTML = '<p>Anda belum membuat sebarang tempahan.</p>';
    }
}

// Fungsi Batal Tempahan
async function cancelBooking(bookingId) {
    if (!bookingId) {
        showToast('ID Tempahan tidak sah.', 'error');
        return;
    }

    if (!confirm('Adakah anda pasti mahu membatalkan tempahan ini? Tiket akan dikembalikan semula ke baki acara.')) return;

    try {
        console.log(`Memanggil API Pembatalan: /bookings/${bookingId}/cancel`);

        const result = await apiFetch(`/bookings/${bookingId}/cancel`, 'POST');
        console.log('Respons Backend Pembatalan:', result);

        if (result && (result.status === true || result.status === 'success')) {
            showToast('Tempahan berjaya dibatalkan.', 'success');
            await loadMyBookings();
        } else {
            showToast((result && result.message) || 'Gagal membatalkan tempahan.', 'error');
            setTimeout(() => {
                loadMyBookings();
            }, 1000);
        }
    } catch (err) {
        console.error('Cancel booking error:', err);
        showToast('Ralat rangkaian semasa membatalkan tempahan.', 'error');
    }
}

function openProfileModal() {
    const user = getUser();
    if (user) {
        const details = document.getElementById('profileDetails');
        if (details) {
            details.innerHTML = `
                <p style="margin-bottom:8px;"><strong>Nama Penuh:</strong> ${user.full_name}</p>
                <p style="margin-bottom:8px;"><strong>E-mel:</strong> ${user.email}</p>
                <p style="margin-bottom:8px;"><strong>Peranan Akaun:</strong> <span style="text-transform:capitalize;">${user.role}</span></p>
            `;
        }
        const modal = document.getElementById('profileModal');
        if (modal) modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}
