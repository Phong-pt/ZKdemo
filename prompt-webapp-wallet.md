# Đặc tả Webapp Wallet — Prompt cho AI code

Tài liệu này mô tả tầng ứng dụng. Phần lõi mật mã (`issuer.py`, `wallet.py`, `verifier.py`, `common.py`) đã hoàn thiện và **không được sửa** — chỉ gọi vào.

---

## PHẦN A — Mô hình dữ liệu

### A.1 Cái gì lưu ở đâu

| Dữ liệu | Nơi lưu | Vòng đời |
|---|---|---|
| Passkey credential ID | Server, bảng `users` | Vĩnh viễn |
| Email | Server, bảng `users` | Vĩnh viễn |
| Link secret | `wallets/{user_id}/link_secret.json` | Vĩnh viễn — mất là mọi credential vô dụng |
| Credential `{a, e, v}` | `wallets/{user_id}/credential.json` | Vĩnh viễn |
| **Attribute values** | `wallets/{user_id}/attributes.json` | **Vĩnh viễn — BẮT BUỘC giữ** |
| `v_prime`, `ls` tạm | `wallets/{user_id}/pending_request.json` | Xóa sau khi giải mù xong |
| Ảnh CCCD | RAM hoặc `/tmp` | **Xóa ngay sau OCR** |
| Kết quả OCR | Capture session | Xóa khi session hết hạn hoặc dùng xong |
| Nonce issuance | SQLite `pending_nonces` | Xóa sau khi ký, TTL 600s |

### A.2 Chính sách xóa dữ liệu

**PHẢI xóa:**
- Ảnh CCCD hai mặt — ngay sau khi OCR xong, không ghi ra đĩa nếu tránh được
- Capture session (chứa kết quả OCR) — sau khi người dùng xác nhận
- `pending_request.json` — sau khi `unblind_signature` thành công
- Nonce phía issuer — sau khi `sign_blindly` xong

**KHÔNG được xóa:**
- `attributes.json` — `create_presentation` cần chúng để tính `∏ Rᵢ^mᵢ`. Xóa đi thì credential không dùng được nữa. Đây là dữ liệu **của người dùng, trên máy người dùng** — không phải dữ liệu tạm.
- `link_secret.json` — không có cơ chế khôi phục

**Issuer KHÔNG được lưu:** `u`, `proof`, credential đã ký, hay bất kỳ giá trị nào cho phép nhận diện credential sau này. Chỉ lưu cờ `credential_issued` trên bản ghi CCCD.

### A.3 Ràng buộc quan hệ

```
1 passkey  ─ 1:1 ─  1 user_id  ─ 1:1 ─  1 link secret
                                              │
                                            1:n
                                              │
                                        n credential
```

Link secret dùng cho **mọi** credential của user đó — đây là thiết kế AnonCreds, không được code chết thành 1:1 với CCCD.

Ràng buộc "một CCCD chỉ cấp một lần" nằm ở **phía issuer** (`credential_issued` trong `ekyc_db`), không phải ở wallet.

---

## PHẦN B — Luồng màn hình

### B.1 Sơ đồ

```
[1] Landing
     ├─ "Tạo tài khoản" ──► [2] Đăng ký passkey ──► [3] Khởi tạo ví ──┐
     └─ "Đăng nhập"     ──► [2b] Xác thực passkey ──────────────────► │
                                                                      ▼
                                                              [4] Ví (trống)
                                                                      │
                                                    "Tạo credential"  │
                                                                      ▼
                                                              [5] Chờ quét QR
                                                                      │
                                                       (điện thoại chụp)
                                                                      ▼
                                                              [6] Xác nhận thông tin
                                                                      │
                                                                      ▼
                                                              [7] Đang cấp credential
                                                                      │
                                                        ┌─────────────┴─────────────┐
                                                        ▼                           ▼
                                                 [8] Ví (có thẻ)              [9] Từ chối
```

### B.2 Chi tiết từng màn hình

**[1] Landing** — hai nút, không có form nhập gì.

**[2] Đăng ký passkey** — nhập email → gọi WebAuthn `navigator.credentials.create()` → lưu `{email, credential_id}`. Email chỉ là nhãn hiển thị, không gửi mail xác thực.

**[3] Khởi tạo ví** — gọi `POST /wallet/init`, sinh link secret.

> **Lưu ý về thời gian:** sinh link secret 256-bit mất **dưới 1ms**. KHÔNG tạo màn hình chờ giả. Nếu muốn có khoảnh khắc chuyển tiếp, dùng animation ngắn (300-500ms) và ghi đúng: *"Đang khởi tạo ví"*. Không viết *"Đang sinh khóa mật mã, vui lòng đợi"* — đó là nói dối người dùng.

**[4] Ví trống**
- Góc trái trên: email người dùng
- Giữa: khu vực trống với đường viền đứt nét, chữ *"Chưa có credential nào"*
- Nút chính: *"Xác thực CCCD để nhận credential"*
- Banner cố định dưới cùng: *"Demo mô phỏng — link secret hiện lưu tại server. Bản ứng dụng di động sẽ giữ trong Android Keystore."*

**[5] Chờ quét QR**
- QR lớn giữa màn hình, chứa URL capture
- Đếm ngược 5 phút
- Trạng thái realtime (poll 2s): `Chờ quét` → `Đã mở trên điện thoại` → `Đang chụp` → `Đang xử lý ảnh`
- Nút "Nhập tay thay thế" luôn hiện — phương án dự phòng nếu OCR/camera lỗi

**[6] Xác nhận thông tin**
- 5 ô text điền sẵn kết quả OCR, **cho phép sửa**
- Nếu MRZ báo lệch với mặt trước: viền vàng + chú thích ở ô tương ứng
- Nút "Xác nhận và tạo credential"

> **Bắt buộc có bước này.** `find_ekyc_record` so khớp chuỗi chính xác từng ký tự kể cả dấu tiếng Việt — OCR sai một dấu là fail.

**[7] Đang cấp credential** — đây là chỗ **thật sự** mất thời gian (vài giây, do issuer sinh số nguyên tố 596-bit).

Hiện tiến trình 5 bước, tick dần:
```
✓ Đối chiếu cơ sở dữ liệu
✓ Tạo commitment che link secret
✓ Chứng minh zero-knowledge
⋯ Nhận chữ ký mù từ issuer
· Giải mù và kiểm tra chữ ký
```

Panel kỹ thuật thu gọn được, hiện giá trị thật (rút gọn 20 ký tự đầu):
```
u = 8A3F1C...    commitment — issuer thấy giá trị này nhưng không biết link secret
c = 1D9E44...    challenge
a = 5C7102...    chữ ký nhận từ issuer
```

**[8] Ví có credential** — thẻ kiểu Apple Wallet:
- Bo góc lớn (16-20px), gradient nền, tỉ lệ ~1.585:1 (như thẻ thật)
- Góc phải trên: tick xanh + tên đơn vị cấp
- Mặt thẻ: tên schema (`CCCD`), họ tên, số CCCD **che một phần** (`0122 •••• 7445`)
- Bấm vào thẻ → lật/mở rộng hiện đủ 5 attribute
- Có thể chồng nhiều thẻ nếu sau này thêm loại credential khác

**[9] Từ chối** — hiện lý do cụ thể, không hiện lỗi kỹ thuật:
- `"Không tìm thấy thông tin trong cơ sở dữ liệu. Kiểm tra lại các trường đã nhập."`
- `"CCCD này đã được cấp credential trước đó."`
- Nút "Thử lại"

---

## PHẦN C — Task cho AI code

### Task C.1 — Bảng users và liên kết wallet

> Thêm bảng `users` trong SQLite: `user_id TEXT PRIMARY KEY, email TEXT UNIQUE, credential_id BLOB, public_key BLOB, sign_count INTEGER, created_at REAL`.
>
> `user_id` sinh bằng `secrets.token_urlsafe(16)` lúc đăng ký, dùng làm tên thư mục `wallets/{user_id}/`.
>
> Session cookie sau đăng nhập chứa `user_id`, ký HMAC.
>
> Endpoint `GET /api/me` trả `{email, has_credential: bool}`.

### Task C.2 — Lưu attributes cùng credential

> Sửa `wallet/api.py`: sau khi `unblind_signature` thành công, lưu thêm `wallets/{user_id}/attributes.json` chứa 5 attribute values.
>
> Lý do: `create_presentation` cần chúng để tính `∏ Rᵢ^mᵢ`. Không có thì credential không trình diện được.
>
> Thêm `GET /wallet/credential` trả `{schema_name, issuer_name, issued_at, attributes}` — dùng để render thẻ.
>
> **KHÔNG** trả `a`, `e`, `v` ra frontend. Chúng chỉ dùng nội bộ khi tạo presentation.

### Task C.3 — Xóa dữ liệu tạm

> Rà toàn bộ luồng, đảm bảo:
> - Ảnh CCCD: xử lý trong RAM (`io.BytesIO`), không ghi đĩa. Nếu buộc phải ghi thì `os.unlink` ngay trong `finally`.
> - Capture session: xóa khỏi store ngay sau khi người dùng bấm "Xác nhận" ở màn [6], hoặc khi hết TTL 5 phút.
> - `pending_request.json`: `clear_pending_request()` đã có, kiểm tra nó được gọi kể cả khi `unblind_signature` raise.
> - Issuer: sau `sign_blindly`, không còn `u`, `proof`, hay credential nào trong DB — chỉ còn cờ `credential_issued`.
>
> Viết test kiểm tra: sau khi cấp credential xong, `wallets/{user_id}/` chỉ còn `link_secret.json`, `credential.json`, `attributes.json`.

### Task C.4 — Màn hình ví

> Viết `wallet/web/wallet.html` — màn hình [4] và [8].
>
> **Trạng thái trống:** khung viền đứt nét, icon thẻ mờ, chữ "Chưa có credential nào", nút CTA.
>
> **Trạng thái có thẻ:** thẻ tỉ lệ 1.585:1, bo góc 18px, gradient. Góc phải trên tick xanh + "Cục Cảnh sát QLHC về TTXH". Mặt thẻ: "CCCD", họ tên, số che một phần. Bấm vào → mở rộng hiện 5 attribute.
>
> Header: email góc trái, nút đăng xuất góc phải. Footer: banner mô phỏng.
>
> Dùng CSS thuần, không framework. Theme navy/teal đã có.

### Task C.5 — Màn hình đang cấp credential

> Viết màn hình [7] với 5 bước tick dần theo tiến trình thật (không phải animation giả).
>
> Backend trả trạng thái qua Server-Sent Events hoặc poll 500ms: `{step: 1..5, done: bool, error: str|null}`.
>
> Panel kỹ thuật `<details>` thu gọn, hiện `u`, `c`, `a` rút gọn 20 ký tự + chú thích.
>
> **Bước 4 (nhận chữ ký mù) là bước lâu nhất** — issuer sinh số nguyên tố 596-bit, có thể vài giây. Đảm bảo `sign_blindly` chạy trong `run_in_threadpool` để không chặn event loop của FastAPI.

### Task C.6 — Xử lý lỗi ở màn [9]

> Map lỗi kỹ thuật sang thông báo cho người dùng:
>
> | Lỗi backend | Hiển thị |
> |---|---|
> | `issue_challenge` trả `None`, record không tồn tại | "Không tìm thấy thông tin trong CSDL. Kiểm tra lại các trường." |
> | `issue_challenge` trả `None`, `credential_issued=True` | "CCCD này đã được cấp credential trước đó." |
> | `verify_proof` fail | "Lỗi xác thực. Vui lòng thử lại." |
> | `unblind_signature` raise | "Chữ ký nhận được không hợp lệ. Vui lòng thử lại." |
>
> Issuer API phải phân biệt hai trường hợp đầu bằng mã lỗi riêng, không gộp chung `400`.

---

## PHẦN D — Kiểm tra trước khi chốt

- [ ] Đăng ký passkey thật bằng Windows Hello / vân tay trên `localhost:8003`
- [ ] Camera điện thoại qua HTTPS tunnel (cloudflared), `RP_ID`/`ORIGIN`/`PUBLIC_BASE_URL` set đúng domain
- [ ] Sau khi cấp credential, kiểm `wallets/{user_id}/` không còn file tạm
- [ ] Kiểm không còn ảnh CCCD nào trên đĩa
- [ ] Profile A cấp CCCD-1 thành công → Profile B xin CCCD-1 bị từ chối → Profile B xin CCCD-2 thành công
- [ ] Thẻ hiển thị đúng trên màn hình rộng và hẹp
