# Bảo mật / Security

[Tiếng Việt](#tiếng-việt) · [English](#english)

---

## Tiếng Việt

### Báo lỗ hổng bảo mật

**Đừng mở issue công khai** cho lỗ hổng bảo mật (người khác sẽ thấy trước khi kịp sửa).

1. Vào tab **Security** của repo trên GitHub, chọn **Report a vulnerability** (báo cáo riêng tư, chỉ người duy trì thấy).
2. Mô tả: lỗi ở đâu, cách tái hiện từng bước, ảnh hưởng, phiên bản/commit.

Đây là dự án cá nhân do người duy trì làm trong thời gian rảnh: mình sẽ phản hồi sớm nhất có thể nhưng không cam kết thời hạn.

### Phạm vi

Mã nguồn trong repo này. Không thuộc phạm vi: lỗi của Vercel, MongoDB Atlas, Cloudflare (hãy báo cho họ), hay việc ai đó đặt mật khẩu yếu / làm lộ biến môi trường của chính họ.

### Những gì đã có sẵn trong code

| Mối nguy | Cách phòng |
| --- | --- |
| **XSS** (chèn script qua nhật ký) | Nhật ký được lọc bằng `sanitize-html` theo danh sách cho phép (không script, không thuộc tính `on*`, không `javascript:`, không `img`/`iframe`) ở 3 chỗ: lúc lưu, lúc nạp vào trình soạn thảo, lúc hiển thị. Chỉ có một chỗ chèn HTML thô trong toàn bộ code. React tự thoát ký tự cho mọi chỗ còn lại. Không cho tải SVG/HTML lên; ảnh/video chỉ nhận từ đúng địa chỉ bucket của bạn (`R2_PUBLIC_URL`). |
| **CSRF** (trang lạ giả mạo thao tác) | Mọi thao tác ghi là Server Action của Next.js: chỉ nhận POST và tự so `Origin` với `Host`; cookie đăng nhập `SameSite=Lax`, `HttpOnly`, `Secure` (production) và mang tiền tố `__Host-`. Mọi action ghi dữ liệu đều kiểm tra đăng nhập ở phía server. |
| **Clickjacking** (nhúng trang vào iframe) | `Content-Security-Policy: frame-ancestors 'none'` và `X-Frame-Options: DENY`. |
| **Tải tài nguyên lạ / rò dữ liệu ra ngoài** | Content-Security-Policy giới hạn script, ảnh, video, kết nối chỉ về đúng nguồn của bạn (xem `src/lib/security-headers.ts`); thêm `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS. |
| **Dò mật khẩu** | Tối đa 10 lần sai trong 15 phút cho mỗi IP (đếm trong MongoDB, chỉ lưu bản băm của IP), cộng độ trễ mỗi lần sai. |
| **Giả cookie đăng nhập** | Cookie ký HMAC bằng khoá dẫn xuất từ mật khẩu qua `scrypt` (không dùng mật khẩu thô), có hạn 7 ngày. Đổi `ADMIN_PASSWORD` là đăng xuất mọi thiết bị. |
| **SSRF** (bắt server gọi địa chỉ nội bộ) | Hai chỗ server tự tải ảnh đều chỉ nhận `https` từ host của `R2_PUBLIC_URL`. |
| **Lộ bí mật** | Bí mật chỉ nằm trong biến môi trường; `.env*` bị `.gitignore` chặn; lịch sử git đã được quét, không có khoá nào bị commit. Client chỉ nhận biến `NEXT_PUBLIC_YOUR_NAME` (tên hiển thị). |
| **Xoá nhầm** | Luôn có hộp thoại xác nhận; server chỉ xoá file R2 nằm thẳng trong `diary-images/`, `diary-videos/` của bucket và không còn sự kiện nào khác dùng. |
| **Thư viện có lỗ hổng** | CI chạy lint, typecheck, test; Dependabot tự mở PR cập nhật và vá bảo mật. |

### Giới hạn đã biết (nói thẳng)

- CSP dùng kiểu **tĩnh**, có `'unsafe-inline'` cho script (Next.js cần để hydrate). CSP nghiêm ngặt kiểu nonce buộc mọi trang chuyển sang render động, làm mất trang tĩnh (SSG/ISR) của trang công khai. Vì vậy lớp chống XSS chính vẫn là bộ lọc HTML ở trên, CSP là lớp phụ (chặn script ngoài, rò dữ liệu, iframe).
- Phiên đăng nhập không lưu ở server: **Đăng xuất chỉ xoá cookie trên máy đó**; cookie đã bị lấy cắp vẫn dùng được tới khi hết hạn (7 ngày). Muốn thu hồi tất cả: đổi `ADMIN_PASSWORD` rồi Redeploy.
- Chỉ có một mật khẩu quản trị, không có xác thực hai lớp. Hãy dùng mật khẩu dài, khó đoán.
- Giới hạn đăng nhập tính theo IP: kẻ tấn công có nhiều IP vẫn thử được nhiều hơn. Nếu bị tấn công, bật **Vercel Firewall / Attack Challenge Mode**.
- Ảnh/video trên R2 là **công khai** cho bất kỳ ai có đường dẫn. Đừng tải lên thứ bạn không muốn ai thấy. Địa chỉ `r2.dev` bị Cloudflare giới hạn tốc độ và chỉ dành cho thử nghiệm; trang đông người xem thì gắn tên miền riêng cho bucket.

### Việc bạn nên làm khi tự chạy trang này

- Đặt `ADMIN_PASSWORD` dài (từ 12 ký tự, ví dụ một cụm từ dài), không dùng lại mật khẩu ở nơi khác.
- Không chia sẻ `MONGODB_URI`, `R2_SECRET_ACCESS_KEY`, `ADMIN_PASSWORD`; không dán vào issue/ảnh chụp màn hình. Nếu lỡ lộ: đổi mật khẩu người dùng MongoDB, tạo lại API token R2, đổi `ADMIN_PASSWORD`, rồi Redeploy.
- Tạo user MongoDB riêng cho trang này với quyền đọc/ghi (không dùng quyền quản trị *Atlas admin*); token R2 chỉ cấp cho đúng một bucket.
- Bật trên GitHub: Secret scanning + Push protection, Dependabot alerts.

---

## English

### Reporting a vulnerability

**Please do not open a public issue** for security problems.

1. Open the **Security** tab of the GitHub repository and choose **Report a vulnerability** (private report, visible only to the maintainer).
2. Include what is affected, step-by-step reproduction, impact, and the version/commit.

This is a personal hobby project: I will reply as soon as I can but cannot promise a deadline.

### Scope

The source code in this repository. Out of scope: issues in Vercel, MongoDB Atlas or Cloudflare themselves (report those to the vendor), and deployments where someone chose a weak password or leaked their own environment variables.

### What is built in

- **XSS:** journal HTML is sanitized with an allow-list (`sanitize-html`) on save, on load into the editor and on render; there is exactly one raw-HTML sink in the whole codebase; SVG/HTML uploads are rejected; media is only accepted from your own bucket address (`R2_PUBLIC_URL`).
- **CSRF:** all writes are Next.js Server Actions (POST only, `Origin` is checked against `Host`); the session cookie is `SameSite=Lax`, `HttpOnly`, `Secure` in production with the `__Host-` prefix; every mutating action re-checks the session on the server.
- **Clickjacking / resource loading:** Content-Security-Policy (`frame-ancestors 'none'`, scripts/images/media/connections limited to your own origins), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS. See `src/lib/security-headers.ts`.
- **Brute force:** at most 10 wrong passwords per 15 minutes per IP (counted in MongoDB, only a hash of the IP is stored) plus a delay on each failure.
- **Session forgery:** the cookie is signed with an HMAC key derived from the password using `scrypt`, valid for 7 days. Changing `ADMIN_PASSWORD` signs everyone out.
- **SSRF:** both server-side image fetchers accept only `https` URLs on the `R2_PUBLIC_URL` host.
- **Secrets:** only in environment variables; `.env*` is git-ignored; the git history was scanned and contains no keys.
- **Dependencies:** CI (lint, typecheck, tests) and Dependabot updates.

### Known limitations

- The CSP is **static** and allows `'unsafe-inline'` scripts (Next.js needs it to hydrate); a nonce-based strict CSP would force every page to render dynamically and lose static generation. The HTML sanitizer remains the primary XSS defence; the CSP is a second layer.
- Sessions are stateless: **logging out only removes the cookie on that device**; a stolen cookie stays valid until it expires (7 days). To revoke everything, change `ADMIN_PASSWORD` and redeploy.
- One admin password, no two-factor authentication: use a long passphrase.
- Login throttling is per IP; consider Vercel Firewall / Attack Challenge Mode if you are targeted.
- Files in the R2 bucket are public to anyone with the link; `r2.dev` URLs are rate-limited and intended for development only.

### Recommendations when self-hosting

Use a long `ADMIN_PASSWORD` (12+ characters), never share or paste your environment variables, create a dedicated MongoDB user with read/write (not admin) rights and a bucket-scoped R2 token, and enable GitHub secret scanning with push protection and Dependabot alerts.
