// Minh Chứng — screens [2]/[2b]: passkey registration/login, with Google
// used only to verify the email is real before creating/using the passkey.

const GOOGLE_CLIENT_ID = "477011472862-pcc371j0kpd2fe17a2unqujou7iffgr2.apps.googleusercontent.com";

const params = new URLSearchParams(location.search);
let mode = params.get("mode") === "login" ? "login" : "register";
const nextUrl = params.get("next") || "/wallet";

const modeTitle = document.getElementById("modeTitle");
const modeDesc = document.getElementById("modeDesc");
const emailInput = document.getElementById("email");
const emailError = document.getElementById("emailError");
const submitBtn = document.getElementById("submitBtn");
const submitLabel = document.getElementById("submitLabel");
const submitSpinner = document.getElementById("submitSpinner");
const errorNotice = document.getElementById("errorNotice");
const switchCopy = document.getElementById("switchCopy");
const switchModeBtn = document.getElementById("switchModeBtn");
const googleFallbackNote = document.getElementById("googleFallbackNote");

function render() {
  const registering = mode === "register";
  modeTitle.textContent = registering ? "Tạo tài khoản" : "Đăng nhập";
  modeDesc.textContent = registering
    ? "Xác minh email rồi tạo Passkey cho thiết bị này — không cần mật khẩu."
    : "Nhập email rồi dùng Passkey đã tạo trên thiết bị này để đăng nhập.";
  submitLabel.innerHTML = registering
    ? '<i class="ph ph-fingerprint"></i> Tạo Passkey'
    : '<i class="ph ph-fingerprint"></i> Đăng nhập bằng Passkey';
  switchCopy.textContent = registering ? "Đã có tài khoản?" : "Chưa có tài khoản?";
  switchModeBtn.textContent = registering ? "Đăng nhập" : "Tạo tài khoản";
  errorNotice.hidden = true;
  const nextParam = nextUrl === "/wallet" ? "" : `&next=${encodeURIComponent(nextUrl)}`;
  history.replaceState(null, "", `/auth?mode=${mode}${nextParam}`);
}

switchModeBtn.addEventListener("click", () => {
  mode = mode === "register" ? "login" : "register";
  render();
});

function showError(message) {
  errorNotice.hidden = false;
  errorNotice.textContent = message;
}

function setBusy(busy) {
  submitBtn.disabled = busy;
  submitLabel.hidden = busy;
  submitSpinner.hidden = !busy;
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorNotice.hidden = true;
  emailError.hidden = true;
  emailInput.removeAttribute("aria-invalid");

  const email = emailInput.value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.setAttribute("aria-invalid", "true");
    emailError.textContent = "Email không hợp lệ.";
    emailError.hidden = false;
    return;
  }

  setBusy(true);
  try {
    if (mode === "register") {
      const options = await apiPost("/api/auth/register/options", { email });
      const credential = await webauthnRegister(options);
      await apiPost("/api/auth/register/verify", { email, credential });
      await apiPost("/api/wallet/init");
    } else {
      const options = await apiPost("/api/auth/login/options", { email });
      const credential = await webauthnAuthenticate(options);
      await apiPost("/api/auth/login/verify", { email, credential });
    }
    location.href = nextUrl;
  } catch (err) {
    if (err.name === "NotAllowedError") {
      showError("Bạn đã huỷ thao tác Passkey, hoặc thiết bị từ chối yêu cầu.");
    } else {
      showError(err.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
    }
  } finally {
    setBusy(false);
  }
});

// ---------- Google (email verification only) ----------
async function onGoogleCredential(response) {
  try {
    const { email } = await apiPost("/api/auth/google/verify", { credential: response.credential });
    emailInput.value = email;
  } catch (err) {
    showError(err.message || "Không xác minh được email Google.");
  }
}

window.addEventListener("load", () => {
  if (!window.google || !google.accounts || !google.accounts.id) {
    googleFallbackNote.hidden = false;
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: onGoogleCredential,
  });
  google.accounts.id.renderButton(document.getElementById("googleBtnContainer"), {
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
    width: 320,
  });
});

render();
