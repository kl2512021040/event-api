// frontend/assets/js/api.js

const API_BASE_URL = 'http://localhost/event-api/backend';

// 1. Pengurusan Sesi (LocalStorage)
function setSession(token, user) {
    localStorage.setItem('jwt_token', token);
    localStorage.setItem('user_info', JSON.stringify(user));
}

function getToken() {
    return localStorage.getItem('jwt_token');
}

function getUser() {
    const user = localStorage.getItem('user_info');
    return user ? JSON.parse(user) : null;
}

function clearSession() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_info');
    window.location.href = 'login.html';
}

// 2. Halatuju Mengikut Peranan (Redirection Guard)
function redirectByUserRole(role) {
    if (role === 'customer') {
        window.location.href = 'customer.html';
    } else if (role === 'organiser') {
        window.location.href = 'organiser.html';
    } else if (role === 'admin' || role === 'super_admin') {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'login.html';
    }
}

// 3. Page Guard (Semak Akses Halaman secara Tunggal)
function checkAuth(allowedRoles = []) {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
        clearSession();
        return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        redirectByUserRole(user.role);
    }
}

// 4. Fetch Wrapper Berpusat
async function apiFetch(endpoint, method = 'GET', data = null) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();

        if (response.status === 401) {
            clearSession();
            return;
        }

        return result;
    } catch (error) {
        console.error('Error API Fetch:', error);
        return { status: false, message: 'Gagal merangkaikan permintaan ke pelayan backend.' };
    }
}

// 5. Toast Notification
function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.style.cssText = `
        background-color: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white; padding: 12px 20px; margin-bottom: 10px; border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: sans-serif; font-size: 14px;
        transition: opacity 0.5s ease;
    `;
    toast.innerText = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}