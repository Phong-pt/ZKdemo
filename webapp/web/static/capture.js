// Minh Chứng — phone-side page opened via the QR code. No session cookie
// needed here (different device); the capture_id in the URL is the only
// authorization, matching how these desktop-to-phone handoff links usually
// work in the real thing.

const captureId = location.pathname.split("/").pop();

const captureForm = document.getElementById("captureForm");
const captureDone = document.getElementById("captureDone");
const captureExpired = document.getElementById("captureExpired");
const submitBtn = document.getElementById("submitPhotosBtn");
const submitLabel = document.getElementById("submitLabel");
const submitSpinner = document.getElementById("submitSpinner");
const captureError = document.getElementById("captureError");

async function markOpened() {
  try {
    await fetch(`/api/capture/${captureId}/opened`, { method: "POST" });
  } catch (err) {
    // non-fatal — the desktop side will just keep showing "Chờ quét"
  }
}

submitBtn.addEventListener("click", async () => {
  const front = document.getElementById("frontInput").files[0];
  const back = document.getElementById("backInput").files[0];
  captureError.hidden = true;

  if (!front || !back) {
    captureError.hidden = false;
    captureError.textContent = "Chọn đủ ảnh mặt trước và mặt sau.";
    return;
  }

  submitBtn.disabled = true;
  submitLabel.hidden = true;
  submitSpinner.hidden = false;

  try {
    const formData = new FormData();
    formData.append("front", front);
    formData.append("back", back);
    const res = await fetch(`/api/capture/${captureId}/photos`, { method: "POST", body: formData });
    if (!res.ok) {
      if (res.status === 404) {
        captureForm.hidden = true;
        captureExpired.hidden = false;
        return;
      }
      throw new Error("Gửi ảnh thất bại.");
    }
    captureForm.hidden = true;
    captureDone.hidden = false;
  } catch (err) {
    captureError.hidden = false;
    captureError.textContent = err.message || "Gửi ảnh thất bại. Thử lại.";
  } finally {
    submitBtn.disabled = false;
    submitLabel.hidden = false;
    submitSpinner.hidden = true;
  }
});

markOpened();
