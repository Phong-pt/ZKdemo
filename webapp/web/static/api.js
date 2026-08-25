// Minh Chứng — tiny fetch helpers. Every call sends the session cookie.

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return apiResult(res);
}

async function apiGet(path) {
  const res = await fetch(path, { credentials: "include" });
  return apiResult(res);
}

async function apiResult(res) {
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    const message = (data && data.detail) || "Đã xảy ra lỗi. Vui lòng thử lại.";
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
