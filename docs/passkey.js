// Minh Chứng — Passkey gate.
//
// Real WebAuthn (navigator.credentials), no server: this page cannot verify
// the cryptographic signature the way a real backend would, so it only
// proves "this device's authenticator approved it", not a fully verified
// remote login. Good enough for a static preview, not for production.
//
// Model: 1 email == 1 profile == 1 passkey == 1 link secret, all scoped to
// this browser/device. Losing the passkey (new device, cleared site data)
// means that profile can never be reopened — mirrors the Holder wallet's
// "local-only, no recovery" story from the main app.

(function () {
  var STORAGE_PREFIX = "mc_passkey_";

  var subtitle = document.getElementById("pkSubtitle");
  var states = {
    noEmail: document.getElementById("stateNoEmail"),
    unsupported: document.getElementById("stateUnsupported"),
    register: document.getElementById("stateRegister"),
    verify: document.getElementById("stateVerify"),
    unlocked: document.getElementById("stateUnlocked"),
  };

  function showState(name, subtitleText) {
    Object.keys(states).forEach(function (key) {
      states[key].hidden = key !== name;
    });
    if (subtitleText) subtitle.textContent = subtitleText;
  }

  function getEmail() {
    var params = new URLSearchParams(location.search);
    var fromQuery = params.get("email");
    if (fromQuery) {
      sessionStorage.setItem("mc_current_email", fromQuery);
      return fromQuery;
    }
    return sessionStorage.getItem("mc_current_email");
  }

  function storageKey(email) {
    return STORAGE_PREFIX + email.trim().toLowerCase();
  }

  function loadRecord(email) {
    var raw = localStorage.getItem(storageKey(email));
    return raw ? JSON.parse(raw) : null;
  }

  function saveRecord(email, record) {
    localStorage.setItem(storageKey(email), JSON.stringify(record));
  }

  // ---------- byte helpers ----------
  function randomBytes(len) {
    var arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return arr;
  }
  function bytesToHex(bytes) {
    return Array.prototype.map
      .call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); })
      .join("");
  }
  function bufToBase64url(buf) {
    var bytes = new Uint8Array(buf);
    var str = "";
    for (var i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function base64urlToBuf(b64url) {
    var b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    var str = atob(b64);
    var bytes = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
    return bytes.buffer;
  }
  function maskSecret(hex) {
    return hex.slice(0, 6) + "…" + hex.slice(-6);
  }

  // ---------- WebAuthn ----------
  function createPasskey(email) {
    var publicKey = {
      challenge: randomBytes(32),
      rp: { name: "Minh Chứng", id: location.hostname },
      user: { id: randomBytes(16), name: email, displayName: email },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      timeout: 60000,
      attestation: "none",
    };
    return navigator.credentials.create({ publicKey: publicKey });
  }

  function verifyPasskey(credentialIdB64url) {
    var publicKey = {
      challenge: randomBytes(32),
      allowCredentials: [{ type: "public-key", id: base64urlToBuf(credentialIdB64url) }],
      userVerification: "required",
      timeout: 60000,
    };
    return navigator.credentials.get({ publicKey: publicKey });
  }

  function unlockProfile(email, linkSecret) {
    document.getElementById("profileEmail").textContent = email;
    document.getElementById("profileSecret").textContent = maskSecret(linkSecret);
    showState("unlocked", "Hồ sơ đã sẵn sàng");
  }

  // ---------- boot ----------
  var email = getEmail();

  if (!window.PublicKeyCredential) {
    showState("unsupported", "Không hỗ trợ Passkey");
    return;
  }

  if (!email) {
    showState("noEmail", "Chưa xác định hồ sơ");
    return;
  }

  var record = loadRecord(email);

  if (!record) {
    document.getElementById("registerEmail").textContent = email;
    showState("register", "Thiết lập Passkey cho hồ sơ mới");

    var createBtn = document.getElementById("createPasskeyBtn");
    var createSpinner = createBtn.querySelector(".spinner");
    var createLabel = createBtn.querySelector(".btn-label");
    var registerError = document.getElementById("registerError");

    createBtn.addEventListener("click", function () {
      registerError.hidden = true;
      createBtn.disabled = true;
      createLabel.hidden = true;
      createSpinner.hidden = false;

      createPasskey(email)
        .then(function (credential) {
          var linkSecret = bytesToHex(randomBytes(16));
          saveRecord(email, {
            credentialId: bufToBase64url(credential.rawId),
            linkSecret: linkSecret,
            createdAt: new Date().toISOString(),
          });
          unlockProfile(email, linkSecret);
        })
        .catch(function (err) {
          registerError.hidden = false;
          registerError.textContent =
            "Không tạo được Passkey (" + (err && err.name ? err.name : "lỗi không rõ") + "). Thử lại nhé.";
        })
        .finally(function () {
          createBtn.disabled = false;
          createLabel.hidden = false;
          createSpinner.hidden = true;
        });
    });
  } else {
    document.getElementById("verifyEmail").textContent = email;
    showState("verify", "Xác thực Passkey");

    var verifyBtn = document.getElementById("verifyPasskeyBtn");
    var verifySpinner = verifyBtn.querySelector(".spinner");
    var verifyLabel = verifyBtn.querySelector(".btn-label");
    var verifyError = document.getElementById("verifyError");

    verifyBtn.addEventListener("click", function () {
      verifyError.hidden = true;
      verifyBtn.disabled = true;
      verifyLabel.hidden = true;
      verifySpinner.hidden = false;

      verifyPasskey(record.credentialId)
        .then(function () {
          unlockProfile(email, record.linkSecret);
        })
        .catch(function (err) {
          verifyError.hidden = false;
          verifyError.textContent =
            "Xác thực thất bại (" + (err && err.name ? err.name : "lỗi không rõ") + "). Nếu đây không phải thiết bị đã tạo Passkey, hồ sơ này không thể mở lại.";
        })
        .finally(function () {
          verifyBtn.disabled = false;
          verifyLabel.hidden = false;
          verifySpinner.hidden = true;
        });
    });

    document.getElementById("resetProfileBtn").addEventListener("click", function () {
      localStorage.removeItem(storageKey(email));
      sessionStorage.removeItem("mc_current_email");
      location.href = "unlock.html";
    });
  }
})();
