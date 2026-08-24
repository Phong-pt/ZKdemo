# Ứng Dụng Xác Thực ZKP (theo tiêu chuẩn Bhutan NDI)

## 1. Giới thiệu

Bhutan NDI là ứng dụng xác thực danh tính dựa trên **Self-Sovereign Identity (SSI)** — danh tính tự chủ, người dùng toàn quyền kiểm soát dữ liệu định danh của chính mình.

Người dùng chỉ xác thực bằng CCCD **một lần duy nhất**. Sau đó, mỗi khi cần chứng minh thuộc tính (VD: "đã đủ 18 tuổi", "là công dân Bhutan"), bên thứ ba (Verifier) xác minh qua **Zero-Knowledge Proof (ZKP)** mà không cần nhìn thấy dữ liệu gốc.

Repo này hiện thực mô hình ba bên **Issuer – Holder – Verifier** tương tự tiêu chuẩn Bhutan NDI, dưới dạng demo Python.

## 2. Vì sao cần ứng dụng này

Mô hình truyền thống bắt người dùng nộp ảnh CCCD/khuôn mặt cho từng bên thứ ba — dữ liệu bị nhân bản, lưu ở nhiều CSDL, rủi ro rò rỉ khi một trong số đó bị tấn công.

Với mô hình ZKP: bên thứ ba xác minh **"bạn đúng là bạn"** mà **không cần biết bạn là ai**. Dữ liệu gốc (số CCCD, ngày sinh, quốc tịch...) không bao giờ rời khỏi thiết bị của Holder; verifier chỉ xác minh một cam kết mật mã học.

## 3. Tính năng cốt lõi

- **Xác minh không lộ thông tin** — Verifier xác nhận điều kiện (đủ tuổi, đúng quốc tịch...) mà không thấy dữ liệu định danh gốc.
- **Dữ liệu chỉ lưu trên thiết bị** — sau e-KYC, dữ liệu gốc không gửi đi dạng thô; chỉ cryptographic commitment được gửi ra ngoài để xin cấp credential. Passkey chỉ bảo vệ quyền truy cập kho lưu trữ cục bộ, không phải cơ chế ZKP.
- **Đối chiếu với dữ liệu công khai (chain)** — proof ZKP được đối chiếu với public key/schema/CredDef của Issuer đã đăng ký công khai, không thể chỉnh sửa. Credential bị đánh cắp cũng vô dụng nếu không có **link secret** (chỉ tồn tại trên thiết bị). Mỗi lần trình diện, proof được ngẫu nhiên hóa lại (**unlinkable**).
- **Giao dịch không lộ danh tính** — verifier chỉ cần kiểm tra một bằng chứng toán học, không cần biết bạn là ai. Present-proof diễn ra **off-chain**, trực tiếp giữa Holder và Verifier.

## 4. Cấu trúc hệ thống

| Thành phần | Vai trò |
|---|---|
| **Issuer** | Cơ quan có thẩm quyền (nhà nước, Bộ Công an...). Xác minh e-KYC, ký credential (blind signing), đăng ký public key + schema lên chain. |
| **Holder (Wallet)** | App người dùng: sinh/lưu link secret, nhận credential từ Issuer, tạo & gửi proof ZKP cho Verifier. Toàn bộ dữ liệu nhạy cảm xử lý cục bộ. |
| **Verifier** | Bên thứ ba xác minh: gửi proof request, kiểm tra proof ZKP. Biết chắc đúng người nhưng không biết danh tính thật. |
| **Chain (sổ cái công khai)** | Lưu Schema, Credential Definition (public key Issuer), Revocation Registry (nếu có). **Không** lưu nội dung giao dịch verify — các giao dịch này off-chain giữa Holder/Verifier. |

## 5. Flow hoạt động

1. **Đăng ký & e-KYC** — Holder xác thực CCCD/khuôn mặt; app gửi dữ liệu e-KYC cho Issuer đối chiếu.
2. **Sinh link secret & xin cấp credential** — Holder tự sinh link secret (không rời thiết bị), tính blinded commitment kèm proof ZKP nhỏ chứng minh commitment tính đúng, gửi cho Issuer.
3. **Issuer xác minh & ký (blind signing)** — Issuer kiểm proof ZKP; nếu hợp lệ, ký (CL signature — Camenisch-Lysyanskaya) lên toàn bộ thuộc tính + commitment bị làm mù, trả credential đã ký.
4. **Holder gỡ mù & lưu trữ** — dùng blinding factor đã lưu tạm ở bước 2 để gỡ mù, thu credential hoàn chỉnh, lưu trong kho bảo mật cục bộ (mở khóa bằng passkey).
5. **Verifier gửi proof request** — nêu rõ điều kiện cần chứng minh.
6. **Holder tạo proof ZKP** — ngẫu nhiên hóa riêng cho lần trình diện này; dùng **predicate proof** cho thuộc tính số (VD: năm sinh ≤ mốc → đủ 18 tuổi) mà không lộ giá trị thật. Gửi thẳng cho Verifier, không qua chain.
7. **Verifier xác minh** — lấy public key/schema Issuer từ chain, kiểm tra proof. Hợp lệ → tiến hành giao dịch mà không biết danh tính thật.

## 6. Công nghệ tham chiếu (mô hình đầy đủ theo Bhutan NDI / Indy)

Đây là ngữ cảnh khái niệm — **không phải stack thực tế của repo này** (xem phần 7):

- **Hyperledger Indy** — distributed ledger chuyên cho SSI (đồng thuận Plenum/RBFT), đóng vai trò "Chain": lưu Schema, CredDef, Revocation Registry.
- **AnonCreds** — tầng logic mật mã giữa Issuer/Holder: chữ ký CL, blinded commitment/link secret, predicate proof, proof randomization (unlinkability).
- **W3C DID & Verifiable Credentials** — chuẩn định danh phi tập trung (DID Core) và data model bao bọc credential, giúp interop giữa các ví SSI khác nhau.
- **Hyperledger Aries (DIDComm)** — giao thức nhắn tin mã hóa đầu-cuối cho Issue-Credential Protocol và Present-Proof Protocol, off-chain.

## 7. Trạng thái triển khai thực tế trong repo này

Repo này là **bản demo giáo dục bằng Python**, hiện thực lại phần lõi mật mã (CL-signature blind issuance) của AnonCreds — **không dùng** Hyperledger Indy/Aries/Rust/DIDComm thật; chain và DIDComm được mô phỏng đơn giản qua REST API cục bộ (FastAPI + httpx).

### Cấu trúc thư mục

- [issuer/issuer.py](issuer/issuer.py) — logic issuer: setup CL cred-def (n, S, R, Z, R_attrs), e-KYC (`EKYC_DB` giả lập), phát nonce, verify ZK proof, blind-sign credential.
- [issuer/api.py](issuer/api.py) — FastAPI: `POST /ekyc`, `GET /cred-def`, `POST /credential-request`.
- [wallet/wallet.py](wallet/wallet.py) — logic holder: sinh/lưu link secret, tính commitment (`u`), sinh sigma-protocol proof (Schnorr-style), gỡ mù credential.
- [wallet/client.py](wallet/client.py) — `IssuerClient` gọi API issuer qua httpx.
- [run_flow.py](run_flow.py), [test_issuance.py](test_issuance.py), [test_system.py](test_system.py) — script chạy end-to-end flow issuance (tự start server FastAPI trong thread, gọi qua client).
- Chưa có phần **Verifier** / present-proof (bước 5-7 trong flow) — repo hiện chỉ cover bước 1-4 (issuance).

### Quy ước code (Python)

- Không dùng comment giải thích WHAT, chỉ comment khi có lý do non-obvious (constraint ẩn, workaround).
- Không thêm abstraction/error-handling cho trường hợp chưa xảy ra.
- Dùng `gmpy2` cho số học lớn (safe prime generation, modular exponentiation) — cần cài `gmpy2` (build từ GMP, trên Windows nên dùng wheel prebuilt hoặc conda).

### Lỗ hổng logic đã biết (chưa fix — cần lưu ý khi sửa issuer/wallet)

1. **RNG issuer không seed** — [issuer/issuer.py:40](issuer/issuer.py:40): `gmpy2.random_state()` gọi không seed sẽ dùng seed mặc định của GMP (hằng số cố định), khiến `p, q` (private key issuer) tất định giữa các lần chạy server, phá vỡ tính bảo mật của chữ ký CL. Cần seed bằng `secrets.randbits(...)`.

### Đã sửa

- **`attributes` không bị ràng buộc với eKYC đã xác minh** (đã fix): `issue_challenge` lưu `nonce → ekyc đã verify` trong `_pending_nonces` (dict, không còn là set); `sign_blindly` đối chiếu `attributes` client gửi ở `/credential-request` với bản ghi đã lưu theo `nonce`, khác thì từ chối ký. Nonce vẫn đúng ngữ nghĩa "cấp — chờ dùng — xoá sau khi ký", không đổi.
- **`ls_id` / cơ chế "1 CCCD = 1 wallet" kiểu cũ** (đã bỏ hẳn): cơ chế `ls_id = R^ls mod n` + `_cccd_to_ls` từng được thêm để chống 1 CCCD tạo nhiều wallet, nhưng đây không phải khái niệm chuẩn AnonCreds/Indy (link secret trong chuẩn thật không bao giờ lộ ra ngoài dưới dạng định danh công khai cho issuer), và bị lỗi thiết kế: `ls_id` gửi rời rạc ngoài sigma-protocol nên không có ràng buộc mật mã với `ls` thực sự dùng trong `u`, dễ bị đánh tráo. Đã gỡ bỏ toàn bộ (`issuer.py`, `wallet.py`, `api.py`, `run_flow.py`, `test_issuance.py`), quay lại đúng công thức sigma-protocol gốc `(nonce, u, c, v_hat, ls_hat)` không có `ls_id`. `test_system.py` nhờ vậy cũng hết lỗi thời (trước đây thiếu key `ls_id` nên luôn raise `ValueError`).
- **"1 CCCD chỉ được cấp credential đúng 1 lần"** (đã làm lại đúng tầng eKYC, thay cho cơ chế `ls_id` cũ): mỗi bản ghi trong `EKYC_DB` có thêm cờ `credential_issued: bool`. `issue_challenge` từ chối phát `nonce` nếu không tìm thấy bản ghi khớp hoặc bản ghi đã `credential_issued == True`. Cờ này chỉ chuyển sang `True` ở cuối `sign_blindly`, **sau khi** ký thành công (không phải lúc phát nonce) — để 1 lần thử hỏng (proof sai, mất kết nối giữa chừng...) không khoá nhầm CCCD hợp lệ chưa từng nhận được credential nào. Đây đúng tinh thần AnonCreds thật: chặn cấp trùng ở tầng identity-proofing (dữ liệu nội bộ issuer), không đưa bất kỳ giá trị phái sinh từ `link_secret` vào việc này. `ATTRIBUTE_NAMES = ["cccd","name","dob","nationality","address"]` được tách riêng khỏi `EKYC_DB[0].keys()` để `setup()` không lỡ coi `credential_issued` là 1 attribute cần ký.

## 8. Chạy thử

```bash
python run_flow.py
```

hoặc

```bash
python test_system.py
```

Cả hai tự khởi động issuer API (FastAPI/uvicorn) trong thread nền, chạy toàn bộ flow issuance, in ra credential cuối cùng.
