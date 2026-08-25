// Minh Chứng — sign in / register demo screen.
//
// Email/password is client-side only: stored (obfuscated, not real
// security) in localStorage purely to preview the flow.
//
// Google sign-in is wired to real Google Identity Services, but stays
// inert until GOOGLE_CLIENT_ID below is filled in with a real OAuth
// Client ID (see docs/README-google-oauth.md for the setup steps).

(function () {
  var GOOGLE_CLIENT_ID = ""; // TODO: dán OAuth Client ID thật vào đây
  var STORAGE_KEY = "mc_account_demo";

  var subtitle = document.getElementById("unlockSubtitle");
  var googleBtn = document.getElementById("googleBtn");
  var googleNote = document.getElementById("googleNote");

  var form = document.getElementById("unlockForm");
  var email = document.getElementById("email");
  var emailError = document.getElementById("emailError");
  var changeEmailBtn = document.getElementById("changeEmailBtn");
  var passwordWrap = document.getElementById("passwordWrap");
  var password = document.getElementById("password");
  var passwordError = document.getElementById("passwordError");
  var confirmWrap = document.getElementById("confirmWrap");
  var confirmPassword = document.getElementById("confirmPassword");
  var confirmError = document.getElementById("confirmError");
  var submitBtn = document.getElementById("unlockSubmit");
  var submitLabel = submitBtn.querySelector(".btn-label");
  var spinner = submitBtn.querySelector(".spinner");
  var forgotBtn = document.getElementById("forgotBtn");
  var forgotNote = document.getElementById("forgotNote");
  var switchModeBtn = document.getElementById("switchModeBtn");
  var switchCopy = document.getElementById("switchCopy");
  var unlockAuth = document.getElementById("unlockAuth");
  var unlockSuccess = document.getElementById("unlockSuccess");
  var successTitle = document.getElementById("successTitle");
  var successDesc = document.querySelector(".unlock-success-desc");

  var mode = "login"; // "login" | "register"
  var step = "email"; // "email" | "password" (register always shows both at once)

  function render() {
    var registering = mode === "register";
    var showPassword = registering || step === "password";

    subtitle.textContent = registering
      ? "Tạo tài khoản để dùng thử ví danh tính"
      : "Đăng nhập để dùng thử ví danh tính";

    email.disabled = !registering && step === "password";
    changeEmailBtn.hidden = registering || step === "email";

    passwordWrap.hidden = !showPassword;
    confirmWrap.hidden = !registering;
    forgotBtn.hidden = registering || step === "email";

    if (registering) {
      submitLabel.textContent = "Tạo tài khoản";
    } else if (step === "email") {
      submitLabel.textContent = "Tiếp tục";
    } else {
      submitLabel.textContent = "Đăng nhập";
    }

    password.setAttribute(
      "autocomplete",
      registering ? "new-password" : "current-password"
    );

    switchCopy.textContent = registering ? "Đã có tài khoản?" : "Chưa có tài khoản?";
    switchModeBtn.textContent = registering ? "Đăng nhập" : "Tạo tài khoản";

    clearErrors();
  }

  function clearErrors() {
    [email, password, confirmPassword].forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
    emailError.hidden = true;
    passwordError.hidden = true;
    confirmError.hidden = true;
  }

  function showError(input, errorEl, message) {
    input.setAttribute("aria-invalid", "true");
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function showSuccess(title, desc) {
    successTitle.textContent = title;
    if (desc) successDesc.textContent = desc;
    unlockAuth.hidden = true;
    unlockSuccess.hidden = false;
  }

  changeEmailBtn.addEventListener("click", function () {
    step = "email";
    password.value = "";
    render();
    email.focus();
  });

  switchModeBtn.addEventListener("click", function () {
    mode = mode === "register" ? "login" : "register";
    step = "email";
    password.value = "";
    confirmPassword.value = "";
    render();
  });

  forgotBtn.addEventListener("click", function () {
    forgotNote.hidden = !forgotNote.hidden;
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    var mail = email.value.trim();
    if (!isValidEmail(mail)) {
      showError(email, emailError, "Email không hợp lệ.");
      return;
    }

    // Step 1 of the login flow: just reveal the password field.
    if (mode === "login" && step === "email") {
      step = "password";
      render();
      password.focus();
      return;
    }

    var pwd = password.value;
    var valid = true;

    if (pwd.length < 6) {
      showError(password, passwordError, "Mật khẩu cần ít nhất 6 ký tự.");
      valid = false;
    }

    if (mode === "register") {
      if (confirmPassword.value !== pwd) {
        showError(confirmPassword, confirmError, "Mật khẩu nhập lại không khớp.");
        valid = false;
      }
    } else if (valid) {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || mail !== saved.email || btoa(pwd) !== saved.password) {
        showError(password, passwordError, "Email hoặc mật khẩu không đúng.");
        valid = false;
      }
    }

    if (!valid) return;

    submitBtn.disabled = true;
    spinner.hidden = false;

    window.setTimeout(function () {
      submitBtn.disabled = false;
      spinner.hidden = true;

      if (mode === "register") {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ email: mail, password: btoa(pwd) })
        );
        showSuccess(
          "Tài khoản đã được tạo",
          "Đây là giao diện minh họa. Ứng dụng thực chạy cục bộ bằng mã nguồn Python trong repo, không đồng bộ với trang này."
        );
      } else {
        showSuccess(
          "Đã đăng nhập",
          "Đây là giao diện minh họa. Ứng dụng thực chạy cục bộ bằng mã nguồn Python trong repo, không đồng bộ với trang này."
        );
      }
    }, 500);
  });

  // ---------- Google sign-in ----------
  // Uses the OAuth2 implicit token flow (google.accounts.oauth2), which is
  // the variant meant to be triggered from a custom-styled button rather
  // than Google's own rendered widget.
  var googleTokenClient = null;

  function initGoogle() {
    if (!GOOGLE_CLIENT_ID || !window.google || !window.google.accounts) return;
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "email profile",
      callback: handleGoogleToken,
    });
  }

  function handleGoogleToken(response) {
    if (!response || !response.access_token) return;
    fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + response.access_token },
    })
      .then(function (r) { return r.json(); })
      .then(function (profile) {
        showSuccess(
          "Đã đăng nhập bằng Google",
          "Xin chào " + (profile.name || profile.email) + ". Đây vẫn là bản xem trước tĩnh, chưa nối với ứng dụng Python thật."
        );
      })
      .catch(function () {
        googleNote.hidden = false;
      });
  }

  googleBtn.addEventListener("click", function () {
    if (googleTokenClient) {
      googleTokenClient.requestAccessToken();
    } else {
      googleNote.hidden = !googleNote.hidden;
    }
  });

  window.addEventListener("load", initGoogle);

  render();
})();
