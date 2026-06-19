const registerForm = document.querySelector("[data-register-form]");
const toast = document.querySelector("[data-toast]");

function showToast(message) {
  if (!toast) {
    console.warn(message);
    return;
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

try {
  if (window.VelyxStore.getCurrentUser()) {
    window.location.replace("app.html");
  }
} catch (error) {
  showToast(error.message);
}

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  document.body.classList.add("is-loading");

  try {
    window.VelyxStore.createUser({
      name: registerForm.name.value,
      email: registerForm.email.value,
      password: registerForm.password.value
    });
    window.location.href = "app.html";
  } catch (error) {
    showToast(error.message);
  } finally {
    document.body.classList.remove("is-loading");
  }
});
