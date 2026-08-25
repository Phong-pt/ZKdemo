// Minh Chứng — respond to a presentation request from an independent
// Verifier site. The link that gets here looks like:
//   /present?verifier=<url-encoded verifier origin>&n_v=<nonce>
//
// Talks to the Verifier's own public API directly from the browser
// (cross-origin — the Verifier enables CORS for this); only the actual
// proof-building call goes to this app's own backend.

const ATTR_LABELS = { cccd: "Số CCCD", name: "Họ tên", dob: "Ngày sinh", nationality: "Quốc tịch", address: "Địa chỉ" };
const ALL_ATTRS = Object.keys(ATTR_LABELS);

const views = {
  loading: document.getElementById("loadingView"),
  error: document.getElementById("errorView"),
  noCred: document.getElementById("noCredView"),
  consent: document.getElementById("consentView"),
  done: document.getElementById("doneView"),
};

function showView(name) {
  Object.entries(views).forEach(([key, el]) => (el.hidden = key !== name));
}

function showError(message) {
  document.getElementById("errorMessage").textContent = message;
  showView("error");
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const verifierOrigin = params.get("verifier");
  const nV = params.get("n_v");

  if (!verifierOrigin || !nV) {
    showError("Đường dẫn không hợp lệ — thiếu thông tin yêu cầu.");
    return;
  }

  let me;
  try {
    me = await apiGet("/api/auth/me");
  } catch (err) {
    location.href = `/auth?mode=login&next=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }

  if (!me.has_credential) {
    showView("noCred");
    return;
  }

  let request;
  try {
    const res = await fetch(`${verifierOrigin}/api/check/${nV}`);
    if (!res.ok) throw new Error();
    request = await res.json();
  } catch (err) {
    showError("Yêu cầu đã hết hạn hoặc không còn tồn tại.");
    return;
  }

  const revealed = new Set(request.revealed_attrs || []);
  document.getElementById("verifierOrigin").textContent = request.verifier_name || verifierOrigin;
  document.getElementById("revealList").innerHTML = ALL_ATTRS.map((attr) => `
    <div class="cred-detail-row">
      <span class="cred-detail-label">${ATTR_LABELS[attr]}</span>
      <span class="cred-detail-value" style="color:${revealed.has(attr) ? "var(--accent-strong)" : "var(--text-tertiary)"}">
        ${revealed.has(attr) ? "Sẽ hiển thị" : "Giữ kín"}
      </span>
    </div>`).join("");

  showView("consent");

  document.getElementById("approveBtn").addEventListener("click", async () => {
    const approveBtn = document.getElementById("approveBtn");
    const approveLabel = document.getElementById("approveLabel");
    const approveSpinner = document.getElementById("approveSpinner");
    const submitError = document.getElementById("submitError");
    submitError.hidden = true;
    approveBtn.disabled = true;
    approveLabel.hidden = true;
    approveSpinner.hidden = false;

    try {
      const presentation = await apiPost("/api/present/build", {
        n_v: nV,
        revealed_attrs: Array.from(revealed),
      });
      const res = await fetch(`${verifierOrigin}/api/check/${nV}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentation }),
      });
      if (!res.ok) throw new Error("Bên xác minh từ chối nhận bằng chứng.");
      showView("done");
    } catch (err) {
      submitError.hidden = false;
      submitError.textContent = err.message || "Gửi thất bại. Vui lòng thử lại.";
      approveBtn.disabled = false;
      approveLabel.hidden = false;
      approveSpinner.hidden = true;
    }
  });
}

boot();
