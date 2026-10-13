// frontend/assets/js/api.js

const API_BASE_URL = 'http://localhost/event-api/backend/index.php';

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

// 3. Page Guard (Semak Akses Halaman)
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
        let result;

        try {
            result = await response.json();
        } catch (e) {
            result = { status: false, message: 'Format respons pelayan tidak sah.' };
        }

        if (response.status === 401 && endpoint !== '/auth/login') {
            clearSession();
            return { status: false, message: 'Sesi anda telah tamat. Sila log masuk semula.' };
        }

        if (!response.ok) {
            return {
                status: false,
                message: result.message || 'E-mel atau kata laluan tidak sah.'
            };
        }

        return result;
    } catch (error) {
        console.error('Error API Fetch:', error);
        return { 
            status: false, 
            message: 'Gagal merangkaikan permintaan ke pelayan backend. Pastikan Apache XAMPP berjalan.' 
        };
    }
}

// 5. Toast Notification (Direka agar sentiasa kelihatan di atas sekali)
function showToast(message, type = 'success') {
    // Paparkan juga pada elemen alertMessage dalam login.html jika ada
    const alertBox = document.getElementById('alertMessage');
    if (alertBox) {
        alertBox.innerText = message;
        alertBox.style.display = 'block';
        alertBox.style.padding = '12px 15px';
        alertBox.style.marginBottom = '15px';
        alertBox.style.borderRadius = '5px';
        alertBox.style.textAlign = 'center';
        alertBox.style.fontWeight = 'bold';
        
        if (type === 'error') {
            alertBox.style.backgroundColor = '#f8d7da';
            alertBox.style.color = '#721c24';
            alertBox.style.border = '1px solid #f5c6cb';
        } else {
            alertBox.style.backgroundColor = '#d4edda';
            alertBox.style.color = '#155724';
            alertBox.style.border = '1px solid #c3e6cb';
        }
    }

    // Paparkan Popup Toast terapung di sudut kanan atas
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 999999;';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.style.cssText = `
        background-color: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white; padding: 14px 22px; margin-bottom: 10px; border-radius: 6px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-family: Arial, sans-serif; font-size: 14px;
        font-weight: bold; transition: opacity 0.5s ease; display: block;
    `;
    toast.innerText = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}
