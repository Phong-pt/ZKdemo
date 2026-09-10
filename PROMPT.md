# Prompt để dán vào Claude Code

Copy nguyên khối dưới đây làm prompt đầu tiên. Kèm 2 file trong `reference/` vào context.
Điều làm kết quả khác nhau không phải "prompt hay" mà là: (1) đưa file HTML tham chiếu vào context,
(2) ép design tokens cụ thể, (3) cấm các thói quen mặc định, (4) build từng màn một, không build cả app trong một lượt.

---

## PROMPT

Bạn sẽ recreate hai prototype UI đã có sẵn, KHÔNG thiết kế lại.

**Tham chiếu:** `reference/Identity Wallet Prototype.dc.html` và `reference/Verifier Portal.dc.html`.
Đọc kỹ cả hai file trước khi viết dòng code nào. Chúng là design reference (HTML + inline style),
không phải code production để copy. Nhiệm vụ: dựng lại đúng thị giác và đúng hành vi trong
React + TypeScript + Tailwind + Framer Motion.

### Quy tắc bắt buộc về visual — tuân thủ tuyệt đối

Design tokens, không được tự chế thêm màu nào ngoài danh sách này:

```
--bg-page      #F2F2EF   nền toàn trang
--bg-surface   #FFFFFF   card
--bg-sunken    #FBFBF9   input, card phụ
--bg-muted     #F5F5F1   chip, placeholder card
--ink          #16171A   chữ chính + nút primary
--ink-2        #3B3D45   chữ phụ đậm
--ink-3        #6E7079   chữ phụ
--ink-4        #8A8C94   caption
--ink-5        #9A9CA3   label mono
--line         #E6E6E2   border card
--line-2       #EFEFEB / #F0F0EC   divider
--blue         #2F5FE0   accent / link / trạng thái "prove"
--blue-bg      #EEF2FD
--green        #17795E   success
--green-bg     #F4FAF7   (border #D9E6DF)
--amber        #B4763A   cảnh báo nhẹ
dark card      linear-gradient(145deg,#2C2E36,#0F1013)
```

Typography: `Geist` (300/400/500/600) cho toàn bộ UI, `JetBrains Mono` (400/500) chỉ cho label
viết hoa, mã số, ID, phần trăm. KHÔNG dùng Inter. Chữ nặng nhất là 500 — không bao giờ bold 700.
Heading màn hình: 26–30px, `letter-spacing:-0.03em`. Body 14–15px. Caption 12–13px.
Label mono: 10px, `letter-spacing:0.14em`, uppercase, màu `--ink-5`.

Hình khối: radius 22–26px cho card lớn, 12–14px cho input/nút/card nhỏ, 999px cho pill.
Border 1px `--line` — luôn có border, không dựa vào shadow để phân tách.
Shadow chỉ dùng rất nhẹ và chỉ cho phần tử nổi: `0 30px 60px -45px rgba(20,22,28,.3)`.
Whitespace rộng: padding card 30–40px, khoảng cách khối 20–22px.

Chuyển động: 0.3–0.5s, ease. Chỉ 4 loại — fade-up (12px), fade, pop-in (scale .85→1.04→1),
slide-in-right (40px) cho khung điện thoại. Progress/checklist đổi trạng thái theo timer.
KHÔNG spinner tròn ở mọi nơi: dùng progress bar, checklist tick dần, hoặc shimmer.

### Cấm

- Không gradient nền trang, không neon, không glow, không glassmorphism nặng.
- Không emoji. Không icon library. Ký hiệu trạng thái dùng ký tự: `✓ ✕ ● ○ ≥ ◆`.
- Không tự vẽ SVG minh hoạ phức tạp. QR là lưới ô vuông sinh bằng hàm hash tất định 25×25
  có 3 ô finder ở 3 góc — đúng như file tham chiếu.
- Không thêm màn hình, không thêm section, không thêm copy "marketing" ngoài những gì có trong file.
- Không đổi wording. Copy trong file tham chiếu là copy cuối cùng, kể cả câu tiếng Việt.
- Không dùng card có viền trái màu accent, không dùng shadow đậm, không border radius > 28px.

### Kiến trúc

- Vite + React + TS + Tailwind + Framer Motion.
- Toàn bộ dữ liệu qua một lớp `src/services/*` trả Promise với delay giả lập, để sau này thay bằng API thật:
  `authService`, `walletService`, `kycService`, `proofService`, `verifierService`.
- State máy trạng thái tường minh, một `type Step = ...` cho mỗi flow. Không dùng boolean rời rạc.
- Đồng bộ desktop ↔ mobile bằng một event bus in-memory (`src/lib/sessionBus.ts`) mô phỏng WebSocket:
  `publish(sessionId, event)` / `subscribe(sessionId, cb)`. Hai UI cùng subscribe một session id.
  Interface phải giống WebSocket để thay thế được.

### Thứ tự thực hiện — làm từng bước, dừng lại cho tôi xem sau mỗi bước

1. Scaffold + tokens Tailwind + font + 3 primitive (`Card`, `Button`, `MonoLabel`). Dừng.
2. App A – màn Landing + Google modal + Signed-in. Dừng.
3. App A – Install extension + Password + Passkey. Dừng.
4. App A – Wallet dashboard (trạng thái rỗng và trạng thái đã có identity card + card detail). Dừng.
5. App A – eKYC: chọn document → CCCD → QR handoff + khung điện thoại quét front/back/face,
   desktop checklist cập nhật theo mobile → processing → verified → card xuất hiện. Dừng.
6. App B – Verifier: sidebar + dashboard + history table + detail modal. Dừng.
7. App B – Wizard 5 bước tạo proof request (purpose → claims → proof conditions với predicate
   `age ≥ N` chỉnh được → trusted credentials → review có privacy meter). Dừng.
8. App B – Live session: QR + countdown, khung wallet trượt vào, selective disclosure toggle,
   ZK proof generation, desktop verify 8 bước, màn kết quả + section "Privacy protected" + privacy score. Dừng.
9. Templates page 5 preset, chọn preset nhảy thẳng vào bước review.

Sau mỗi bước: chỉ báo cáo file đã tạo, không tóm tắt dài.

### Kiểm tra trước khi báo xong mỗi bước

- Nền trang có đúng `#F2F2EF` không, card có đúng `#FFFFFF` + border `#E6E6E2` không.
- Có font-weight nào ≥ 600 ngoài logo không. Có màu nào ngoài bảng token không.
- Có emoji hoặc icon library nào lọt vào không.
- Chữ nhỏ nhất có ≥ 11px không, tương phản chữ trên nền đậm có đủ không.
- Layout có reflow được ở 1280px và 390px không.

---

## Vì sao bản Claude Code trước đó khác

Ba nguyên nhân thường gặp, xử lý bằng chính prompt trên:

1. **Không có file tham chiếu trong context** — Claude Code tự suy diễn giao diện. Luôn đính kèm
   `reference/*.dc.html` và yêu cầu đọc trước.
2. **Không khoá token** — không có bảng màu/chữ cụ thể thì mặc định rơi về Inter, xám `#6B7280`,
   shadow đậm, bold 700, emoji. Mục "Cấm" ở trên là để chặn đúng những mặc định đó.
3. **Build một lượt** — yêu cầu cả app trong một prompt sẽ ra bản rút gọn. Chia 9 bước, dừng từng bước.
