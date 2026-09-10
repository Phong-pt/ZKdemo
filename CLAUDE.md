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
| **Verifier** | Bên thứ ba xác minh: gửi proof request, kiểm tra proof ZKP. Biết chắc đúng người nhưng không biết danh tính thật. Đã hiện thực tại [verifier/verifier.py](verifier/verifier.py). |
| **Chain (sổ cái công khai)** | Lưu Schema, Credential Definition (public key Issuer), Revocation Registry (nếu có). **Không** lưu nội dung giao dịch verify — các giao dịch này off-chain giữa Holder/Verifier. Trong repo được mô phỏng bằng file `issuer/cred_def_public.json`. |

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

Repo này là **bản demo giáo dục bằng Python thuần**, hiện thực lại phần lõi mật mã của AnonCreds — CL-signature blind issuance (bước 1-4) **và** present-proof (bước 5-7) — **không dùng** Hyperledger Indy/Aries/Rust/DIDComm thật.

Bản thân `issuer.py`/`wallet.py`/`verifier.py` vẫn là ba module Python gọi trực tiếp lẫn nhau — "chain"
được mô phỏng bằng file JSON `issuer/cred_def_public.json` mà wallet và verifier đọc chung, "DIDComm"
chỉ là việc truyền dict Python qua lời gọi hàm. **Có một tầng REST API mỏng ở [api.py](api.py)** (xem
phần 10) bọc ba module này lại thành HTTP endpoint cho frontend gọi — nhưng đó là API để phục vụ demo
(chạy cả 3 vai chung 1 process, không phân tách issuer/holder/verifier thành 3 service độc lập theo
đúng mô hình thật), không phải một triển khai production-grade nhiều bên.

### Cấu trúc thư mục

- [common.py](common.py) — tiện ích dùng chung cho cả ba bên: `encode_attribute` (attribute → số nguyên; chuỗi toàn chữ số giữ nguyên giá trị, còn lại băm SHA-256) và `hash_three` (tính challenge Fiat-Shamir). Import theo dạng `from common import ...`, và ba module import nhau kiểu `from issuer import issuer`, nên **mọi script phải chạy từ thư mục gốc repo** (hoặc chạy với `PYTHONPATH` trỏ về gốc).
- [issuer/issuer.py](issuer/issuer.py) — logic issuer: `setup()` sinh cred-def CL (`n, S, R, Z, R_attrs`), `EKYC_DB` giả lập, `issue_challenge` phát nonce, `verify_proof` kiểm sigma-protocol, `sign_blindly` ký mù.
- [wallet/wallet.py](wallet/wallet.py) — logic holder, cover cả hai nửa của flow:
  - Issuance: sinh/lưu link secret, `compute_commitment` (`u`), sigma-protocol proof (Schnorr-style), `unblind_signature` + `verify_credential` để kiểm chữ ký issuer trước khi lưu.
  - Presentation: `create_presentation` — randomize `a` thành `a_prime = a·S^r`, sinh proof cho `e, v, link_secret` và các thuộc tính ẩn, tiết lộ chọn lọc (selective disclosure) đúng các thuộc tính verifier yêu cầu.
- [verifier/verifier.py](verifier/verifier.py) — logic verifier: `create_presentation_request` phát nonce `n_v` (80 bit) kèm danh sách `revealed_attrs` và mở session có TTL 300s, `verify_presentation` dựng lại `T_hat` từ cred-def công khai rồi so challenge. Nonce dùng một lần (xoá trong `finally`), session hết hạn bị prune. **Lưu ý:** `verifier/` không có `__init__.py` (khác `issuer/` và `wallet/` đều có) — vẫn import được nhờ namespace package.

### File trạng thái sinh ra khi chạy (không phải source)

Đều là JSON ghi cạnh module tương ứng, tự tạo ở lần chạy đầu:

- `issuer/cred_def_public.json` — đóng vai "chain": cred-def công khai, wallet/verifier đọc để kiểm proof.
- `issuer/issuer_private_key.json` — `p, q` của issuer.
- `wallet/link_secret.json` — link secret (hex), không bao giờ rời wallet.
- `wallet/pending_request.json` — `v_prime` + `ls` lưu tạm giữa lúc gửi request và lúc gỡ mù; `unblind_signature` xoá sau khi xong.
- `wallet/credential.json` — credential hoàn chỉnh `(a, e, v)` sau khi gỡ mù.

Trạng thái in-memory (mất khi restart process): `issuer._pending_nonces`, `verifier._pending_sessions`, và cờ `credential_issued` trong `EKYC_DB`.

### Chưa có

- **Test tự động** — không có test suite (pytest/unittest) cho lõi Python, cũng không có test cho frontend. `demo.py` (xem phần 8) chỉ chạy 1 lượt flow thành công, không phải test suite.
- **API hiện tại chỉ phục vụ demo, không phải mô hình 3-service thật** — xem phần 10: `api.py` chạy cả issuer/wallet/verifier chung 1 process/1 service, khác với mô hình thật (issuer, holder, verifier là 3 bên độc lập, wallet crypto chạy trên thiết bị người dùng chứ không trên server).
- **Predicate proof ở lõi Python** (bước 6 trong flow: "năm sinh ≤ mốc → đủ 18 tuổi") — `create_presentation` mới chỉ làm selective disclosure: thuộc tính hoặc lộ nguyên giá trị, hoặc ẩn hoàn toàn, chưa chứng minh được bất đẳng thức trên giá trị ẩn. Do đó predicate `age ≥ N` ở Verifier Portal (frontend, phần 9) vẫn chỉ là mô phỏng UI, không có proof thật đứng sau — xem phần 10 để biết chính xác đâu là thật/đâu là mô phỏng trong tích hợp frontend↔backend.
- **Revocation registry** — không có, credential đã cấp không thu hồi được.

### Quy ước code (Python)

- Không dùng comment giải thích WHAT, chỉ comment khi có lý do non-obvious (constraint ẩn, workaround).
- Không thêm abstraction/error-handling cho trường hợp chưa xảy ra.
- Dùng `gmpy2` cho số học lớn (safe prime generation, modular exponentiation) — cần cài `gmpy2` (build từ GMP, trên Windows nên dùng wheel prebuilt hoặc conda).
- Ngoài `gmpy2`, repo chỉ dùng stdlib (`secrets`, `hashlib`, `json`, `pathlib`, `time`).
- Mọi số lớn ghi ra JSON đều lưu dạng chuỗi hex hoặc decimal rồi parse lại khi đọc — JSON không có kiểu bigint.

### Đã sửa

> Nhật ký lịch sử — một số file được nhắc tới bên dưới (`api.py`, `run_flow.py`, `test_issuance.py`, `test_system.py`) đã từng bị gỡ khỏi repo và không có trong checkout hiện tại; đoạn dưới giữ nguyên vì vẫn mô tả đúng lý do các quyết định thiết kế hiện tại (nonce, cờ `credential_issued`, bỏ `ls_id`).

- **`attributes` không bị ràng buộc với eKYC đã xác minh** (đã fix): `issue_challenge` lưu `nonce → ekyc đã verify` trong `_pending_nonces` (dict, không còn là set); `sign_blindly` đối chiếu `attributes` client gửi ở `/credential-request` với bản ghi đã lưu theo `nonce`, khác thì từ chối ký. Nonce vẫn đúng ngữ nghĩa "cấp — chờ dùng — xoá sau khi ký", không đổi.
- **`ls_id` / cơ chế "1 CCCD = 1 wallet" kiểu cũ** (đã bỏ hẳn): cơ chế `ls_id = R^ls mod n` + `_cccd_to_ls` từng được thêm để chống 1 CCCD tạo nhiều wallet, nhưng đây không phải khái niệm chuẩn AnonCreds/Indy (link secret trong chuẩn thật không bao giờ lộ ra ngoài dưới dạng định danh công khai cho issuer), và bị lỗi thiết kế: `ls_id` gửi rời rạc ngoài sigma-protocol nên không có ràng buộc mật mã với `ls` thực sự dùng trong `u`, dễ bị đánh tráo. Đã gỡ bỏ toàn bộ (`issuer.py`, `wallet.py`, `api.py`, `run_flow.py`, `test_issuance.py`), quay lại đúng công thức sigma-protocol gốc `(nonce, u, c, v_hat, ls_hat)` không có `ls_id`. `test_system.py` nhờ vậy cũng hết lỗi thời (trước đây thiếu key `ls_id` nên luôn raise `ValueError`).
- **"1 CCCD chỉ được cấp credential đúng 1 lần"** (đã làm lại đúng tầng eKYC, thay cho cơ chế `ls_id` cũ): mỗi bản ghi trong `EKYC_DB` có thêm cờ `credential_issued: bool`. `issue_challenge` từ chối phát `nonce` nếu không tìm thấy bản ghi khớp hoặc bản ghi đã `credential_issued == True`. Cờ này chỉ chuyển sang `True` ở cuối `sign_blindly`, **sau khi** ký thành công (không phải lúc phát nonce) — để 1 lần thử hỏng (proof sai, mất kết nối giữa chừng...) không khoá nhầm CCCD hợp lệ chưa từng nhận được credential nào. Đây đúng tinh thần AnonCreds thật: chặn cấp trùng ở tầng identity-proofing (dữ liệu nội bộ issuer), không đưa bất kỳ giá trị phái sinh từ `link_secret` vào việc này. `ATTRIBUTE_NAMES = ["cccd","name","dob","nationality","address"]` được tách riêng khỏi `EKYC_DB[0].keys()` để `setup()` không lỡ coi `credential_issued` là 1 attribute cần ký.
- **RNG issuer không seed** (đã fix): [issuer/issuer.py:29](issuer/issuer.py#L29) trước đây gọi `gmpy2.random_state()` không seed, dùng seed mặc định (hằng số cố định) của GMP, khiến `p, q` (private key issuer) tất định giữa các lần chạy — phá vỡ tính bảo mật của chữ ký CL, cả trong `setup()` (S, R, Z, R_attrs) lẫn `generate_issuer_blinding_factor()` vì cả hai dùng chung `_RANDOM_STATE`. Nay seed bằng `gmpy2.random_state(secrets.randbits(256))`.
- **Verifier tin cred-def lấy từ tham số** (đã fix): `verify_presentation` trước đây nhận `cred_def` do caller truyền vào chứ không tự đọc từ "chain" (`issuer/cred_def_public.json`) — vô hại trong demo cùng process nhưng sai mô hình thật, nơi verifier phải tự lấy cred-def từ nguồn công khai đáng tin chứ không nhận từ bên trình diện proof. Nay `verifier.py` import `issuer` và tự gọi `issuer.get_public_cred_def()` bên trong `verify_presentation`; hàm không còn nhận tham số `cred_def` nữa (chữ ký còn `(presentation, n_v)`).

## 8. Chạy thử

[demo.py](demo.py) ở gốc repo là entry point chính thức — ghép đủ flow issuance + presentation, in
từng bước ra stdout (ép UTF-8 qua `sys.stdout.reconfigure` để chạy được cả trên console Windows mặc
định cp1252). Chạy từ thư mục gốc: `python demo.py` (cần cài `gmpy2` trước, xem phần "Quy ước code").

Bên trong, `demo.py` gọi đúng thứ tự đã kiểm chứng bằng cách chạy thật:

```python
from issuer import issuer
from wallet import wallet
from verifier import verifier
```

1. **Issuance** — `cred_def = issuer.get_public_cred_def()` → `nonce = issuer.issue_challenge(wallet.EKYC_DATA)` → wallet tính `u` từ `v_prime`/`ls`, `save_pending_request`, dựng proof `(nonce, u, c, v_hat, ls_hat)` → `issuer.sign_blindly(wallet.EKYC_DATA, proof)` → `wallet.unblind_signature(...)`.
2. **Presentation** — `req = verifier.create_presentation_request(["nationality"])` → `pres = wallet.create_presentation(cred, wallet.EKYC_DATA, ls, cred_def, req)` → `verifier.verify_presentation(pres, req["nonce"])` (verifier tự đọc cred-def từ `issuer.get_public_cred_def()`, không nhận qua tham số).

Lưu ý khi chạy lại: `credential_issued` là cờ in-memory nên restart process sẽ reset, nhưng `wallet/*.json` và `issuer/*.json` thì **không** — xoá các file trạng thái đó (đã liệt kê ở `.gitignore`) nếu muốn chạy lại từ đầu sạch sẽ.

## 9. Frontend (React + TypeScript + Tailwind + Framer Motion) — [frontend/](frontend/)

Đã hiện thực đầy đủ theo kế hoạch trong [PROMPT.md](PROMPT.md) (tham chiếu pixel-perfect từ
`reference/*.dc.html`) — **không còn là tài liệu kế hoạch, đây là trạng thái implement thật**.
Scaffold bằng Vite. Chạy `cd frontend && npm install && npm run dev`, hoặc qua Docker (phần 10).

Hai app độc lập, định tuyến bằng `react-router-dom` trong [src/App.tsx](frontend/src/App.tsx):

- **`/`** — App A "Identity Wallet" ([src/apps/wallet/](frontend/src/apps/wallet/)): landing → Google
  sign-in giả lập → cài extension → tạo password → **tạo passkey thật** (WebAuthn, xem phần 10) →
  wallet dashboard → luồng eKYC dùng **điện thoại thật, đúng bố cục màn hình gốc trong `.dc.html`**:
  desktop hiện QR **thật** (thư viện `qrcode`, quét được bằng camera điện thoại thật, khác hẳn
  `QrGrid` trang trí) → người dùng quét bằng điện thoại của chính họ, mở `/mobile-capture?session=...`
  trên trình duyệt điện thoại → điện thoại dùng camera thật chụp mặt trước CCCD (OCR đọc tự động ngay
  trên điện thoại) → mặt sau → selfie → mỗi bước đẩy kết quả về desktop qua WebSocket thật (xem phần
  10) → desktop nhận đủ 3 ảnh + dữ liệu OCR, chuyển sang form cho sửa lại → gửi backend ký thật → thẻ
  định danh xuất hiện với đúng dữ liệu người dùng vừa xác nhận.
- **`/verifier`** — App B "Verifier Portal" ([src/apps/verifier/](frontend/src/apps/verifier/)):
  sidebar (Dashboard/Verification requests/Templates/Activity/Settings) → wizard 5 bước tạo proof
  request (thông tin cơ bản → chọn claim tiết lộ → điều kiện chứng minh với predicate `age ≥ N` →
  issuer tin cậy → review kèm privacy meter) → live session (QR + đếm ngược, điện thoại ví mô phỏng
  quét/duyệt/tạo proof, desktop chạy checklist xác minh 8 bước) → kết quả kèm "Privacy protected".

Kiến trúc chung:

- **Design tokens** khoá cứng trong `@theme` của [src/index.css](frontend/src/index.css) (đúng bảng
  màu trong PROMPT.md) — font Geist Sans + JetBrains Mono qua `@fontsource`, không dùng Inter.
- **3 primitive** dùng chung ở [src/components/primitives/](frontend/src/components/primitives/):
  `Card` (là `motion.div`, nhận thẳng prop framer-motion), `Button`, `MonoLabel`.
- **Service layer** ở [src/services/](frontend/src/services/): `authService` (Google mock) và
  `walletService.installExtension` (cài extension) vẫn thuần giả lập (`Promise` + `setTimeout`) —
  không có khái niệm tương ứng bên lõi Python. `walletService.createPasskey` thì **thật** — gọi
  `navigator.credentials.create()` (WebAuthn), thật sự bật hộp thoại sinh trắc học của hệ điều hành
  (Windows Hello/Touch ID/vân tay Android...), không mô phỏng nữa (xem phần 10). `kycService` và phần
  verify trong `VerifierApp.tsx` thì **gọi API thật** qua
  [src/services/apiClient.ts](frontend/src/services/apiClient.ts) (`fetch('/api/...')`) — xem phần 10
  để biết chính xác đoạn nào là crypto thật, đoạn nào vẫn chỉ là UI mô phỏng.
- **`ocrService`** ([src/services/ocrService.ts](frontend/src/services/ocrService.ts)) — chạy
  Tesseract.js (OCR tiếng Việt) ngay trong trình duyệt (trên **điện thoại**, vì đó là nơi chụp ảnh
  CCCD — xem `MobileCaptureApp.tsx`) để đọc ảnh vừa chụp, parse best-effort ra
  `cccd`/`name`/`dob`/`nationality`/`address` bằng regex; độ chính xác OCR không đảm bảo, đó là lý do
  luôn có màn hình cho người dùng sửa lại trên desktop trước khi gửi đi (`KycReview.tsx`).
- **`CameraCapture`** ([src/apps/wallet/components/CameraCapture.tsx](frontend/src/apps/wallet/components/CameraCapture.tsx))
  — component dùng chung, gọi `navigator.mediaDevices.getUserMedia` thật để lấy luồng camera thiết bị,
  chụp 1 khung hình vào `<canvas>` khi bấm nút chụp. Dùng trong `MobileCaptureApp.tsx` (trang mở trên
  điện thoại) cho cả 3 bước chụp mặt trước/mặt sau CCCD và chụp selfie.
- **`MobileCaptureApp`** ([src/apps/wallet/MobileCaptureApp.tsx](frontend/src/apps/wallet/MobileCaptureApp.tsx))
  — route `/mobile-capture?session=...` riêng, đây chính là trang mở TRÊN ĐIỆN THOẠI sau khi quét QR;
  hoàn toàn tách biệt khỏi `WalletApp` (chạy trên thiết bị khác), chỉ nói chuyện với desktop qua
  `realtimeSession`/WebSocket bên dưới.
- **`realtimeSession`** ([src/lib/realtimeSession.ts](frontend/src/lib/realtimeSession.ts)) — WebSocket
  **thật**, nối tới `/api/session/{id}/ws` do `api.py` relay (xem phần 10), dùng để đồng bộ desktop
  (`Handoff.tsx`) với điện thoại thật (`MobileCaptureApp.tsx`) trong App A — thay thế hẳn mô phỏng
  cũ, đây là kết nối liên-thiết-bị thật, không phải in-memory.
- **`sessionBus`** ([src/lib/sessionBus.ts](frontend/src/lib/sessionBus.ts)) — event bus in-memory
  `publish(sessionId, event)` / `subscribe(sessionId, cb)` (cùng interface với `realtimeSession` cho dễ
  đọc, nhưng KHÔNG bắc cầu qua mạng — chỉ hoạt động trong cùng 1 tab/process). **Chỉ còn App B
  (Verifier Portal) dùng**, mô phỏng "điện thoại ví" cạnh desktop admin panel khi verifier tạo live
  session — App B chưa được yêu cầu làm thật nên vẫn giữ nguyên mô phỏng.
- **`QrCode`** ([src/apps/wallet/components/QrCode.tsx](frontend/src/apps/wallet/components/QrCode.tsx))
  — QR **thật**, dùng thư viện `qrcode` để encode `mobileCaptureUrl(sessionId)`
  ([handoffProtocol.ts](frontend/src/apps/wallet/handoffProtocol.ts)) thành ảnh quét được thật, dùng ở
  `Handoff.tsx`. Khác với **`QrGrid`** ([src/components/QrGrid.tsx](frontend/src/components/QrGrid.tsx))
  — lưới 25×25 sinh bằng hàm hash tất định (dịch nguyên logic từ `.dc.html`), chỉ trang trí, không quét
  được, vẫn dùng ở App B và thẻ định danh trong App A.
- Mỗi app có `types.ts` khai báo `type Step`/`type View` tường minh (không dùng boolean rời rạc) và
  state machine đặt trong component gốc (`WalletApp.tsx`/`VerifierApp.tsx`), dùng `setTimeout` (qua
  helper `after()`) để mô phỏng timing đúng như bản gốc.

## 10. Kết nối frontend với lõi crypto — [api.py](api.py)

[api.py](api.py) là tầng API còn thiếu được nhắc ở phần 7 ("Không có tầng API/server") — một FastAPI
server mỏng bọc `issuer.py`/`wallet.py`/`verifier.py`, chạy **cả ba vai trong cùng process** (giống
hệt `demo.py`), để frontend gọi được crypto thật thay vì chỉ mô phỏng bằng timer. Chạy độc lập:
`python -m uvicorn api:app --port 8000` (cần cài thêm `fastapi`/`uvicorn`/`pydantic`, đã có trong
[requirements.txt](requirements.txt)).

3 REST endpoint + 1 WebSocket:

- `WS /api/session/{session_id}/ws` — relay thô: bất kỳ tin nào 1 peer gửi lên được phát lại cho MỌI
  peer khác đang mở cùng `session_id` (không lưu lịch sử, không xử lý nội dung). Đây là kênh đồng bộ
  thật giữa desktop (`Handoff.tsx`) và điện thoại thật (`MobileCaptureApp.tsx`) trong App A — thay thế
  hoàn toàn kiểu mô phỏng in-memory cũ. Cần gói `websockets` (đã thêm vào
  [requirements.txt](requirements.txt)) để `uvicorn` hỗ trợ WebSocket.
- `POST /api/issue` — nhận **thuộc tính thật do người dùng gửi** (`cccd`/`name`/`dob`/`nationality`/
  `address`, tất cả bắt buộc — đây là dữ liệu người dùng tự xác nhận sau khi chụp CCCD + OCR ở App A,
  xem [KycReview.tsx](frontend/src/apps/wallet/screens/KycReview.tsx)), chạy đủ flow issuance
  (`issue_challenge` → sigma-protocol proof → `sign_blindly` → `unblind_signature`) với đúng thuộc
  tính đó; idempotent — nếu `wallet.get_credential()` đã có sẵn thì trả về identity đã lưu
  (`wallet.get_identity()`), không issue lại. `issuer.register_ekyc()` tự thêm bản ghi mới vào
  `EKYC_DB` nếu CCCD gửi lên chưa từng có (mô phỏng "vừa hoàn tất eKYC lần đầu với CCCD này") — đây là
  đơn giản hoá cần thiết: repo không có kết nối tới cơ sở dữ liệu định danh thật của nhà nước để đối
  chiếu, nên "xác minh eKYC" ở tầng demo này thực chất là "người dùng tự khai và ký nhận", không phải
  xác thực tính xác thực của tấm CCCD trong ảnh.
- `POST /api/verify` — nhận `revealed_attrs` (chỉ chấp nhận subset của `["name","dob","nationality",
  "address"]`, không bao giờ cho tiết lộ `cccd`), chạy `create_presentation_request` →
  `wallet.create_presentation` → `verifier.verify_presentation` thật (dùng `wallet.get_identity()` đã
  lưu từ lần issue, không còn `wallet.EKYC_DATA` cố định), trả `{verified, revealed}`. Nếu chưa có
  credential nào (`wallet.get_credential()`/`wallet.get_identity()` rỗng) thì trả lỗi 400 — App B
  không tự issue credential hộ (chỉ holder/App A mới được tạo credential bằng dữ liệu thật của chính
  họ).
- `POST /api/reset` — xoá toàn bộ state file (gồm cả `wallet/identity.json` mới) + reset in-memory
  state + xoá các bản ghi `EKYC_DB` được auto-register thêm vào (giữ lại đúng bản ghi demo gốc); nút
  "Restart demo" ở cả 2 app gọi endpoint này.

**Lưu ý kiến trúc quan trọng — đánh đổi có chủ đích, đã hỏi và được xác nhận:** đúng chuẩn SSI thật,
`wallet.py` (link secret, blinding, sigma-protocol proof) phải chạy trên thiết bị người dùng, không
bao giờ rời máy. Ở đây `api.py` chạy `wallet.py` **ngay trên server**, cùng issuer/verifier — đổi lấy
tốc độ, tránh phải port toàn bộ big-integer/modular-exponentiation crypto sang TypeScript/BigInt. Nếu
sau này cần đúng mô hình SSI thật, phải viết lại phần wallet crypto để nó chạy trong trình duyệt, chỉ
để issuer + verifier chạy qua API.

**Đâu là thật, đâu vẫn chỉ là mô phỏng UI (quan trọng, đừng hiểu nhầm khi đọc code frontend):**

- **Thật** —
  - Passkey ở App A: `navigator.credentials.create()` (WebAuthn) thật, bật đúng hộp thoại sinh trắc
    học của hệ điều hành/trình duyệt đang chạy trang. Không verify lại ceremony này ở server (không có
    RP backend đầy đủ) — chỉ dùng để chứng minh trình duyệt tạo được platform credential thật, đúng
    tinh thần "passkey bảo vệ quyền truy cập kho lưu trữ cục bộ" đã nêu ở phần 3, không phải cơ chế ZKP.
  - Camera + OCR ở App A: quét QR **thật** mở `/mobile-capture` trên điện thoại thật, `getUserMedia`
    thật lấy ảnh từ camera điện thoại (không phải camera máy desktop), Tesseract.js chạy OCR thật trên
    ảnh vừa chụp, kết quả đồng bộ về desktop qua WebSocket thật ở trên.
  - Toàn bộ blind-signing issuance với **dữ liệu người dùng tự nhập/OCR-đọc rồi tự xác nhận** (không
    còn persona demo cố định), và presentation/verify cho 4 thuộc tính selective-disclosure
    `name`/`dob`/`nationality`/`address`. Thẻ định danh ở App A hiện đúng tên/ngày sinh/quốc tịch
    người dùng vừa xác nhận, lấy từ `/api/issue`; màn "Result" ở App B hiện `verified: true/false`
    **thật** từ `/api/verify`, và nếu backend lỗi/không kết nối được hoặc chưa có credential nào thì
    hiện "Verification declined" (màu amber, icon ✕) chứ không giả vờ thành công.
- **Vẫn chỉ là mô phỏng UI, không có gì thật đứng sau** —
  - Google sign-in và cài extension ở App A vẫn luôn là mock (`authService`, `walletService.installExtension`),
    không có khái niệm tương ứng bên Python.
  - "Xác thực eKYC" chỉ là người dùng tự khai (xem ghi chú `register_ekyc` ở trên) — không có bước nào
    thật sự kiểm tra tấm ảnh chụp được có phải CCCD hợp lệ/còn hiệu lực hay không, cũng không đối
    chiếu khuôn mặt selfie với ảnh trên CCCD.
  - Predicate proof `age ≥ N` (wallet.py chưa hiện thực, xem "Chưa có" ở phần 7); 4 claim
    `docType`/`country`/`issuer`/`status` trong `CLAIMS` của Verifier Portal (không có thuộc tính
    tương ứng trong credential đã ký); toàn bộ 4 điều kiện trong `CONDS` (`nationalityVN`,
    `residencyVN`, `credValid`, `notRevoked` — `verifier.py` không có API cho từng phép chứng minh
    riêng lẻ này, chỉ có 1 phép verify tổng hợp).
- `CLAIM_TO_BACKEND_ATTR` trong
  [frontend/src/apps/verifier/types.ts](frontend/src/apps/verifier/types.ts) là bảng ánh xạ duy nhất
  giữa claim key của UI và tên thuộc tính thật trong credential — chỉ 4 key đó được gửi lên
  `/api/verify`, phần còn lại trong `reveal`/`conds` bị lọc bỏ trước khi gọi API.
- **WebAuthn và camera đều cần "secure context"** — chỉ chạy được qua `https://` hoặc `localhost`
  (trình duyệt coi `localhost` là secure context ngoại lệ dù không có TLS). Đây là giới hạn của trình
  duyệt, không phải của app — không có cách nào lách được nếu không có TLS thật.
  - **Desktop** (mở `WalletApp` để bấm "Create passkey"): mở qua `http://localhost:...` là đủ.
  - **Điện thoại** (mở `/mobile-capture` sau khi quét QR): điện thoại KHÔNG coi IP LAN của máy tính là
    "localhost", nên bắt buộc phải qua HTTPS. Repo tự sinh chứng chỉ self-signed lúc build Docker
    image ([frontend/Dockerfile](frontend/Dockerfile), CN=`vaulta.local`) và nginx lắng nghe thêm cổng
    443 (map ra host `8443`, xem phần 11) — vào app qua `https://<IP-LAN-của-máy>:8443/` (không phải
    `localhost`) thì QR sinh ra sẽ tự encode đúng origin đó, điện thoại quét vào sẽ load được trang
    qua HTTPS. Vì là chứng chỉ tự ký, trình duyệt điện thoại sẽ cảnh báo "không an toàn" — bấm "Vẫn
    tiếp tục"/"Advanced → Proceed" một lần là dùng được. Không có cách nào tránh cảnh báo này nếu
    không mua/tạo chứng chỉ CA thật cho đúng domain/IP đó.

## 11. Chạy qua Docker

Repo có sẵn [Dockerfile](Dockerfile) (lõi Python — image dùng chung cho cả `demo.py` và `api.py`),
[frontend/Dockerfile](frontend/Dockerfile) (build Vite rồi serve qua nginx — 2 `server` block, cổng 80
HTTP và cổng 443 HTTPS với chứng chỉ self-signed tự sinh lúc build, cả hai đều
`include` [frontend/nginx-locations.conf](frontend/nginx-locations.conf) — có `try_files` fallback về
`index.html` cho client-side routing của `react-router-dom`, và reverse-proxy `/api/` (kèm nâng cấp
WebSocket riêng cho `/api/session/`) sang service `api`), và [docker-compose.yml](docker-compose.yml)
gộp cả ba:

```bash
docker compose up --build
```

- Service `zkp-demo` chạy `demo.py`, in kết quả ra log rồi thoát (không phải server dài hạn) — xem log
  bằng `docker compose up zkp-demo` hoặc `docker logs zkp-demo`.
- Service `api` chạy `uvicorn api:app` dài hạn ở cổng 8000 — đây là backend thật mà frontend gọi.
- Service `frontend` phục vụ SPA ở `http://localhost:8080/` (HTTP, đủ cho desktop) và
  `https://localhost:8443/` (HTTPS tự ký, bắt buộc nếu muốn quét QR bằng điện thoại thật — xem lưu ý
  "secure context" ở phần 10); App A ở `/`, App B ở `/verifier`, cả hai origin đều forward `/api/...`
  sang service `api` qua network nội bộ của Docker Compose (`http://api:8000`) — không cần cấu hình
  CORS thêm khi chạy qua Docker.

`zkp-demo` và `api` build từ cùng image nhưng chạy tách container, state file KHÔNG dùng chung giữa
hai container (mỗi container có filesystem ghi riêng) — đây là 2 cách demo độc lập cùng một lõi crypto,
không phải 2 instance chia sẻ trạng thái.
