// Header bảo mật gửi kèm mọi phản hồi (next.config.ts dùng qua headers()). Module thuần, không import gì từ Next nên test được và
// next.config.ts import được bằng đường dẫn tương đối.
//
// CSP ở đây là kiểu TĨNH, không dùng nonce: nonce buộc mọi trang phải dựng động (theo chính tài liệu Next), mà các trang công khai của dự án
// là trang tĩnh (SSG/ISR) và chạy trên gói Vercel Hobby có hạn mức CPU. Đánh đổi cần biết: vì có 'unsafe-inline' cho script (Next cần nó để hydrate),
// CSP này KHÔNG chặn được chèn script inline. Lớp chống XSS chính vẫn là bộ lọc HTML nhật ký (lib/sanitize.ts). CSP ở đây chặn: tải script từ
// nguồn ngoài, gửi dữ liệu ra domain lạ (connect/img/media), nhúng trang vào iframe (clickjacking), thẻ <base>, plugin/object, form gửi ra ngoài.

export interface SecurityHeaderInput {
    // dev cần 'unsafe-eval' (React dùng eval để dựng stack lỗi) và websocket của HMR
    isDev: boolean
    // origin của R2_PUBLIC_URL: nơi ảnh/video được tải về để hiển thị
    mediaOrigin: string | null
    // các origin nhận file tải lên: trình duyệt PUT thẳng lên đây bằng URL đã ký
    uploadOrigins: string[]
}

// Origin (https://host[:port]) của một URL https; null nếu không phải URL https hợp lệ.
export function httpsOrigin(value: string | undefined): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.origin : null;
    } catch {
        return null;
    }
}

// Điểm cuối S3 của R2 của ĐÚNG tài khoản này. URL đã ký dạng "virtual-hosted" (tên bucket là subdomain: https://<bucket>.<account>.r2.cloudflarestorage.com/...)
// nên phải cho cả subdomain lẫn tên miền gốc của tài khoản (thiếu subdomain thì mọi lần tải ảnh lên đều bị CSP chặn; đã gặp khi thử thật).
// Account ID chỉ gồm chữ/số/gạch nối: giá trị lạ (dấu cách, chấm phẩy, xuống dòng...) bị bỏ để không thể chèn thêm chỉ thị CSP.
export function r2UploadOrigins(accountId: string | undefined): string[] {
    const id = (accountId ?? "").trim();
    if (!/^[a-z0-9-]+$/i.test(id)) return [];
    return [`https://${id}.r2.cloudflarestorage.com`, `https://*.${id}.r2.cloudflarestorage.com`];
}

export function contentSecurityPolicy({isDev, mediaOrigin, uploadOrigins}: SecurityHeaderInput): string {
    const media = mediaOrigin ? [mediaOrigin] : [];
    const directives: Array<[string, string[]]> = [
        ["default-src", ["'self'"]],
        ["script-src", ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])]],
        ["style-src", ["'self'", "'unsafe-inline'"]],
        // data: (ảnh mờ placeholder của next/image), blob: (xem trước file vừa chọn trước khi tải lên)
        ["img-src", ["'self'", "data:", "blob:", ...media]],
        ["media-src", ["'self'", "blob:", ...media]],
        ["font-src", ["'self'"]],
        ["connect-src", ["'self'", ...uploadOrigins, ...(isDev ? ["ws:", "wss:"] : [])]],
        ["worker-src", ["'self'", "blob:"]],
        ["object-src", ["'none'"]],
        ["base-uri", ["'self'"]],
        ["form-action", ["'self'"]],
        ["frame-ancestors", ["'none'"]],
    ];
    return directives.map(([name, sources]) => `${name} ${sources.join(" ")}`).join("; ");
}

export function securityHeaders(input: SecurityHeaderInput): Array<{ key: string, value: string }> {
    return [
        {key: "Content-Security-Policy", value: contentSecurityPolicy(input)},
        {key: "X-Content-Type-Options", value: "nosniff"},
        // CSP frame-ancestors đã đủ cho trình duyệt mới; giữ thêm cho trình duyệt cũ
        {key: "X-Frame-Options", value: "DENY"},
        {key: "Referrer-Policy", value: "strict-origin-when-cross-origin"},
        {key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"},
        // Không có includeSubDomains/preload: người dùng có thể đặt trang trên tên miền riêng còn chạy thứ khác ở subdomain. Trình duyệt bỏ qua
        // header này trên http nên chạy localhost không bị ảnh hưởng.
        {key: "Strict-Transport-Security", value: "max-age=31536000"},
    ];
}

export function securityHeadersFromEnv(env: Record<string, string | undefined>, isDev: boolean) {
    return securityHeaders({
        isDev,
        mediaOrigin: httpsOrigin(env.R2_PUBLIC_URL),
        uploadOrigins: r2UploadOrigins(env.R2_ACCOUNT_ID),
    });
}
