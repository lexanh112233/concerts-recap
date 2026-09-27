# Vận hành nâng cao: môi trường xem thử, CI, tên miền, sự cố

Tài liệu này dành cho người đã dựng xong trang theo [README](../README.md) và muốn vận hành cẩn thận hơn: tách môi trường thử khỏi dữ liệu thật, chạy kiểm tra tự động, gắn tên miền riêng, xử lý sự cố.

**Kiến trúc:** code trên GitHub → **Vercel** build và chạy web (SSR, Server Actions, ISR) → chữ ở **MongoDB Atlas** → ảnh/video ở **Cloudflare R2**. **GitHub Actions** chỉ chạy lint, typecheck và test.

## 1. Kiểm tra ở máy trước khi push

Cần Node 22 và pnpm 10 (`corepack enable` sẽ tự dùng đúng bản theo `packageManager` trong `package.json`).

```bash
pnpm lint          # ESLint (cảnh báo được phép, lỗi thì không)
pnpm typecheck     # next typegen && tsc --noEmit, gồm cả file test
pnpm test:run      # unit test một lần (pnpm test = chế độ theo dõi khi đang sửa code)
```

`typecheck` chạy `next typegen` trước vì các kiểu `PageProps`/`LayoutProps` do Next sinh ra trong `.next` (không được commit); CI checkout sạch nên nếu thiếu bước này `tsc` sẽ báo `Cannot find name 'PageProps'`.

Unit test nằm cạnh code (`src/**/*.test.ts`), chỉ kiểm tra logic thuần nên **không cần** MongoDB, R2 hay biến môi trường. Test cố định múi giờ `Asia/Ho_Chi_Minh` (xem `vitest.global-setup.ts`); thử múi giờ khác bằng `TZ=UTC pnpm test:run`.

Trước khi tin một thay đổi ảnh hưởng tới header/CSP, kiểm tra thêm trên **bản build production**: `pnpm build && pnpm start`, mở trang và xem Console trình duyệt có báo `Content-Security-Policy` không (chạy `pnpm dev` dùng CSP nới lỏng nên không thấy hết).

## 2. Hai môi trường: Production và Preview

Vercel tự chia hai loại deploy:

- **Production:** nhánh `main`. Là trang thật của bạn.
- **Preview:** mọi nhánh khác và pull request. Mỗi lần push có một địa chỉ xem thử riêng.

Nên để Preview dùng **database riêng** để thử nghiệm không đụng dữ liệu thật:

1. Ở Atlas, tạo thêm một chuỗi kết nối y hệt nhưng **đổi tên database** (phần sau `.mongodb.net/`, ví dụ `nhat-ky` → `nhat-ky-preview`). Cùng một user vẫn dùng được nếu có quyền đọc/ghi mọi database.
2. Vercel → Settings → Environment Variables: khi thêm mỗi biến, tick đúng môi trường ở cột **Environments**:

| Biến | Production | Preview |
| --- | --- | --- |
| `MONGODB_URI` | chuỗi thật | chuỗi có tên database khác |
| `ADMIN_PASSWORD` | mật khẩu mạnh | mật khẩu khác |
| `NEXT_PUBLIC_YOUR_NAME` | tên của bạn | như Production |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | có | **bỏ trống cả 5** để admin của bản Preview không ghi/xoá file trong bucket thật (khi đó form vẫn sửa được chữ, chỉ chưa tải được ảnh) |

Lưu ý:
- `MONGODB_URI` **bắt buộc ở cả hai môi trường**: `src/lib/db.ts` báo lỗi ngay khi thiếu và trang chủ đọc DB lúc build.
- Đổi biến môi trường **không** áp dụng cho bản đã deploy: phải **Redeploy**. Với `NEXT_PUBLIC_YOUR_NAME`, `R2_PUBLIC_URL`, `R2_ACCOUNT_ID` càng phải Redeploy vì chúng được dùng lúc build (tên hiển thị, host ảnh được phép, Content-Security-Policy).
- Bản Preview mặc định cần đăng nhập Vercel để xem (Deployment Protection); muốn gửi người khác xem thì dùng Shareable Link ở đó.

## 3. Vercel: các thiết lập nên kiểm

- **Settings → General → Node.js Version = 22.x** (khớp `engines` trong `package.json` và CI).
- **Settings → Git → Production Branch = `main`.**
- **Settings → Functions → Function Region:** chọn vùng gần cluster Atlas để giảm độ trễ mỗi lần đọc DB.
- Build dùng pnpm 10 theo `packageManager`; **không** đổi Build/Install Command.

## 4. CORS cho R2 (để tải ảnh từ trang quản trị)

Trình duyệt tải file thẳng lên R2 bằng URL đã ký nên bucket phải cho phép `PUT` từ địa chỉ trang của bạn. Cloudflare → R2 → bucket → Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://<địa-chỉ-trang-của-bạn>"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Có tên miền riêng thì thêm nó vào `AllowedOrigins`. Sau đó thử thêm một ảnh trong `/admin` (nhớ **Lưu**: ảnh chỉ lên R2 lúc bấm Lưu).

**Quyền của API token R2:** cần **Object Read & Write**. Xoá một sự kiện trong `/admin` cũng xoá luôn ảnh/video của nó trên R2 bằng chính token này; token thiếu quyền xoá thì sự kiện vẫn bị xoá nhưng giấy nhớ báo "còn N file trên R2 chưa xoá được" và các file đó nằm lại bucket (xoá tay trong Cloudflare hoặc cấp lại quyền cho token).

## 5. CI bằng GitHub Actions

Repo đã có sẵn `.github/workflows/ci.yaml`: chạy `pnpm lint`, `pnpm typecheck`, `pnpm test:run` cho mỗi push vào `main`/`dev` và mỗi pull request.

- **Không cần secret nào**: test không chạm DB/R2/mạng.
- **Không chạy `next build` trong CI** vì build cần DB thật; Vercel đã build mỗi lần push và báo trạng thái lên PR.
- Workflow chỉ có quyền đọc (`permissions: contents: read`), không dùng `pull_request_target`, nên PR từ fork không thể lấy được secret.
- `.github/dependabot.yml` tự mở PR cập nhật thư viện và vá bảo mật hằng tuần; đọc changelog, để CI xanh rồi mới merge.

**Kiểm tra CI hoạt động thật:** trên một nhánh thử, cố tình sửa một test cho sai (vd. đổi kết quả mong đợi trong `src/lib/price.test.ts`), push: CI phải **đỏ**. Xong xoá nhánh thử.

**Bắt buộc CI xanh mới được merge:** repo public thì bật được *branch protection* miễn phí (GitHub → Settings → Branches → Add rule cho `main` → *Require status checks to pass* → chọn `check`). Repo private ở gói Free thì không bật được; khi đó chỉ merge khi CI xanh là kỷ luật của bạn.

## 6. Vận hành

- **Theo dõi mức dùng:** Vercel → **Usage** mỗi tháng. Vượt hạn mức gói Hobby thì tính năng đó bị khoá tạm thời chứ không bị tính tiền.
- **Quay về bản cũ:** Vercel → Deployments → chọn bản production cũ → **Promote to Production** / *Instant Rollback*.
- **Đổi mật khẩu admin:** sửa `ADMIN_PASSWORD` rồi Redeploy; mọi phiên đăng nhập cũ tự mất hiệu lực (khoá ký phiên dẫn xuất từ mật khẩu). Đây cũng là cách thu hồi phiên nếu nghi bị lộ cookie: đăng xuất chỉ xoá cookie trên máy đó.
- **Tên miền riêng:** Vercel → Settings → Domains → Add, trỏ DNS theo hướng dẫn. Thêm tên miền vào CORS của R2 (mục 4). Nếu có đặt tên miền riêng cho bucket R2, đặt `R2_PUBLIC_URL` thành tên miền đó rồi Redeploy; ảnh cũ lưu địa chỉ `r2.dev` sẽ **không hiện nữa** vì chỉ host của `R2_PUBLIC_URL` được phép, nên hãy cân nhắc trước (hoặc cập nhật lại địa chỉ ảnh trong DB).
- **Bị dò mật khẩu / tấn công:** bật **Attack Challenge Mode** hoặc thêm rule rate limit trong **Vercel → Firewall**. Trang đã giới hạn 10 lần đăng nhập sai / 15 phút / IP nhưng không chống được tấn công từ nhiều IP.
- **Sao lưu:** Atlas M0 không sao lưu tự động; xuất collection `diaryEntries` định kỳ bằng MongoDB Compass (README, mục Cập nhật, tên miền riêng, sao lưu).

## 7. Sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| Build lỗi `Vui lòng định nghĩa MONGODB_URI` | Thiếu biến ở môi trường đang build (hay quên **Preview**) | Thêm biến rồi Redeploy |
| Build/trang treo hoặc lỗi kết nối DB | Atlas chưa cho `0.0.0.0/0`; sai user/mật khẩu; mật khẩu chưa URL-encode; chuỗi kết nối thiếu tên database | Xem README, Bước 2 |
| Ảnh không hiện | `R2_PUBLIC_URL` sai/thiếu hoặc chưa Redeploy sau khi đặt; hết hạn mức tối ưu ảnh của Vercel | Kiểm tra biến rồi Redeploy; xem Usage |
| Ảnh hiện trên trang nhưng bị chặn trong Console với lỗi `Content-Security-Policy` | Nguồn ảnh/video hoặc điểm cuối R2 không khớp `R2_PUBLIC_URL`/`R2_ACCOUNT_ID` lúc build | Kiểm tra hai biến rồi Redeploy |
| Admin báo lỗi mạng khi tải ảnh | Chưa thêm địa chỉ trang vào CORS của R2 | Mục 4 |
| `/admin` không đăng nhập được | `ADMIN_PASSWORD` chưa đặt ở môi trường đó; hoặc đang bị khoá do sai 10 lần | Mục 2, rồi Redeploy; hoặc chờ hết thời gian khoá |
| Lưu xong trang công khai chưa đổi | Trang chủ cache tối đa 5 phút (`revalidate = 300`); lưu từ admin đã gọi `revalidatePath` | Tải lại sau vài giây; xem Runtime Logs |
| Sau khi cập nhật lên bản mới, bị đăng xuất | Đổi cách ký phiên (bản có tiền tố cookie `__Host-`) làm cookie cũ hết hiệu lực | Đăng nhập lại một lần |
| CI đỏ ở bước cài đặt | Lockfile lệch `package.json` | Chạy `pnpm install` ở máy rồi commit `pnpm-lock.yaml` |

Xem log: Vercel → Deployments → chọn bản → **Logs / Runtime Logs**.

## 8. Việc có thể làm sau

- **Ảnh phục vụ từ `pub-….r2.dev`** bị Cloudflare giới hạn tốc độ và chỉ để thử nghiệm: nếu trang đông người xem, gắn tên miền riêng cho bucket rồi đặt `R2_PUBLIC_URL` (xem cảnh báo về ảnh cũ ở mục 6).
- **Nếu Active CPU của Vercel sát hạn mức:** trang chủ tính màu vé bằng `sharp` mỗi lần ISR/khởi động lạnh; có thể chuyển sang tính lúc lưu sự kiện và lưu màu vào DB.
- **Test nâng cao:** component cần thêm jsdom + Testing Library; server action đã có test với DB giả (mock), nếu cần test tích hợp thật thì dùng `mongodb-memory-server`.
