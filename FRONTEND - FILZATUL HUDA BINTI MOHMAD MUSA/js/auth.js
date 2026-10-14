
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginSpinner = document.getElementById("loginSpinner");
const loginAlert = document.getElementById("loginAlert");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

// Show or hide password
togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden ? "Hide" : "Show";

    togglePassword.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password"
    );
});

// Display English error messages
function showError(message) {
    loginAlert.textContent = message;
    loginAlert.classList.remove("d-none");
}

// Handle login form
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;

    loginAlert.classList.add("d-none");

    if (!email || !password) {
        showError("Please enter your email and password.");
        return;
    }

    loginBtn.disabled = true;
    loginBtnText.textContent = "Signing in...";
    loginSpinner.classList.remove("d-none");

    try {
        const response = await fetch(
            `${API_BASE_URL}/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.status) {
            if (response.status === 401) {
                throw new Error(
                    "Invalid email or password. Please try again."
                );
            }

            if (response.status === 400) {
                throw new Error(
                    "Please check your login details."
                );
            }

            throw new Error(
                "Unable to sign in. Please try again."
            );
        }

        const token = result.data?.token;
        const user = result.data?.user;

        if (!token || !user || !user.role) {
            throw new Error("Invalid authentication response.");
        }

        const destination = ROLE_PATHS[user.role];

        if (!destination) {
            throw new Error(
                "Your account role is not supported."
            );
        }

        // Store session for this browser tab.
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("user", JSON.stringify(user));

        // Redirect to the correct dashboard.
        window.location.replace(
            destination + "?v=" + Date.now()
        );

    } catch (error) {
        // Network errors and invalid JSON are also handled here.
        if (error instanceof TypeError ||
            error instanceof SyntaxError) {
            showError(
                "Unable to connect to the server. " +
                "Please check your connection."
            );
        } else {
            showError(error.message);
        }

    } finally {
        loginBtn.disabled = false;
        loginBtnText.textContent = "Sign In →";
        loginSpinner.classList.add("d-none");
    }
});
