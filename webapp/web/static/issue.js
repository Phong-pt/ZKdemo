// Minh Chứng — screens [5]/[6]/[7]/[9]: QR handoff, confirm OCR result,
// live issuance progress, rejection.

const screenQr = document.getElementById("screenQr");
const screenConfirm = document.getElementById("screenConfirm");
const screenProgress = document.getElementById("screenProgress");
const progressView = document.getElementById("progressView");
const rejectView = document.getElementById("rejectView");

let captureId = null;
let statusTimer = null;
let countdownTimer = null;

function showScreen(el) {
  [screenQr, screenConfirm, screenProgress].forEach((s) => (s.hidden = s !== el));
}

function truncate(value) {
  const s = String(value);
  return s.length > 20 ? s.slice(0, 20) + "…" : s;
}

// ---------- [5] QR wait ----------
const STATUS_LABELS = {
  waiting: "Chờ quét",
  opened: "Đã mở trên điện thoại",
  capturing: "Đang chụp",
  processing: "Đang xử lý ảnh",
  done: "Hoàn tất",
};

async function startQrFlow() {
  showScreen(screenQr);
  const session = await apiPost("/api/capture/session");
  captureId = session.capture_id;
  document.getElementById("qrImg").src = `/api/capture/${captureId}/qr.png`;

  let remaining = session.expires_in;
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    remaining -= 1;
    const m = String(Math.max(0, Math.floor(remaining / 60))).padStart(2, "0");
    const s = String(Math.max(0, remaining % 60)).padStart(2, "0");
    document.getElementById("qrCountdown").textContent = `${m}:${s}`;
    if (remaining <= 0) clearInterval(countdownTimer);
  }, 1000);

  clearInterval(statusTimer);
  statusTimer = setInterval(pollCaptureStatus, 2000);
  pollCaptureStatus();
}

async function pollCaptureStatus() {
  if (!captureId) return;
  try {
    const { status } = await apiGet(`/api/capture/${captureId}/status`);
    document.getElementById("captureStatusText").textContent = STATUS_LABELS[status] || status;
    if (status === "done") {
      clearInterval(statusTimer);
      clearInterval(countdownTimer);
      const result = await apiGet(`/api/capture/${captureId}/result`);
      fillConfirmForm(result);
      showScreen(screenConfirm);
    }
  } catch (err) {
    clearInterval(statusTimer);
    document.getElementById("captureStatusText").textContent = "Phiên quét đã hết hạn";
  }
}

document.getElementById("manualEntryBtn").addEventListener("click", () => {
  clearInterval(statusTimer);
  clearInterval(countdownTimer);
  captureId = null; // no capture session to confirm against — go straight to issuance
  fillConfirmForm({ cccd: "", name: "", dob: "", nationality: "", address: "" });
  showScreen(screenConfirm);
});

// ---------- [6] confirm ----------
function fillConfirmForm(attrs) {
  document.getElementById("f_cccd").value = attrs.cccd;
  document.getElementById("f_name").value = attrs.name;
  document.getElementById("f_dob").value = attrs.dob;
  document.getElementById("f_nationality").value = attrs.nationality;
  document.getElementById("f_address").value = attrs.address;
}

function readConfirmForm() {
  return {
    cccd: document.getElementById("f_cccd").value.trim(),
    name: document.getElementById("f_name").value.trim(),
    dob: document.getElementById("f_dob").value.trim(),
    nationality: document.getElementById("f_nationality").value.trim(),
    address: document.getElementById("f_address").value.trim(),
  };
}

document.getElementById("confirmForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const attributes = readConfirmForm();
  try {
    if (captureId) {
      await apiPost(`/api/capture/${captureId}/confirm`, attributes);
    }
    await startIssuance(attributes);
  } catch (err) {
    alert(err.message || "Không thể xác nhận. Vui lòng thử lại.");
  }
});

// ---------- [7]/[9] progress ----------
async function startIssuance(attributes) {
  progressView.hidden = false;
  rejectView.hidden = true;
  document.querySelectorAll(".progress-item").forEach((el) => el.classList.remove("done", "active"));
  showScreen(screenProgress);

  await apiPost("/api/issuance/start", attributes);

  const source = new EventSource("/api/issuance/stream", { withCredentials: true });
  source.onmessage = (event) => {
    const state = JSON.parse(event.data);
    applyProgress(state);
    if (state.finished) {
      source.close();
      if (state.error) {
        showReject(state.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
      } else {
        setTimeout(() => (location.href = "/wallet"), 700);
      }
    }
  };
  source.onerror = () => {
    source.close();
  };
}

function applyProgress(state) {
  const tech = state.tech || {};
  if (tech.u) document.getElementById("techU").textContent = tech.u;
  if (tech.c) document.getElementById("techC").textContent = tech.c;
  if (tech.a) document.getElementById("techA").textContent = tech.a;

  document.querySelectorAll(".progress-item").forEach((el) => {
    const step = Number(el.dataset.step);
    el.classList.remove("done", "active");
    const mark = el.querySelector(".mark");
    if (step < state.step || (step === state.step && state.done)) {
      el.classList.add("done");
      mark.innerHTML = '<i class="ph ph-check"></i>';
    } else if (step === state.step) {
      el.classList.add("active");
      mark.innerHTML = '<i class="ph ph-circle-notch"></i>';
    } else {
      mark.innerHTML = '<i class="ph ph-circle"></i>';
    }
  });
}

function showReject(message) {
  progressView.hidden = true;
  rejectView.hidden = false;
  document.getElementById("rejectMessage").textContent = message;
}

document.getElementById("retryBtn").addEventListener("click", () => {
  showScreen(screenConfirm);
});

startQrFlow();
