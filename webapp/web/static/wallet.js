// Minh Chứng — screens [4]/[8]: empty wallet vs. card with a credential.

const emptyState = document.getElementById("emptyState");
const cardState = document.getElementById("cardState");
const credCard = document.getElementById("credCard");
const credDetail = document.getElementById("credDetail");

function maskCccd(cccd) {
  const groups = cccd.match(/.{1,4}/g) || [cccd];
  return groups.map((g, i) => (i === 0 || i === groups.length - 1 ? g : "•".repeat(g.length))).join(" ");
}

function attrLabel(key) {
  return { cccd: "Số CCCD", name: "Họ tên", dob: "Ngày sinh", nationality: "Quốc tịch", address: "Địa chỉ" }[key] || key;
}

async function boot() {
  let me;
  try {
    me = await apiGet("/api/auth/me");
  } catch (err) {
    location.href = "/auth?mode=login";
    return;
  }

  document.getElementById("userEmail").textContent = me.email;

  if (!me.has_credential) {
    emptyState.hidden = false;
    return;
  }

  const cred = await apiGet("/api/wallet/credential");
  document.getElementById("cardSchema").textContent = cred.schema_name;
  document.getElementById("cardIssuer").textContent = cred.issuer_name;
  document.getElementById("cardName").textContent = cred.attributes.name;
  document.getElementById("cardNumber").textContent = maskCccd(cred.attributes.cccd);

  credDetail.innerHTML = Object.entries(cred.attributes)
    .map(
      ([key, value]) => `
        <div class="cred-detail-row">
          <span class="cred-detail-label">${attrLabel(key)}</span>
          <span class="cred-detail-value">${value}</span>
        </div>`
    )
    .join("");

  credCard.addEventListener("click", () => {
    credDetail.hidden = !credDetail.hidden;
  });

  cardState.hidden = false;
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await apiPost("/api/auth/logout");
  location.href = "/";
});

boot();
