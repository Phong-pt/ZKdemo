# Handoff: Identity Wallet + Verifier Portal

## Overview
Hai prototype cho một nền tảng digital identity dùng AnonCreds:

- **App A — Identity Wallet (user):** onboarding từ login đến khi có identity card trong ví.
- **App B — Verifier Portal (bên thứ ba):** tạo proof request tối thiểu hoá dữ liệu, nhận và xác minh ZK proof.

`PROMPT.md` trong thư mục này là prompt để dán vào Claude Code. Đọc nó trước.

## Về các file design
`reference/*.dc.html` là **design reference viết bằng HTML** — mô tả giao diện và hành vi mong muốn,
không phải code production để copy. Nhiệm vụ là dựng lại chúng trong codebase đích
(React + TypeScript + Tailwind + Framer Motion) theo pattern có sẵn của dự án.
Mở trực tiếp trong trình duyệt để xem; giữ `support.js` cùng thư mục.

## Fidelity
**High-fidelity.** Màu, typography, spacing, radius, animation đều là giá trị cuối. Dựng lại pixel-perfect.

## Design tokens

| Token | Giá trị | Dùng cho |
|---|---|---|
| bg-page | `#F2F2EF` | nền trang |
| bg-surface | `#FFFFFF` | card |
| bg-sunken | `#FBFBF9` | input, card đang chọn |
| bg-muted | `#F5F5F1` | chip, placeholder card |
| ink | `#16171A` | chữ chính, nút primary |
| ink-2 / ink-3 | `#3B3D45` / `#6E7079` | chữ phụ |
| ink-4 / ink-5 | `#8A8C94` / `#9A9CA3` | caption, label mono |
| line | `#E6E6E2` | border card |
| line-2 | `#EFEFEB`, `#F0F0EC`, `#F7F7F3` | divider |
| blue / blue-bg | `#2F5FE0` / `#EEF2FD` | accent, trạng thái "prove" |
| green / green-bg | `#17795E` / `#F4FAF7` (border `#D9E6DF`) | success, privacy |
| amber | `#B4763A` | cảnh báo nhẹ |
| dark surface | `linear-gradient(145deg,#2C2E36,#0F1013)` | identity card, panel tối |
| avatar | `linear-gradient(145deg,#3D6BEA,#2438A8)` | avatar |
| chip vàng | `linear-gradient(140deg,#DCCCA4,#96855E)` | chip NFC trên thẻ |

Typography: **Geist** 300/400/500/600 (UI), **JetBrains Mono** 400/500 (label uppercase, ID, %).
Heading 26–30px / `-0.03em` / weight 500. Body 14–15px. Caption 12–13px.
Label mono 10px / `0.14em` / uppercase / `ink-5`.

Radius: 22–26px card lớn, 16–18px card phụ, 12–14px input & nút, 999px pill, 36/46px khung điện thoại.
Shadow: `0 30px 60px -45px rgba(20,22,28,.3)` (card nổi), `0 50px 90px -45px rgba(10,11,13,.85)` (điện thoại).
Spacing: padding card 30–40px, gap khối 20–22px, gap trong list 10–14px.

Animation: `fadeUp` 12px/.4–.45s, `fadeIn` .3s, `popIn` scale .85→1.04→1 /.35s,
`slideInRight` 40px/.5s, `pulseRing`, `breathe`, `shimmer`, `spin`, `sweep` (quét dọc khi tạo proof).
Hover: `translateY(-2px)` cho nút/card click được, đổi border sang `ink`.

## App A — Identity Wallet

State machine: `landing → google → signedin → install → password → passkey → wallet → kycdoc → kycid → handoff → processing → verified → wallet`

| Màn | Nội dung chính |
|---|---|
| Landing | Badge "Self-custodial · Verified identity", headline 46px, nút đen "Continue with Google", thẻ identity nổi (300×190, floaty 6s) |
| Google modal | Chọn account mock, 1.2s loading, sang signed-in |
| Signed in | Avatar + pulse ring + tick xanh, "Your wallet is being prepared…", shimmer bar, tự chuyển sau ~4s |
| Install | 2 cột: benefit list + mockup cửa sổ trình duyệt; nút Install → progress 0–100% (label đổi Downloading→Installing) → "Wallet installed" → password |
| Password | Step 1/2, 2 input, 4 thanh strength (`#C4544A #C4864A #4A8CC4 #17795E`), nút disabled màu `#C9C9C3` khi chưa hợp lệ (≥8 ký tự và khớp) |
| Passkey | Step 2/2, icon Face ID vẽ bằng div, modal biometric 1.9s → "Passkey created" → Continue |
| Wallet | Sidebar (avatar, identity status, security, balance 0.842 ETH) + main (card stack, recent activity). Chưa verify: card dashed "+ Add identity / Your wallet is empty" |
| eKYC doc | Header progress 1/4, 3 lựa chọn; CCCD highlight sẵn (border 2px `ink`, tick tròn) |
| eKYC ID | 2/4, hai mock CCCD (mặt trước tối, mặt sau sáng), Continue |
| QR handoff | 3/4, QR 200px, pairing code `K7 · 4QB2` mono 28px, checklist 5 dòng, "Waiting for phone…", nút "Simulate scanning with phone" |
| Mobile (khung 330×690) | connect → front → back → face; khung camera nền tối, scanline xanh `#5CE0B0` 2.4s, nút chụp 66px; mỗi lần chụp → màn tick "…captured" 1.2s → bước sau; đồng thời desktop checklist tick |
| Processing | Vòng tròn xoay + lõi tối, 4 dòng checklist tick mỗi 1s |
| Verified | Tick xanh 96px, "Open wallet" |
| Identity card | Gradient tối, label mono "VERIFIED IDENTITY", chip vàng, tên viết hoa 21px, mini-QR 52px; hover nâng 6px; click mở modal detail (Personal / Verification / Security) |

## App B — Verifier Portal

Views: `dashboard | create (wizard 1–5) | live | result | templates | activity | settings`
Sidebar 228px sticky, mục active nền `ink` chữ trắng.

- **Dashboard:** headline "Identity verification / Request only the information you need.", 4 ô stat (Active, Completed, Rejected 3, Success rate), bảng recent verifications 5 cột grid `1.1fr 1fr 1.4fr 1fr 1.3fr`.
- **Wizard:** 1 Purpose (3 input) · 2 Claims (8 claim, 3 nhóm, mỗi claim có mô tả) · 3 Proof conditions (khối AGE có switch + stepper `≥ N`, note "Privacy preserving", 4 condition khác, tag `PROVE` xanh) · 4 Trusted credentials (issuer + schema + cred-def + revocation registry) · 5 Review (cột REVEAL / PROVE, chip NOT REQUESTED, privacy meter 10 ô, nhãn Minimal/Moderate/Broad theo % disclosure).
- **Live:** QR 216px, countdown 9:58 đếm lùi, "Copy verification link" / "Share QR"; sau khi scan chuyển sang session panel: anonymous session + checklist 8 bước verify + progress bar.
- **Wallet panel (330×690, sticky phải):** scan → request (danh sách attribute có tag REVEAL/PROVE, note ZK xanh) → disclosure (card toggle từng attribute, summary Sharing/Proving/Not sharing) → generating (5 bước, khối sweep) → sent.
- **Result:** tick xanh, bảng kết quả (mỗi claim: giá trị hoặc "Not disclosed"), credential/issuer/status, panel tối "Privacy protected" hai cột nhận/không nhận + hai thanh Disclosure & Privacy preserved.
- **Templates:** 5 preset (Age, Identity, Nationality, Employment, Student) — chọn là set state và nhảy tới bước review.
- **Activity/Settings:** bảng lịch sử đầy đủ; settings có DID, data retention, "Raw attribute storage: Disabled ✓".

## State cần có

App A: `step, googleBusy, install(idle|busy|done), installPct, pw, pw2, passkey, verified, cardOpen, phone(idle|connect|front|back|face|captured|done), marks(0–5), proc(0–4)`.

App B: `view, wizard(1–5), name, desc, purpose, reveal{claimKey:bool}, ageOn, age, conds{key:bool}, phone(idle|scan|request|disclosure|generating|sent), vstep(0–8), gstep(0–5), disc{}, expiry, detail, log[]`.

Đồng bộ hai bên: hành động ở mobile đẩy event, desktop tăng `marks`/`vstep`. Tách thành bus giống WebSocket để thay bằng realtime thật.

## Services cần tách sẵn
`authService.signInWithGoogle()`, `walletService.installExtension() / createPassword() / createPasskey()`,
`kycService.startSession() / submitFront() / submitBack() / submitFace() / getStatus()`,
`proofService.buildRequest() / generatePresentation()`,
`verifierService.createRequest() / pollSession() / verifyPresentation() / listHistory()`.
Tất cả trả Promise có delay giả lập; không có crypto thật.

## Assets
Không có ảnh bitmap. QR sinh bằng hàm hash tất định (lưới 25×25, 3 finder). Mọi hình khối vẽ bằng div/gradient.

## Files
- `reference/Identity Wallet Prototype.dc.html`
- `reference/Verifier Portal.dc.html`
- `reference/support.js` (runtime, chỉ để mở file HTML)
- `PROMPT.md` — prompt dán thẳng vào Claude Code
