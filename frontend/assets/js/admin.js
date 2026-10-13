// frontend/assets/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Semak kebenaran akses (Benarkan Admin & Super Admin)
    checkAuth(['admin', 'super_admin']);

    // 2. Paparkan nama & role user dalam Navbar
    const user = getUser();
    if (user) {
        document.getElementById('navUserName').innerText = `Hai, ${user.full_name} (${user.role.toUpperCase()})`;
    }

    // 3. Load senarai pengguna
    loadUsers();
});

function switchAdminTab(tab) {
    const sectionUsers = document.getElementById('sectionUsers');
    const sectionBookings = document.getElementById('sectionBookings');
    const tabs = document.querySelectorAll('.tab-btn');

    if (tab === 'users') {
        sectionUsers.style.display = 'block';
        sectionBookings.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
        loadUsers();
    } else {
        sectionUsers.style.display = 'none';
        sectionBookings.style.display = 'block';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
        loadAllBookings();
    }
}

// -------------------------------------------------------------
// 1. MEMUATKAN SENARAI PENGGUNA (USERS)
// -------------------------------------------------------------
async function loadUsers() {
    const usersTable = document.getElementById('usersTable');
    usersTable.innerHTML = '<tr><td colspan="5">Memuatkan pengguna...</td></tr>';

    const result = await apiFetch('/users', 'GET');

    if (result && result.status && result.data.length > 0) {
        usersTable.innerHTML = '';
        result.data.forEach(u => {
            let badgeClass = 'badge-customer';
            if (u.role === 'super_admin') badgeClass = 'badge-super_admin';
            else if (u.role === 'admin') badgeClass = 'badge-admin';
            else if (u.role === 'organiser') badgeClass = 'badge-organiser';

            usersTable.innerHTML += `
                <tr>
                    <td>${u.user_id}</td>
                    <td><strong>${u.full_name}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge ${badgeClass}">${u.role.toUpperCase()}</span></td>
                    <td>${u.created_at || '-'}</td>
                </tr>
            `;
        });
    } else {
        usersTable.innerHTML = '<tr><td colspan="5">Tiada pengguna dijumpai.</td></tr>';
    }
}

// -------------------------------------------------------------
// 2. MEMUATKAN KESELURUHAN TEMPAHAN (ALL BOOKINGS)
// -------------------------------------------------------------
async function loadAllBookings() {
    const bookingsTable = document.getElementById('allBookingsTable');
    bookingsTable.innerHTML = '<tr><td colspan="6">Memuatkan senarai tempahan...</td></tr>';

    const result = await apiFetch('/bookings', 'GET');

    if (result && result.status && result.data.length > 0) {
        bookingsTable.innerHTML = '';
        result.data.forEach(b => {
            const isConfirmed = b.status === 'confirmed';
            bookingsTable.innerHTML += `
                <tr>
                    <td><strong>${b.booking_code}</strong></td>
                    <td>${b.customer_name || 'N/A'}</td>
                    <td>${b.event_title || 'N/A'}</td>
                    <td>${b.quantity} Tiket</td>
                    <td>RM ${parseFloat(b.total_amount).toFixed(2)}</td>
                    <td>
                        <span class="badge ${isConfirmed ? 'badge-organiser' : 'badge-admin'}">
                            ${b.status.toUpperCase()}
                        </span>
                    </td>
                </tr>
            `;
        });
    } else {
        bookingsTable.innerHTML = '<tr><td colspan="6">Tiada rekod tempahan dalam sistem.</td></tr>';
    }
}

// -------------------------------------------------------------
// 3. FUNGSI CIPTA AKAUN PENGGUNA OLEH ADMIN / SUPER ADMIN
// -------------------------------------------------------------
function openCreateOrganiserModal() {
    const user = getUser();
    const roleSelect = document.getElementById('userRoleSelect');

    if (user.role !== 'super_admin') {
        roleSelect.value = 'organiser';
        document.getElementById('roleSelectGroup').style.display = 'none';
        document.getElementById('modalUserTitle').innerText = 'Daftarkan Akaun Organiser';
    } else {
        document.getElementById('roleSelectGroup').style.display = 'block';
        document.getElementById('modalUserTitle').innerText = 'Daftarkan Akaun Pengguna (Super Admin)';
    }

    document.getElementById('createOrganiserModal').style.display = 'flex';
}

document.getElementById('createOrganiserForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const full_name = document.getElementById('orgFullName').value.trim();
    const email = document.getElementById('orgEmail').value.trim();
    const password = document.getElementById('orgPassword').value.trim();

    const user = getUser();
    const role = (user.role === 'super_admin') 
        ? document.getElementById('userRoleSelect').value 
        : 'organiser';

    const result = await apiFetch('/auth/register', 'POST', {
        full_name,
        email,
        password,
        role
    });

    if (result && result.status) {
        showToast(`Akaun ${role.toUpperCase()} berjaya dicipta!`, 'success');
        document.getElementById('createOrganiserForm').reset();
        closeModal('createOrganiserModal');
        loadUsers();
    } else {
        showToast((result && result.message) || 'Gagal mencipta akaun.', 'error');
    }
});

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