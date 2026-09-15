# Lõi mật mã — chữ ký CL và bằng chứng không tiết lộ

Tài liệu này mô tả đầy đủ phép toán đang chạy trong `issuer/issuer.py`, `wallet/wallet.py`,
`verifier/verifier.py` và `common.py`. Mọi công thức ở đây khớp một-một với mã nguồn; các hằng số bit
cũng lấy đúng từ mã.

Toàn bộ phép tính diễn ra trong nhóm nhân modulo `n`. Khi viết `x·y` hiểu là `x·y mod n`.

---

## 0. Ký hiệu và hằng số

| Ký hiệu | Ý nghĩa | Kích thước |
|---|---|---|
| `p, q` | hai safe prime, khoá riêng của issuer | 1024 bit mỗi số |
| `n = p·q` | modulus công khai | ~2048 bit |
| `φ = (p−1)(q−1)` | chỉ issuer tính được | |
| `S` | cơ số của phần ngẫu nhiên `v` | |
| `R` | cơ số của link secret | |
| `Z` | đích của đẳng thức chữ ký | |
| `R_i` | cơ số riêng của thuộc tính thứ `i` | 5 thuộc tính → 5 số |
| `ls` | link secret, chỉ ví biết | 256 bit |
| `m_i` | giá trị thuộc tính đã mã hoá thành số nguyên | |
| `A, e, v` | credential: chữ ký CL trên bộ thuộc tính | |

Hằng số dùng khi trình diện (bước 6–7):

```
E_START     = 2^596        mốc dưới của số mũ e
E_TILDE     = 456 bit      che e
V_TILDE     = 3060 bit     che v
M_TILDE     = 593 bit      che link secret và thuộc tính ẩn
R_BITS      = 2128 bit     ngẫu nhiên hoá chữ ký mỗi lần trình diện
```

Giai đoạn xin cấp (bước 3) dùng bộ số che riêng: 3488 bit cho `v'` và 593 bit cho `ls`.

Các số che luôn dài hơn số bị che ít nhất 80 bit. Đó là biên thống kê: phần dư ngẫu nhiên nhấn chìm
phần mang thông tin, nên đáp số gửi đi không rò rỉ gì về giá trị thật.

### Mã hoá thuộc tính thành số — `common.encode_attribute`

```
m = int(value)                                nếu value là chuỗi toàn chữ số ASCII
m = SHA256(str(value)) đọc như số nguyên       với mọi trường hợp còn lại
```

Số CCCD giữ nguyên giá trị; họ tên, địa chỉ, ngày sinh băm thành số 256 bit. Mọi phép toán phía sau
chỉ làm việc với `m`, không quan tâm nội dung gốc.

### Hàm thách thức — `common.hash_three`

```
H(x, y, nonce) = SHA256("x|y|nonce") đọc như số nguyên
```

Đây là biến đổi Fiat–Shamir: thay vì verifier gửi số thách thức rồi chờ trả lời, bên chứng minh tự
băm dữ liệu của chính mình ra số thách thức. Không đoán trước được `c` nên không dựng sẵn được câu
trả lời giả. `nonce` do bên kiểm phát ra, khiến mỗi lần chứng minh là một lần mới.

---

## 1. Sinh khoá — `issuer.setup`

```
p, q  ← safe prime 1024 bit                    p = 2p' + 1 với p' cũng nguyên tố
n     = p · q
a, b, z, r_i  ← ngẫu nhiên trong [0, n)
S = a² mod n
R = b² mod n
Z = z² mod n
R_i = r_i² mod n                               một số cho mỗi thuộc tính
```

**Vì sao safe prime.** Với `p = 2p'+1`, nhóm con của các số chính phương có bậc chứa thừa số nguyên
tố lớn `p'`. Điều này chặn các thuật toán khai thác nhóm bậc trơn.

**Vì sao bình phương mọi cơ số.** Bình phương đưa mọi số vào nhóm các thặng dư bình phương. Trong
nhóm đó bài toán logarit rời rạc vẫn khó, và quan trọng hơn là mọi phần tử đều nằm cùng một nhóm con
— không có phần tử nào rơi ra ngoài làm hỏng phép kiểm.

Công khai: `n, S, R, Z, R_i` — đây chính là chín số issuer đăng lên chain. Giữ kín: `p, q`.

---

## 2. Ví cam kết link secret — `wallet.compute_commitment`

Ví sinh và giữ mãi mãi:

```
ls  ← 256 bit ngẫu nhiên                       link secret, không bao giờ rời ví
v'  ← 2048 bit ngẫu nhiên                      blinding factor cho lần xin cấp này
u   = S^{v'} · R^{ls} mod n
```

`u` là cam kết Pedersen trên `ls`. Issuer nhìn thấy `u` nhưng không rút được `ls` ra: với mỗi giá trị
`ls` giả định đều tồn tại đúng một `v'` cho ra cùng `u`, nên `u` không chứa thông tin nào về `ls`.

Đây là điểm mấu chốt của toàn bộ mô hình: **issuer ký lên một thứ nó không đọc được.**

---

## 3. Ví chứng minh mình biết cái vừa cam kết — sigma protocol

Chỉ gửi `u` là chưa đủ. Ví có thể lấy `u` của người khác rồi tự nhận. Nên ví phải chứng minh mình
biết cặp `(v', ls)` bên trong `u`, mà không nói ra cặp đó.

**Ví tính** (`generate_random_exponents`, `compute_commitment_prime`, `compute_challenge`,
`compute_responses`):

```
ṽ  ← 3488 bit,  l̃s ← 593 bit                  số che, dùng một lần
ũ  = S^{ṽ} · R^{l̃s} mod n
c  = H(u, ũ, nonce)                            nonce do issuer phát
v̂  = ṽ + c · v'                                 phép cộng trên số nguyên, không mod
l̂s = l̃s + c · ls
```

Gửi cho issuer: `(nonce, u, c, v̂, l̂s)`. Không gửi `ũ`.

**Issuer kiểm** (`issuer.verify_proof`):

```
kiểm 1 < u < n và gcd(u, n) = 1
ũ' = S^{v̂} · R^{l̂s} · u^{−c} mod n
chấp nhận khi H(u, ũ', nonce) = c
```

**Vì sao đúng.** Thay đáp số vào:

```
S^{v̂} · R^{l̂s} · u^{−c}
  = S^{ṽ + c·v'} · R^{l̃s + c·ls} · (S^{v'} · R^{ls})^{−c}
  = S^{ṽ} · S^{c·v'} · R^{l̃s} · R^{c·ls} · S^{−c·v'} · R^{−c·ls}
  = S^{ṽ} · R^{l̃s}
  = ũ
```

Các phần nhân với `c` triệt tiêu, còn lại đúng `ũ` ban đầu. Issuer dựng lại được `ũ` mà chưa bao giờ
nhìn thấy nó, nên băm ra đúng `c`.

**Vì sao không giả được.** Kẻ gian phải chọn `ũ` trước khi biết `c` (vì `c` là băm của chính `ũ`).
Chọn xong thì `c` cố định, và muốn qua được phép kiểm phải biết `(v', ls)` thật. Ngược lại, nếu ai đó
trả lời đúng cho hai giá trị `c` khác nhau trên cùng một `ũ`, trừ hai phương trình cho nhau sẽ rút ra
được `ls` — nghĩa là chỉ người thật sự biết `ls` mới trả lời nổi.

Nonce chống phát lại: mỗi nonce dùng đúng một lần rồi xoá.

---

## 4. Issuer ký mù — `issuer.sign_blindly`

```
e  ← số nguyên tố trong [2^596, 2^596 + 2^119), với gcd(e, φ) = 1
v'' ← 2724 bit, bit cao nhất bật                phần ngẫu nhiên do issuer thêm vào
d  = e^{−1} mod φ                               chỉ issuer tính được vì cần φ

Q = Z · ( u · S^{v''} · ∏_i R_i^{m_i} )^{−1} mod n
A = Q^d mod n
```

Trả về `(A, e, v'')`.

**Đọc công thức `Q`.** Vế trong ngoặc gom đủ ba nhóm: cam kết `u` của ví (chứa link secret), phần
ngẫu nhiên `v''` của issuer, và toàn bộ thuộc tính. `Z` chia cho tích đó. Rồi `A` là căn bậc `e` của
`Q` — chỉ lấy được nhờ `d`, tức nhờ biết `φ`, tức nhờ biết `p, q`.

**Vì sao đây là ký mù.** `u` vào công thức nguyên khối. Issuer không biết `ls` bên trong, nhưng chữ
ký vẫn ràng buộc chặt vào `ls` đó. Credential ký xong chỉ dùng được bởi ví biết `ls` — ăn cắp file
credential đem sang máy khác là vô dụng.

**Vì sao `e` nằm trong một khoảng hẹp.** Sau này bằng chứng phải cho thấy `e` đúng là số mũ do issuer
chọn chứ không phải số ví tự bịa. Cố định khoảng cho phép chứng minh điều đó chỉ bằng một phép kiểm
độ dài bit thay vì cả một range proof.

---

## 5. Ví gỡ mù và tự kiểm — `wallet.unblind_signature`, `wallet.verify_credential`

```
v = v' + v''                                    ghép phần ngẫu nhiên hai bên
credential = (A, e, v)
```

Trước khi lưu, ví tự kiểm chữ ký:

```
A^e  ≟  Z · ( S^{v} · R^{ls} · ∏_i R_i^{m_i} )^{−1} mod n
```

Đây là **đẳng thức chữ ký CL**, và là bất biến trung tâm của toàn hệ thống. Viết lại cho dễ nhớ:

```
Z = A^e · S^{v} · R^{ls} · ∏_i R_i^{m_i} mod n
```

Nhân đúng tất cả thành phần lại thì ra `Z`. Sai một thuộc tính, sai link secret, hay chữ ký giả — đều
không ra `Z`.

Kiểm tại đây để issuer không thể đưa một chữ ký hỏng rồi đổ lỗi cho ví về sau.

---

## 6. Ví tạo bằng chứng trình diện — `wallet.create_presentation`

Đầu vào: credential `(A, e, v)`, `ls`, danh sách thuộc tính cần tiết lộ, nonce `n_v` của verifier.
Gọi `Hidden` là tập thuộc tính giữ kín, `Revealed` là tập tiết lộ.

### 6.1 Ngẫu nhiên hoá chữ ký

```
r   ← 2128 bit ngẫu nhiên
A'  = A · S^{r} mod n
v*  = v − e·r                                   trên số nguyên, có thể âm
e*  = e − 2^596
```

`A'` là thứ duy nhất của credential được gửi ra ngoài, và nó khác nhau ở **mỗi lần** trình diện. Hai
verifier có gộp dữ liệu cũng không thấy điểm chung — đây là tính unlinkable.

Vì sao thay `A` bằng `A'` mà đẳng thức vẫn đứng: `A = A'·S^{−r}`, nên `A^e = A'^e · S^{−er}`, phần
`S^{−er}` được bù lại đúng bằng việc đổi `v` thành `v* = v − e·r`.

`e*` dời `e` về gần 0. Vì `e` luôn nằm trong `[2^596, 2^596 + 2^119)` nên `e*` chỉ còn tối đa 119
bit, đủ nhỏ để số che 456 bit nhấn chìm hoàn toàn.

### 6.2 Che mọi thứ còn giữ kín

```
ẽ    ← 456 bit
ṽ    ← 3060 bit
m̃_ls ← 593 bit
m̃_i  ← 593 bit,  với mỗi i ∈ Hidden

T = A'^{ẽ} · S^{ṽ} · R^{m̃_ls} · ∏_{i∈Hidden} R_i^{m̃_i} mod n
```

`T` có đúng hình dạng của đẳng thức chữ ký, nhưng mọi số mũ đều là số ngẫu nhiên vô nghĩa.

### 6.3 Thách thức và đáp số

```
c    = H(T, A', n_v)

ê    = ẽ    + c · e*
v̂    = ṽ    + c · v*
m̂_ls = m̃_ls + c · ls
m̂_i  = m̃_i  + c · m_i        với mỗi i ∈ Hidden
```

Gửi cho verifier:

```
A', c, ê, v̂, m̂_ls, { m̂_i : i ∈ Hidden }, { (giá trị thô, m_i) : i ∈ Revealed }
```

Thuộc tính ẩn chỉ xuất hiện dưới dạng `m̃_i + c·m_i`. Vì `m̃_i` dài 593 bit còn `m_i` chỉ 256 bit,
tổng này về mặt thống kê không phân biệt được với số ngẫu nhiên thuần tuý.

---

## 7. Verifier khôi phục và so sánh — `verifier._check_presentation`

Verifier **không** nhận khoá công khai từ bên trình proof. Nó tự lấy `n, S, R, Z, R_i` từ hợp đồng
`CredentialRegistry` trên chain (`chain.resolve_cred_def`).

### 7.1 Kiểm biên trước

```
1 < A' < n
0 ≤ ê < 2^456                                  chặn số mũ bịa
0 ≤ c  < 2^256
tập thuộc tính tiết lộ khớp đúng yêu cầu đã phát
tập thuộc tính ẩn khớp đúng phần còn lại của schema
với mỗi i ∈ Revealed:  encode_attribute(giá trị thô) = m_i
```

Phép kiểm cuối buộc giá trị chữ mà verifier đọc phải khớp với số đưa vào phép tính — không thể khai
một đằng tính một nẻo.

### 7.2 Dựng lại đích

```
D = Z · ( ∏_{i∈Revealed} R_i^{m_i} )^{−1} · A'^{−2^596} mod n
```

Verifier chia `Z` cho phần nó đã biết. Những gì còn lại trong `D` đúng bằng phần vẫn đang giữ kín.

### 7.3 Khôi phục `T`

```
T̂ = D^{−c} · A'^{ê} · S^{v̂} · R^{m̂_ls} · ∏_{i∈Hidden} R_i^{m̂_i} mod n

c' = H(T̂, A', n_v)
chấp nhận khi c' = c
```

### 7.4 Vì sao `T̂` bằng đúng `T`

Xuất phát từ đẳng thức chữ ký `Z = A^e · S^{v} · R^{ls} · ∏_i R_i^{m_i}`, thay `A = A'·S^{−r}` và
`v = v* + e·r`, phần `S^{±er}` triệt tiêu:

```
Z = A'^{e} · S^{v*} · R^{ls} · ∏_i R_i^{m_i}
```

Tách `e = e* + 2^596` và chuyển phần tiết lộ sang vế trái:

```
Z · (∏_{Revealed} R_i^{m_i})^{−1} · A'^{−2^596}  =  A'^{e*} · S^{v*} · R^{ls} · ∏_{Hidden} R_i^{m_i}
```

Vế trái đúng là `D` mà verifier vừa tính. Vậy `D` chính là tích các thành phần bí mật. Giờ thay đáp
số vào biểu thức `T̂`:

```
A'^{ê} · S^{v̂} · R^{m̂_ls} · ∏ R_i^{m̂_i}
  = A'^{ẽ + c·e*} · S^{ṽ + c·v*} · R^{m̃_ls + c·ls} · ∏ R_i^{m̃_i + c·m_i}
  = ( A'^{ẽ} · S^{ṽ} · R^{m̃_ls} · ∏ R_i^{m̃_i} ) · ( A'^{e*} · S^{v*} · R^{ls} · ∏ R_i^{m_i} )^{c}
  = T · D^{c}
```

Nhân thêm `D^{−c}` ở đầu công thức thì `D^{c}` triệt tiêu, còn lại đúng `T`. Băm ra `c' = c`.

Phép kiểm này đồng thời khẳng định ba điều trong một lần: chữ ký là của đúng issuer, ví biết link
secret gắn với chữ ký đó, và các giá trị tiết lộ đúng là những giá trị đã được ký.

---

## 8. Chống phát lại

Verifier phát `n_v` ngẫu nhiên 80 bit, lưu kèm thời điểm, hạn dùng 300 giây. `n_v` đi vào hàm băm
nên proof gắn chặt với đúng phiên đó. Kiểm xong thì nonce bị xoá ngay trong khối `finally`, kể cả khi
proof sai hoặc có lỗi — chụp lại proof cũ gửi lại lần nữa sẽ không tìm thấy phiên nào.

---

## 9. Bảng đối chiếu mã nguồn

| Bước | Hàm |
|---|---|
| Sinh khoá | `issuer.setup` |
| Cam kết link secret | `wallet.compute_commitment` |
| Sigma protocol phía ví | `wallet.compute_commitment_prime`, `compute_challenge`, `compute_responses` |
| Sigma protocol phía issuer | `issuer.verify_proof` |
| Ký mù | `issuer.sign_blindly` |
| Gỡ mù và tự kiểm | `wallet.unblind_signature`, `wallet.verify_credential` |
| Tạo bằng chứng | `wallet.create_presentation` |
| Khôi phục và so sánh | `verifier._check_presentation` |
| Đọc khoá công khai từ chain | `chain.resolve_cred_def` |

---

## 10. Những gì lõi này chưa làm

- **Predicate proof.** Chưa chứng minh được bất đẳng thức trên giá trị ẩn, nên chưa có "đủ 18 tuổi mà
  không lộ ngày sinh". Thuộc tính hiện chỉ có hai trạng thái: lộ nguyên giá trị hoặc ẩn hoàn toàn.
- **Thu hồi.** Không có revocation registry; credential đã cấp là vĩnh viễn.
- **Phần ví chạy trên máy chủ.** Đúng mô hình thì `wallet.py` phải chạy trên thiết bị người dùng.
  Hiện nó chạy cùng process với issuer và verifier — đánh đổi để dựng demo nhanh.
- **Khoá 2048 bit.** Đủ cho demo, dưới mức khuyến nghị cho hệ thống thật.
