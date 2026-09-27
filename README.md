# Concert Recap · Nhật ký những đêm đi concert

**Tiếng Việt** · [English](README.en.md)

Một trang web cá nhân để lưu lại những đêm nhạc bạn đã đi: **tấm vé, ảnh, video, cảm nhận, tiền đã chi**. Mỗi đêm là một tấm vé; trang quản trị là một cuốn sổ tay bạn lật từng trang. Có sẵn tiếng Việt và tiếng Anh.

- Bạn **không cần biết lập trình** để dựng trang này. Làm theo 5 bước bên dưới, khoảng **30–45 phút**, không phải cài gì lên máy tính.
- Chạy hoàn toàn bằng các dịch vụ **miễn phí** (xem [giới hạn](#gioi-han-mien-phi)).
- Dữ liệu nằm trong tài khoản của chính bạn. Không ai khác (kể cả tác giả) đọc được.

> Lần đầu làm mấy việc này thấy nhiều bước là bình thường. Cứ làm lần lượt: mỗi bước có phần **"Bạn sẽ thấy…"** để tự kiểm tra, và cuối trang có [bảng xử lý lỗi](#gap-loi). Giao diện của MongoDB, Cloudflare, Vercel đổi thường xuyên nên tên nút có thể lệch đôi chút so với mô tả; chỗ nào cũng có đường dẫn tới tài liệu chính thức.

## Mục lục

1. [Trước khi bắt đầu](#truoc-khi-bat-dau)
2. [Bước 1: Tài khoản GitHub](#buoc-1)
3. [Bước 2: Nơi lưu dữ liệu (MongoDB Atlas)](#buoc-2)
4. [Bước 3: Nơi lưu ảnh/video (Cloudflare R2), làm sau cũng được](#buoc-3)
5. [Bước 4: Đưa trang lên mạng (Vercel)](#buoc-4)
6. [Bước 5: Dùng thử và bật ảnh/video](#buoc-5)
7. [Dùng hằng ngày](#dung-hang-ngay)
8. [Cập nhật, tên miền riêng, sao lưu](#van-hanh)
9. [Giới hạn miễn phí](#gioi-han-mien-phi)
10. [Gặp lỗi?](#gap-loi)
11. [Bảo mật](#bao-mat)
12. [Dành cho lập trình viên](#lap-trinh-vien)

<a id="truoc-khi-bat-dau"></a>
## Trước khi bắt đầu

**Bạn cần:** một địa chỉ email, một trình duyệt web (Chrome, Safari, Edge…) và khoảng 30–45 phút. Có thể cần một thẻ thanh toán **chỉ để Cloudflare xác minh** nếu muốn lưu ảnh/video (Bước 3, tuỳ chọn); bạn không bị trừ tiền khi dùng trong hạn mức miễn phí.

**Bạn sẽ có:** một địa chỉ dạng `https://ten-cua-ban.vercel.app` để cho bạn bè xem, và một trang quản trị ở `/admin` (chỉ bạn vào được, bằng mật khẩu).

**Vài từ sẽ gặp** (không cần hiểu sâu):

| Từ | Nghĩa dễ hiểu |
| --- | --- |
| **Repo** (kho mã) | Thư mục chứa toàn bộ mã của trang này, đặt trên GitHub |
| **Deploy** (triển khai) | Đưa trang lên mạng để ai cũng vào xem được |
| **Database** (cơ sở dữ liệu) | "Cuốn sổ cái" lưu chữ: tên show, ngày, cảm nhận, tiền… Ta dùng MongoDB Atlas |
| **Bucket** | "Kho ảnh" chứa file ảnh/video. Ta dùng Cloudflare R2 |
| **Biến môi trường** | Vài dòng "cài đặt bí mật" (mật khẩu, địa chỉ kho…) đưa cho trang, không nằm trong mã |
| **Token / khoá API** | Một loại "chìa khoá" để trang được phép dùng kho ảnh của bạn |

**Chuẩn bị một "phiếu ghi chép".** Suốt các bước sẽ có nhiều giá trị phải copy đi copy lại. Mở một file ghi chú (Notes, Notepad…), dán khung này vào và điền dần khi làm:

```text
MONGODB_URI           = (Bước 2)
ADMIN_PASSWORD        = (tự đặt, dài, ví dụ một câu 4-5 từ; đừng dùng lại mật khẩu khác)
NEXT_PUBLIC_YOUR_NAME = (tên bạn, ví dụ Linh)

R2_ACCOUNT_ID         = (Bước 3)
R2_ACCESS_KEY_ID      = (Bước 3)
R2_SECRET_ACCESS_KEY  = (Bước 3, chỉ hiện một lần)
R2_BUCKET             = (Bước 3)
R2_PUBLIC_URL         = (Bước 3)
```

> ⚠️ Phiếu này chứa mật khẩu và chìa khoá. Giữ riêng cho bạn: đừng gửi cho ai, đừng dán lên mạng xã hội hay chụp màn hình đăng lên.

<a id="buoc-1"></a>
## Bước 1: Tài khoản GitHub (5 phút)

Vercel (Bước 4) sẽ tạo cho bạn một bản sao của trang này trong GitHub của bạn.

1. Vào [github.com/signup](https://github.com/signup), đăng ký (miễn phí) và xác nhận email.
2. **Đã có tài khoản GitHub thì bỏ qua bước này.**

✅ **Bạn sẽ thấy:** đăng nhập được vào [github.com](https://github.com).

<a id="buoc-2"></a>
## Bước 2: Nơi lưu dữ liệu, MongoDB Atlas (10–15 phút)

MongoDB Atlas cho một database miễn phí (gói **M0**, 512 MB, đủ cho hàng nghìn bài nhật ký chữ). Hướng dẫn chính thức: [Get Started with Atlas](https://www.mongodb.com/docs/atlas/getting-started/).

**2.1. Tạo tài khoản và cluster miễn phí**

1. Vào [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) và đăng ký (có thể dùng nút đăng nhập bằng Google).
2. Khi được hỏi tạo cluster, chọn gói **M0 / Free**. Nhà cung cấp và vùng: chọn gì cũng được (nên chọn vùng gần bạn, ví dụ Singapore). Tên cluster để mặc định. Bấm **Create**.
3. Chờ vài phút cho cluster tạo xong.

**2.2. Tạo "tài khoản" cho trang web vào database**

1. Menu bên trái chọn **Database Access** (thuộc mục Security) → **Add New Database User**.
2. **Authentication Method:** Password. Điền **Username**, ví dụ `nhatky`. Ô mật khẩu: tự gõ một mật khẩu **chỉ gồm chữ và số** (xem lưu ý dưới). Ghi username và mật khẩu vào phiếu.
3. **Database User Privileges:** chọn **Read and write to any database** (mặc định thường là *Atlas admin*, quyền đọc/ghi là đủ và an toàn hơn).
4. Bấm **Add User**.

> Nếu mật khẩu có ký tự đặc biệt như `@ : / # ?` thì khi dán vào chuỗi kết nối phải đổi sang dạng mã hoá (ví dụ `@` → `%40`), rất dễ sai. Dùng chữ và số cho gọn.

**2.3. Cho phép trang web kết nối**

1. Menu trái chọn **Network Access** → **Add IP Address**.
2. Bấm **Allow Access From Anywhere** (ô địa chỉ tự điền `0.0.0.0/0`) → **Confirm**.

> Vì sao "từ mọi nơi"? Vercel bản miễn phí chạy từ những địa chỉ IP luôn thay đổi nên không liệt kê trước được. Database vẫn được bảo vệ bằng username và mật khẩu ở bước 2.2, nên mật khẩu đó phải đủ khó.

**2.4. Lấy chuỗi kết nối**

1. Menu trái chọn **Database** (hoặc *Clusters*) → bấm **Connect** ở cluster của bạn → chọn **Drivers**.
2. Bạn sẽ thấy một dòng bắt đầu bằng `mongodb+srv://…`. Bấm nút copy.
3. Dán vào phiếu, rồi **sửa 2 chỗ**:
   - Thay `<password>` (hoặc `<db_password>`) bằng mật khẩu ở bước 2.2, bỏ luôn hai dấu `<` `>`.
   - **Thêm tên database**: chèn một tên bất kỳ (ví dụ `nhat-ky`) ngay sau `.mongodb.net/` và trước dấu `?`.

   Trước khi sửa:
   `mongodb+srv://nhatky:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`

   Sau khi sửa (chú ý chữ `nhat-ky`):
   `mongodb+srv://nhatky:MATKHAU123@cluster0.abcde.mongodb.net/nhat-ky?retryWrites=true&w=majority`

4. Kết quả chính là `MONGODB_URI` trong phiếu.

✅ **Bạn sẽ thấy:** `MONGODB_URI` trong phiếu có dạng `mongodb+srv://tên:mậtkhẩu@…mongodb.net/nhat-ky?…` (có tên database, không còn dấu `<` `>`).

<a id="buoc-3"></a>
## Bước 3: Nơi lưu ảnh/video, Cloudflare R2 (15 phút) *(làm sau cũng được)*

Không có bước này trang vẫn chạy và viết nhật ký bình thường, chỉ **chưa gắn được ảnh/video**. Bạn có thể làm Bước 4 và 5.1 trước rồi quay lại đây.

Cloudflare R2 cho 10 GB miễn phí mỗi tháng. Cloudflare thường yêu cầu **thêm thẻ thanh toán để bật R2**; trong hạn mức miễn phí bạn không bị tính tiền (xem [giá R2](https://developers.cloudflare.com/r2/pricing/)).

**3.1. Tạo tài khoản và bucket**

1. Vào [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up), đăng ký và xác nhận email.
2. Menu trái chọn **R2 Object Storage** (nếu được hỏi, làm theo hướng dẫn bật R2 / thêm thẻ).
3. Bấm **Create bucket**, đặt tên (chữ thường, số, gạch nối; ví dụ `nhat-ky-media`) → **Create bucket**. Ghi tên vào `R2_BUCKET`.

**3.2. Cho phép xem ảnh công khai**

1. Mở bucket vừa tạo → **Settings** → mục **Public Development URL** → **Enable**.
2. Gõ chữ `allow` vào ô xác nhận → **Allow**.
3. Copy **Public Bucket URL** (dạng `https://pub-xxxxxxxx.r2.dev`) vào `R2_PUBLIC_URL`, **không có dấu `/` ở cuối**. ([Tài liệu](https://developers.cloudflare.com/r2/buckets/public-buckets/).)

> Địa chỉ `r2.dev` do Cloudflare giới hạn tốc độ và dành cho thử nghiệm; với một cuốn nhật ký cá nhân thì đủ dùng. Khi trang có đông người xem, gắn tên miền riêng cho bucket (cũng ở mục Settings) rồi đặt `R2_PUBLIC_URL` thành tên miền đó.

**3.3. Tạo chìa khoá cho trang được phép dùng kho ảnh**

1. Quay về trang **R2 Object Storage** (danh sách bucket). Bên phải có mục **Account Details**; cạnh **API Tokens** bấm **Manage**.
2. Bấm **Create Account API token** (hoặc *Create User API token*).
3. **Permissions:** chọn **Object Read & Write**. Quan trọng: phải là *Read & Write*, không phải *Read only*, để trang tải lên và xoá được file.
4. **Specify bucket(s):** chọn đúng bucket của bạn.
5. Bấm **Create**. Trang kế tiếp hiện **Access Key ID** và **Secret Access Key**. **Secret chỉ hiện một lần**: copy ngay vào phiếu (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`). ([Tài liệu](https://developers.cloudflare.com/r2/api/tokens/).)
6. **Account ID:** nằm ở trang R2 (mục Account Details, cột bên phải) hoặc trong địa chỉ `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` hiện ở trang token. Copy vào `R2_ACCOUNT_ID`.

✅ **Bạn sẽ thấy:** phiếu đã điền đủ 5 dòng `R2_…` (Account ID, Access Key ID, Secret, Bucket, Public URL). Phần **CORS** sẽ làm ở [Bước 5](#buoc-5) sau khi trang có địa chỉ.

<a id="buoc-4"></a>
## Bước 4: Đưa trang lên mạng, Vercel (5–10 phút)

**4.1. Bấm nút Deploy.** Bấm nút này (hoặc chép địa chỉ vào trình duyệt):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkhuong307%2Fconcert-journal&project-name=nhat-ky-di-show&repository-name=nhat-ky-di-show&env=MONGODB_URI,ADMIN_PASSWORD,NEXT_PUBLIC_YOUR_NAME&envDescription=MONGODB_URI%3A%20chu%E1%BB%97i%20k%E1%BA%BFt%20n%E1%BB%91i%20MongoDB%20%28B%C6%B0%E1%BB%9Bc%202%29.%20ADMIN_PASSWORD%3A%20m%E1%BA%ADt%20kh%E1%BA%A9u%20v%C3%A0o%20trang%20qu%E1%BA%A3n%20tr%E1%BB%8B,%20t%E1%BB%B1%20%C4%91%E1%BA%B7t%20v%C3%A0%20n%C3%AAn%20%C4%91%E1%BA%B7t%20d%C3%A0i.%20NEXT_PUBLIC_YOUR_NAME%3A%20t%C3%AAn%20c%E1%BB%A7a%20b%E1%BA%A1n.&envLink=https%3A%2F%2Fgithub.com%2Fkhuong307%2Fconcert-journal%23bien-moi-truong&envDefaults=%7B%22NEXT_PUBLIC_YOUR_NAME%22%3A%22M%C3%ACnh%22%7D)

**4.2. Đăng nhập Vercel.** Chọn **Continue with GitHub** để đăng nhập bằng tài khoản ở Bước 1 (gói **Hobby**, miễn phí). Hobby chỉ dành cho dự án **cá nhân, phi thương mại**: đừng gắn quảng cáo hay bán vé trên trang này.

**4.3. Tạo bản sao mã.** Vercel sẽ tạo một bản sao mã trong GitHub của bạn. Để nguyên tên gợi ý (hoặc đặt tên khác) rồi bấm **Create**.

<a id="bien-moi-truong"></a>
**4.4. Điền các biến môi trường.** Ở khung **Environment Variables**, điền 3 ô từ phiếu:

| Ô | Điền gì |
| --- | --- |
| `MONGODB_URI` | Chuỗi kết nối ở Bước 2.4 |
| `ADMIN_PASSWORD` | Mật khẩu vào trang quản trị do bạn tự đặt (dài, khó đoán) |
| `NEXT_PUBLIC_YOUR_NAME` | Tên của bạn, ví dụ `Linh` (trang sẽ hiện "Linh đi show") |

**4.5. Deploy.** Bấm **Deploy** và chờ 2–3 phút.

✅ **Bạn sẽ thấy:** màn hình chúc mừng "Congratulations" kèm ảnh chụp trang. Bấm vào ảnh (hoặc **Visit**) để mở trang của bạn, địa chỉ dạng `https://nhat-ky-di-show.vercel.app`. Trang lúc này còn **trống** (dòng "Chưa có đêm diễn nào"): đúng rồi, ta thêm dữ liệu ở bước sau.

> Nếu Vercel báo build lỗi: xem [Gặp lỗi?](#gap-loi). Lỗi hay gặp nhất là gõ thiếu/thừa ở `MONGODB_URI`; sửa ở **Settings → Environment Variables** rồi **Redeploy**.

<a id="buoc-5"></a>
## Bước 5: Dùng thử và bật ảnh/video

**5.1. Vào trang quản trị và thêm đêm đầu tiên**

1. Mở `https://<địa-chỉ-của-bạn>/admin`.
2. Bạn sẽ thấy một cuốn sổ đen còn **đóng**, có tấm nhãn ghi tên bạn. Gõ `ADMIN_PASSWORD` vào ô **Mật khẩu** rồi bấm **Mở sổ**: bìa sổ mở ra.
3. Bấm **Thêm sự kiện**, điền tên chương trình, nghệ sĩ, ngày, địa điểm, viết cảm nhận ở trang "Nhật ký" rồi bấm **Thêm sự kiện** (nút cuối trang). Một tờ giấy nhớ "Lưu rồi nha!" hiện ra.
4. Mở trang chủ: tấm vé đầu tiên đã ở đó.

✅ **Bạn sẽ thấy:** đêm bạn vừa thêm xuất hiện thành một tấm vé ở trang chủ. (Trang chủ làm mới tối đa sau 5 phút; sau khi lưu từ trang quản trị thì thường thấy ngay.)

**5.2. Bật ảnh/video (chỉ khi đã làm Bước 3)**

1. Vào [vercel.com/dashboard](https://vercel.com/dashboard) → chọn dự án → **Settings** → **Environment Variables**.
2. Thêm lần lượt 5 biến từ phiếu: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` (mỗi biến: gõ **Key**, dán **Value**, **Save**).
3. **Biến chỉ có hiệu lực sau khi deploy lại:** vào tab **Deployments** → bấm dấu **⋯** bên phải bản trên cùng → **Redeploy** → **Redeploy**. Chờ 1–2 phút.
4. Cho phép R2 nhận ảnh từ trang của bạn (**CORS**): Cloudflare → **R2** → bucket của bạn → **Settings** → **CORS Policy** → **Add CORS policy**, dán đoạn dưới (đổi địa chỉ thành địa chỉ trang của bạn, **không có dấu `/` ở cuối**) rồi **Save**:

   ```json
   [
     {
       "AllowedOrigins": ["https://nhat-ky-di-show.vercel.app"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Sau này dùng tên miền riêng thì thêm tên miền đó vào `AllowedOrigins`.
5. Thử: `/admin` → sửa một sự kiện → trang cuối **Ảnh & sao** → kéo thả một ảnh → **Lưu thay đổi**. (Ảnh chỉ thật sự lên R2 lúc bấm **Lưu**. Ảnh chụp từ iPhone dạng HEIC tự được đổi sang JPG.)

✅ **Bạn sẽ thấy:** ảnh hiện trên tấm vé và trong trang chi tiết. Nếu báo *"Không kết nối được R2"*: gần như chắc chắn là chưa làm bước CORS ở trên hoặc `AllowedOrigins` chưa khớp địa chỉ trang.

Xong! 🎉 Gửi địa chỉ trang cho bạn bè. Trang quản trị `/admin` chỉ bạn vào được.

<a id="dung-hang-ngay"></a>
## Dùng hằng ngày

- **Thêm / sửa:** `/admin` → **Thêm sự kiện**, hoặc biểu tượng cây bút ở mỗi dòng. Form có 4 trang (thông tin + vé, chi phí, nhật ký, ảnh + đánh giá); lật bằng tab bên mép sổ hoặc góc trang.
- **Ẩn khỏi trang chủ (không xoá):** biểu tượng con mắt ở mỗi dòng, hoặc bỏ chọn **Hiện trên trang chủ** trong form. Đêm bị ẩn vẫn còn trong sổ. Nhãn **Sắp diễn ra** tự hiện khi ngày của đêm đó còn ở tương lai, không liên quan chuyện ẩn/hiện.
- **Xoá hẳn:** biểu tượng thùng rác ở mỗi dòng, hoặc mục **Xoá sự kiện** ở trang cuối của form sửa. Luôn có hộp thoại hỏi lại. **Xoá là mất luôn, cả ảnh/video trên R2, không lấy lại được.** Chỉ muốn giấu thì dùng nút ẩn.
- **Tiền:** ô *Giá vé*, *Chi phí phát sinh* (đi lại, gửi đồ…) và *Khoản thu hồi* (bán lại merch, pass vé, voucher…) được cộng trừ ra **thực chi** của từng đêm; trang đầu của sổ có tổng.
- **Tìm, lọc, sắp xếp:** trang đầu của sổ (Mục lục) có ô tìm kiếm (gõ không dấu vẫn ra), lọc *Đã diễn ra / Sắp diễn ra / Đang ẩn* và sắp xếp.
- **Ngôn ngữ:** menu bánh răng ở góc trang. `/` là tiếng Việt, `/en` là tiếng Anh; trang quản trị tương tự (`/admin`, `/en/admin`). Chỉ giao diện được dịch, nhật ký giữ nguyên như bạn viết.
- **Đổi tên hiện ở logo:** đổi biến `NEXT_PUBLIC_YOUR_NAME` (Vercel → Settings → Environment Variables) rồi **Redeploy**.
- **Đổi mật khẩu:** đổi biến `ADMIN_PASSWORD` rồi **Redeploy**; mọi thiết bị đang đăng nhập bị đăng xuất.

<a id="van-hanh"></a>
## Cập nhật, tên miền riêng, sao lưu

**Cập nhật lên phiên bản mới.** Nút *Deploy* ở Bước 4 tạo một bản sao **độc lập**: tác giả có cập nhật thì bản của bạn không tự nhận. Muốn nhận cập nhật về sau, hãy làm Bước 4 theo cách khác: trên trang GitHub của dự án bấm **Fork**, rồi ở Vercel chọn **Add New… → Project → Import** bản fork đó (điền cùng các biến môi trường). Khi có bản mới, vào bản fork trên GitHub bấm **Sync fork → Update branch**; Vercel tự deploy lại.

**Tên miền riêng (tuỳ chọn).** Vercel → dự án → **Settings → Domains → Add**, làm theo hướng dẫn trỏ DNS. Nhớ thêm tên miền mới vào `AllowedOrigins` của CORS (Bước 5.2) nếu có dùng R2.

**Sao lưu.** Gói MongoDB miễn phí (M0) **không có sao lưu tự động**. Nên thỉnh thoảng xuất dữ liệu: cài [MongoDB Compass](https://www.mongodb.com/products/tools/compass) (miễn phí), kết nối bằng `MONGODB_URI`, mở collection `diaryEntries` → **Export Collection** → JSON. Ảnh/video nằm trong bucket R2 (Cloudflare tự lưu bền).

**Nâng cao** (bản xem trước cho nhánh thử, CI, quay về bản cũ, theo dõi mức dùng): [docs/deploy.md](docs/deploy.md).

<a id="gioi-han-mien-phi"></a>
## Giới hạn miễn phí

Các con số dưới đây là mức tại thời điểm viết; hãy xem trang giá chính thức để biết mức hiện hành.

| Dịch vụ | Dùng làm gì | Mức miễn phí (khoảng) | Lưu ý |
| --- | --- | --- | --- |
| [Vercel Hobby](https://vercel.com/pricing) | Chạy trang web | Đủ cho một trang cá nhân; vượt mức thì tính năng đó tạm bị khoá chứ không bị tính tiền | **Chỉ dự án cá nhân, phi thương mại** |
| [MongoDB Atlas M0](https://www.mongodb.com/pricing) | Lưu chữ | 512 MB | Không sao lưu tự động |
| [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/) | Lưu ảnh/video | 10 GB lưu trữ mỗi tháng | Có thể cần thẻ để bật; địa chỉ `r2.dev` bị giới hạn tốc độ |

<a id="gap-loi"></a>
## Gặp lỗi?

| Thấy gì | Thường là do | Cách xử lý |
| --- | --- | --- |
| Vercel báo **Build failed**, log nhắc `MONGODB_URI` | Thiếu hoặc nhầm biến `MONGODB_URI` | Vercel → Settings → Environment Variables sửa lại, rồi Deployments → **Redeploy** |
| Trang trắng / báo lỗi kết nối database | Chưa cho phép mạng (Bước 2.3); sai username/mật khẩu; mật khẩu có ký tự đặc biệt chưa mã hoá; quên tên database trong chuỗi | Làm lại từng mục ở Bước 2; dùng mật khẩu chỉ gồm chữ và số |
| Vào `/admin` không thấy ô mật khẩu mà thấy dòng *"Sổ đang khóa: chưa đặt mật khẩu"* | Chưa có biến `ADMIN_PASSWORD` (hoặc mới thêm mà chưa Redeploy) | Thêm biến rồi **Redeploy** |
| Báo *"Sai quá nhiều lần rồi. Thử lại sau … phút"* | Đã nhập sai mật khẩu 10 lần liên tiếp (cơ chế chống dò mật khẩu) | Chờ đủ số phút rồi thử lại |
| *"Không kết nối được R2"* khi tải ảnh | Chưa làm CORS, hoặc `AllowedOrigins` không khớp địa chỉ trang | Bước 5.2 mục 4 |
| *"R2 trả về lỗi 403…"* | Sai khoá truy cập hoặc tên bucket; token chưa đủ quyền | Kiểm tra lại 4 biến R2 và quyền **Object Read & Write** (Bước 3.3), rồi Redeploy |
| *"Chưa cấu hình Cloudflare R2 nên chưa tải ảnh/video lên được"* | Thiếu một trong 5 biến `R2_…` (nhớ cả `R2_PUBLIC_URL`) hoặc chưa Redeploy | Bước 5.2 mục 1–3 |
| Ảnh đã tải nhưng không hiện | `R2_PUBLIC_URL` sai hoặc chưa Enable *Public Development URL* | Bước 3.2; kiểm tra địa chỉ không có `/` ở cuối; rồi Redeploy |
| Xoá sự kiện xong báo *"còn N file trên R2 chưa xoá được"* | API token R2 chỉ có quyền ghi, chưa có quyền xoá | Tạo lại token với **Object Read & Write** (Bước 3.3), cập nhật biến, Redeploy; file cũ xoá tay trong Cloudflare |
| Lưu xong trang chủ chưa đổi | Trang chủ được lưu đệm tối đa 5 phút | Đợi một chút rồi tải lại |
| Đổi `NEXT_PUBLIC_YOUR_NAME` mà tên không đổi | Biến này được "đóng gói" lúc deploy | **Redeploy** |

Vẫn kẹt? Mở [một issue](https://github.com/lexanh112233/concerts-recap/issues) và kể rõ bạn đang ở bước nào, thấy thông báo gì. **Đừng dán mật khẩu hay chuỗi kết nối vào issue.**

<a id="bao-mat"></a>
## Bảo mật

- Đặt `ADMIN_PASSWORD` **dài** (từ 12 ký tự). Ai biết mật khẩu này là sửa/xoá được mọi thứ.
- Không chia sẻ `MONGODB_URI`, `R2_SECRET_ACCESS_KEY`, `ADMIN_PASSWORD`. Lỡ lộ thì đổi mật khẩu user MongoDB, tạo lại token R2, đổi `ADMIN_PASSWORD`, rồi Redeploy.
- Ảnh/video trên R2 là **công khai** cho ai có đường dẫn. Đừng tải lên thứ bạn không muốn ai thấy.
- Trang đã có sẵn: lọc nội dung chống chèn mã độc (XSS), chống giả mạo thao tác (CSRF), chống nhúng trang vào khung (clickjacking), giới hạn đăng nhập sai, header bảo mật. Chi tiết, giới hạn đã biết và cách báo lỗ hổng riêng tư: [SECURITY.md](SECURITY.md).

<a id="lap-trinh-vien"></a>
## Dành cho lập trình viên

**Công nghệ:** Next.js 16 (App Router, Server Actions, ISR), React 19, TypeScript, Tailwind CSS 4, MongoDB (Mongoose), Cloudflare R2 (S3 API), TipTap, Vitest.

**Chạy trên máy** (cần Node 22 và pnpm 10; `corepack enable` sẽ tự dùng đúng bản pnpm):

```bash
git clone https://github.com/lexanh112233/concerts-recap.git
cd concerts-recap
corepack enable
pnpm install
cp .env.example .env.local   # điền MONGODB_URI, ADMIN_PASSWORD (và R2_* nếu cần)
pnpm dev                     # http://localhost:3000
```

Đổi biến môi trường thì khởi động lại server. Các biến và ý nghĩa: xem [.env.example](.env.example).

**Kiểm thử** (không cần DB hay biến môi trường):

```bash
pnpm lint         # ESLint
pnpm typecheck    # next typegen + tsc --noEmit
pnpm test:run     # Vitest một lần (pnpm test: chế độ theo dõi)
```

**Cấu trúc và quy ước**

- `src/app/(vi)` và `src/app/en/(site)`: trang công khai tiếng Việt (`/`) và tiếng Anh (`/en`), đều là trang tĩnh (SSG/ISR, `revalidate = 300`). `src/app/admin` và `src/app/en/(admin)/admin`: trang quản trị (động). Ngôn ngữ do **đường dẫn** quyết định, không đọc cookie/header, nên trang công khai vẫn tĩnh. File route mỏng, thân trang ở `src/components/pages/*`.
- Chuỗi giao diện: `src/i18n/dictionaries/{vi,en}.ts` (công khai) và `src/i18n/admin/dictionaries/{vi,en}.ts` (quản trị); thêm vào `vi` trước, `en` thiếu khoá sẽ báo lỗi lúc typecheck. Nội dung từng đêm không dịch.
- Sau khi ghi dữ liệu phải `revalidatePath` **kèm tên nhóm route** cho trang chi tiết (`/(vi)/concerts/[slug]` và `/en/(site)/concerts/[slug]`), xem `revalidateSite()` trong `src/app/admin/actions.ts`; quên thì trang cũ lặng lẽ không cập nhật.
- Mọi Server Action ghi dữ liệu phải gọi `assertAdmin()`. Nhật ký lưu dạng HTML đã lọc qua `src/lib/sanitize.ts`; đừng thêm chỗ `dangerouslySetInnerHTML` nào khác.
- "Sắp diễn ra" **suy ra từ ngày** (`isUpcoming` trong `src/lib/concerts.ts`); trường `active` trong MongoDB chỉ có nghĩa hiển thị công khai. Khoản thu hồi lưu ở field `merchResale` (tên cũ, giữ nguyên để khỏi phải migrate).
- Xoá sự kiện xoá luôn file R2 nhưng chỉ file nằm thẳng trong `diary-images/` hoặc `diary-videos/` và không sự kiện khác dùng (`mediaKeysToDelete` trong `src/lib/media-hosts.ts`).
- Header bảo mật và CSP: `src/lib/security-headers.ts` (được `next.config.ts` dùng). Thêm nguồn ngoài (CDN, font ngoài…) thì phải sửa CSP ở đó và thử trên bản build production (`pnpm build && pnpm start`).
- Phiên đăng nhập: `src/lib/admin-auth.ts`; giới hạn đăng nhập sai: `src/lib/login-throttle.ts` (đếm trong collection `adminLoginAttempts`).
- Logic thuần nằm ở `src/lib/*` kèm `*.test.ts`; test cố định múi giờ `Asia/Ho_Chi_Minh`.

Vận hành nâng cao và CI: [docs/deploy.md](docs/deploy.md). Muốn đóng góp: mở issue hoặc pull request và chạy đủ ba lệnh kiểm thử ở trên trước khi gửi. Đọc [SECURITY.md](SECURITY.md) trước khi báo lỗi bảo mật.

## Giấy phép

[MIT](LICENSE) © 2026 lexanh112233. Bạn được dùng, sửa và chia sẻ lại tự do, kể cả thương mại; chỉ cần giữ dòng bản quyền. (Riêng dịch vụ **Vercel Hobby** chỉ dành cho dự án cá nhân, phi thương mại.)
