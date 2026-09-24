# NX Cred — prototype định danh số

Ứng dụng gồm ví người dùng (`/`), cổng cấp chứng nhận (`/issuer`), cổng xác minh
(`/verifier`) và API (`/api`). Frontend dùng React/TypeScript; backend dùng FastAPI/Python.

## Chạy bằng Docker Compose

Tạo file `.env` riêng trên máy và điền các biến trong bảng dưới đây, sau đó chạy:

```bash
docker compose up --build api frontend
```

Mở `http://localhost:8080`. Compose có thêm cổng HTTPS `8443` với chứng chỉ tự ký
cho thử nghiệm. Khi dùng domain thật, cấu hình HTTPS bằng chứng chỉ hợp lệ.

## Deploy một container

`Dockerfile.render` build frontend và đóng gói cùng backend; dùng được cả trên Render
và server chạy Docker. Build từ thư mục gốc:

```bash
docker build -f Dockerfile.render -t nxcred .
docker run --env-file .env -p 127.0.0.1:8000:8000 nxcred
```

Lệnh chạy trên dùng để kiểm tra image, chưa cấu hình lưu trữ bền vững.
Backend mặc định nghe cổng `8000` (đổi bằng `PORT`); health check là `/api/config`.
Reverse proxy cần chuyển tiếp WebSocket dưới `/api/` và phục vụ HTTPS cho domain.
Hiện chạy một instance, một worker vì phiên xác minh còn lưu trong bộ nhớ.

`render.yaml` là cấu hình triển khai Render. Khi chuyển domain, cập nhật Google OAuth
Authorized JavaScript origins và hai biến WebAuthn tương ứng.

## Biến môi trường

Giá trị thật đặt trong cấu hình service hoặc `.env` trên server, không commit vào Git.
File `.env` không được tự đọc khi chạy Python trực tiếp; cần nạp biến vào môi trường
hoặc dùng Docker Compose / `docker run --env-file`.

| Biến | Mục đích |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google Sign-In; để trống thì bật tài khoản demo |
| `ISSUER_PORTAL_TOKEN` | Secret truy cập cổng issuer |
| `ISSUER_CL_KEY_SEED` | Seed bí mật sinh khóa issuer; giữ ổn định qua các lần deploy |
| `WEBAUTHN_RP_ID` | Hostname của ứng dụng, không có `https://` |
| `WEBAUTHN_ORIGIN` | Origin đầy đủ, gồm `https://` và port nếu có |
| `VERIFIER_TRUSTED_DOMAINS_JSON` | JSON tùy chọn bổ sung domain email của tổ chức verifier |
| `SEPOLIA_RPC_URL` | Endpoint Ethereum Sepolia; có thể chứa API key |
| `CREDENTIAL_REGISTRY_ADDRESS` | Địa chỉ registry đã triển khai |
| `SCHEMA_ID` | ID schema đang dùng |
| `CREDENTIAL_DEFINITION_ID` | ID khóa công khai đã đăng ký |
| `AUTO_PUBLISH_REGISTRY` | Đặt `false` khi dùng registry đã công bố và chỉ đọc chain |
| `ISSUER_PRIVATE_KEY` | Chỉ cần ở môi trường được phép gửi giao dịch Sepolia |

Để đọc chain, cấu hình đủ RPC, registry address và hai ID. Khóa issuer đang ký phải
khớp khóa đã công bố: giữ đúng seed/khóa từ môi trường công bố, kiểm tra
`/api/chain` có `matches_local_key: true`.

`scripts/deploy_registry.py` triển khai registry và công bố schema/khóa trên Sepolia.
Chạy ở môi trường riêng có ví testnet, giữ lại kết quả `contracts/deployment.json`.
Không đưa private key, seed, RPC có API key hoặc file kết quả riêng lên repo.

## Dữ liệu cần giữ qua lần deploy

- `wallet/wallets/`: dữ liệu ví, link secret, chứng nhận và passkey.
- `issuer/cred_def_public.json`, `issuer/issuer_private_key.json`: khóa issuer.
- `issuer/ekyc_db.json`, `issuer/issuance_requests.json`: hồ sơ và yêu cầu cấp.
- `contracts/deployment.json`, `contracts/issuer-publication.json`: cấu hình và nhật ký công bố.

Các đường dẫn trên nằm dưới `/app` trong container. Cần cấu hình lưu trữ và sao lưu
trước khi giữ dữ liệu lâu dài. Không mount thư mục rỗng đè toàn bộ `/app/issuer` hoặc
`/app/contracts`, vì các thư mục này còn chứa mã nguồn cần chạy. Compose hiện bind-mount
các thư mục tương ứng từ checkout trên máy chủ.

## Phát triển frontend

```bash
cd frontend
npm ci
npm run dev
```

Vite chuyển tiếp `/api` tới backend tại `localhost:8000`.
Kiểm tra frontend bằng `npm run build` và `npm run lint`.

## Phạm vi hiện tại

Có luồng đối chiếu hồ sơ, duyệt/từ chối, ký mù, tiết lộ chọn lọc và kiểm tra proof.
Schema và khóa công khai có thể được đọc từ Sepolia; khi chưa cấu hình chain có
fallback cục bộ. Endpoint dựng giao diện schema cũng có fallback khi đọc chain lỗi.

Ví và xử lý mật mã của holder hiện chạy chung backend với issuer/verifier. Đây chưa
phải ví tự quản trên thiết bị hoặc triển khai đã kiểm chứng tương thích AnonCreds.
Chưa hỗ trợ thu hồi hoặc chứng minh điều kiện như đủ tuổi mà giấu ngày sinh.
Dữ liệu eKYC là dữ liệu demo; phiên xác minh trong bộ nhớ mất khi backend khởi động lại.

`demo.py` và service `zkp-demo` là demo CLI của lõi mật mã, tách khỏi luồng web.
