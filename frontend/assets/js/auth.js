// frontend/assets/js/auth.js

// 1. Semak jika pengguna sudah mempunyai sesi aktif
document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    const token = getToken();

    if (token && user) {
        redirectByUserRole(user.role);
    }
});

// 2. Tukar Tab antara Log Masuk & Daftar
function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.tab-btn');

    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
}

// 3. Toggle Papar/Sembunyi Kata Laluan
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerText = 'Hide';
    } else {
        input.type = 'password';
        btn.innerText = 'Show';
    }
}

// 4. Pengendali Borang Log Masuk (Login)
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !password) {
        showToast('Sila masukkan e-mel dan kata laluan.', 'error');
        return;
    }

    const result = await apiFetch('/auth/login', 'POST', { email, password });

    if (result.status) {
        showToast('Log masuk berjaya!', 'success');
        
        setSession(result.data.token, result.data.user);

        setTimeout(() => {
            redirectByUserRole(result.data.user.role);
        }, 1000);
    } else {
        showToast(result.message || 'Log masuk gagal.', 'error');
    }
});

// 5. Pengendali Borang Pendaftaran Awam (Customer)
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const full_name = document.getElementById('regFullName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const role = document.getElementById('regRole').value;

    if (!full_name || !email || !password) {
        showToast('Sila lengkapkan semua maklumat pendaftaran.', 'error');
        return;
    }

    const result = await apiFetch('/auth/register', 'POST', {
        full_name,
        email,
        password,
        role
    });

    if (result.status) {
        showToast('Pendaftaran berjaya! Sila log masuk.', 'success');
        document.getElementById('registerForm').reset();
        switchTab('login');
    } else {
        showToast(result.message || 'Pendaftaran gagal.', 'error');
    }
});