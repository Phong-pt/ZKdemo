// Trạm Xác Minh — staff-facing single page: create a check, watch it
// resolve, show the result. All state lives server-side keyed by n_v.

const ATTR_LABELS = { cccd: "Số CCCD", name: "Họ tên", dob: "Ngày sinh", nationality: "Quốc tịch", address: "Địa chỉ" };

const createView = document.getElementById("createView");
const checkView = document.getElementById("checkView");
const resultView = document.getElementById("resultView");

let pollTimer = null;
let currentNv = null;

function showView(el) {
  [createView, checkView, resultView].forEach((v) => (v.hidden = v !== el));
}

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.detail) || "Đã xảy ra lỗi.");
  return data;
}

document.getElementById("createBtn").addEventListener("click", async () => {
  const revealed = Array.from(document.querySelectorAll("#checkList input:checked")).map((el) => el.value);
  const createBtn = document.getElementById("createBtn");
  const createLabel = document.getElementById("createLabel");
  const createSpinner = document.getElementById("createSpinner");
  const createError = document.getElementById("createError");
  createError.hidden = true;

  if (revealed.length === 0) {
    createError.hidden = false;
    createError.textContent = "Chọn ít nhất một trường.";
    return;
  }

  createBtn.disabled = true;
  createLabel.hidden = true;
  createSpinner.hidden = false;

  try {
    const data = await api("/api/check/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revealed_attrs: revealed }),
    });
    currentNv = data.n_v;
    document.getElementById("qrImg").src = `/api/check/${currentNv}/qr.png`;
    document.getElementById("linkInput").value = data.wallet_link;
    document.getElementById("statusText").textContent = "Đang chờ quét...";
    showView(checkView);
    pollTimer = setInterval(pollStatus, 2000);
  } catch (err) {
    createError.hidden = false;
    createError.textContent = err.message;
  } finally {
    createBtn.disabled = false;
    createLabel.hidden = false;
    createSpinner.hidden = true;
  }
});

async function pollStatus() {
  if (!currentNv) return;
  try {
    const data = await api(`/api/check/${currentNv}/status`);
    if (data.status === "waiting") return;

    clearInterval(pollTimer);
    showResult(data.status === "done", data.result);
  } catch (err) {
    clearInterval(pollTimer);
    document.getElementById("statusText").textContent = "Yêu cầu đã hết hạn.";
  }
}

function showResult(ok, result) {
  const icon = document.getElementById("resultIcon");
  const title = document.getElementById("resultTitle");
  const desc = document.getElementById("resultDesc");
  const card = document.getElementById("resultCard");

  if (ok) {
    icon.innerHTML = '<i class="ph ph-check-circle"></i>';
    icon.style.color = "var(--accent)";
    icon.style.background = "var(--accent-soft)";
    icon.style.borderColor = "var(--accent-border)";
    title.textContent = "Hợp lệ";
    desc.textContent = "Bằng chứng khớp với credential đã được Issuer ký. Các trường dưới đây do người dùng đồng ý tiết lộ.";
    card.innerHTML = Object.entries(result || {})
      .map(([key, value]) => `
        <div class="result-row">
          <span class="result-label">${ATTR_LABELS[key] || key}</span>
          <span class="result-value">${value}</span>
        </div>`)
      .join("") || `<div class="result-row"><span class="result-label">Không có trường nào được tiết lộ</span></div>`;
  } else {
    icon.innerHTML = '<i class="ph ph-x-circle"></i>';
    icon.style.color = "var(--danger)";
    icon.style.background = "rgba(229,118,106,0.14)";
    icon.style.borderColor = "rgba(229,118,106,0.32)";
    title.textContent = "Không hợp lệ";
    desc.textContent = "Bằng chứng không khớp, hoặc người dùng đã từ chối / huỷ trình diện.";
    card.innerHTML = "";
  }

  showView(resultView);
}

document.getElementById("copyLinkBtn").addEventListener("click", () => {
  const input = document.getElementById("linkInput");
  input.select();
  navigator.clipboard.writeText(input.value).catch(() => {});
});

document.getElementById("cancelBtn").addEventListener("click", () => {
  clearInterval(pollTimer);
  currentNv = null;
  showView(createView);
});

document.getElementById("newCheckBtn").addEventListener("click", () => {
  currentNv = null;
  showView(createView);
});
