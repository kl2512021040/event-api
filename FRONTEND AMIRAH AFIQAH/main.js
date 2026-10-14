
"use strict";

const API_BASE = "./backend";

const flipCard = document.getElementById("flip-card");
const loginFace = document.getElementById("login-face");
const registerFace = document.getElementById("register-face");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

function showFeedback(id, message, type = "error") {
  const element = document.getElementById(id);
  element.textContent = message;
  element.className = "feedback " + type;
  element.hidden = false;
}

function clearFeedback() {
  document.querySelectorAll(".feedback").forEach(element => {
    element.hidden = true;
    element.textContent = "";
  });
}

function flipTo(register) {
  clearFeedback();

  flipCard.classList.toggle("flipped", register);
  loginFace.inert = register;
  registerFace.inert = !register;
}

document.getElementById("show-register")
  .addEventListener("click", () => flipTo(true));

document.getElementById("show-login")
  .addEventListener("click", () => flipTo(false));

async function apiRequest(endpoint, payload) {
  const response = await fetch(API_BASE + endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Unable to read API response. Please check XAMPP.");
  }

  if (!response.ok || result.status !== true) {
    throw new Error(result.message || "Request failed.");
  }

  return result;
}

function redirectUser(role) {
  const destinations = {
    customer: "frontend/customer-booking/index.html",
    organiser: "frontend/organiser/index.html",
    admin: "frontend/admin/index.html"
  };

  if (!destinations[role]) {
    showFeedback("login-feedback", "Unknown user role.");
    return;
  }

  window.location.assign(destinations[role]);
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearFeedback();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const button = document.getElementById("login-button");

  button.disabled = true;
  button.textContent = "Signing in...";

  try {
    const result = await apiRequest("/auth/login", {
      email,
      password
    });

    const token = result.data?.token;
    const user = result.data?.user;

    if (!token || !user?.role) {
      throw new Error("Invalid login response.");
    }

    sessionStorage.setItem("authToken", token);
    sessionStorage.setItem("currentUser", JSON.stringify(user));

    redirectUser(user.role);

  } catch (error) {
    showFeedback("login-feedback", error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Sign In →";
  }
});

registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearFeedback();

  const full_name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const role = document.getElementById("register-role").value;
  const button = document.getElementById("register-button");

  button.disabled = true;
  button.textContent = "Creating account...";

  try {
    await apiRequest("/auth/register", {
      full_name,
      email,
      password,
      role
    });

    loginForm.reset();
    document.getElementById("login-email").value = email;

    flipTo(false);

    showFeedback(
      "login-feedback",
      "Account created successfully! Please sign in.",
      "success"
    );

  } catch (error) {
    showFeedback("register-feedback", error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Create Account →";
  }
});
