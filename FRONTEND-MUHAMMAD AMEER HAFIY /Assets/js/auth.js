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
    const alertBox = document.getElementById('alertMessage');

    if (alertBox) alertBox.style.display = 'none';

    if (tab === 'login') {
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        if (tabs[0]) tabs[0].classList.add('active');
        if (tabs[1]) tabs[1].classList.remove('active');
    } else {
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        if (tabs[0]) tabs[0].classList.remove('active');
        if (tabs[1]) tabs[1].classList.add('active');
    }
}

// 3. Toggle Papar/Sembunyi Kata Laluan
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerText = 'Hide';
        } else {
            input.type = 'password';
            btn.innerText = 'Show';
        }
    }
}

// 4. Pengendali Log Masuk (Login)
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.onsubmit = async function (e) {
            e.preventDefault(); // HALANG PAGE RELOAD / RESET FORM

            const emailInput = document.getElementById('loginEmail');
            const passwordInput = document.getElementById('loginPassword');

            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value.trim() : '';

            if (!email || !password) {
                showToast('Sila masukkan e-mel dan kata laluan.', 'error');
                return false;
            }

            const result = await apiFetch('/auth/login', 'POST', { email, password });

            if (result && (result.status === true || result.status === 'success')) {
                showToast('Log masuk berjaya!', 'success');
                setSession(result.data.token, result.data.user);

                setTimeout(() => {
                    redirectByUserRole(result.data.user.role);
                }, 1000);
            } else {
                // Paparkan mesej ralat jika password salah & KEKALKAN teks input
                showToast(result.message || 'E-mel atau kata laluan tidak sah.', 'error');
            }

            return false;
        };
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async function (e) {
            e.preventDefault();

            const full_name = document.getElementById('regFullName') ? document.getElementById('regFullName').value.trim() : '';
            const email = document.getElementById('regEmail') ? document.getElementById('regEmail').value.trim() : '';
            const password = document.getElementById('regPassword') ? document.getElementById('regPassword').value.trim() : '';
            const role = document.getElementById('regRole') ? document.getElementById('regRole').value : 'customer';

            if (!full_name || !email || !password) {
                showToast('Sila lengkapkan semua maklumat pendaftaran.', 'error');
                return false;
            }

            const result = await apiFetch('/auth/register', 'POST', {
                full_name,
                email,
                password,
                role
            });

            if (result && (result.status === true || result.status === 'success')) {
                showToast('Pendaftaran berjaya! Sila log masuk.', 'success');
                registerForm.reset();
                switchTab('login');
            } else {
                showToast(result.message || 'Pendaftaran gagal.', 'error');
            }

            return false;
        };
    }
});
