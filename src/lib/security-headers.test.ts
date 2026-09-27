import {describe, expect, it, vi} from "vitest";
import {createPresignedUpload} from "@/lib/r2";
import {contentSecurityPolicy, httpsOrigin, r2UploadOrigins, securityHeaders, securityHeadersFromEnv} from "@/lib/security-headers";

const PROD = {
    isDev: false,
    mediaOrigin: "https://media.example.com",
    uploadOrigins: ["https://abc123.r2.cloudflarestorage.com", "https://*.abc123.r2.cloudflarestorage.com"],
};
const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
const header = (list: ReturnType<typeof securityHeaders>, key: string) => list.find((h) => h.key === key)?.value;

describe("contentSecurityPolicy", () => {
    it("chặn nhúng iframe, plugin, thẻ <base>, form gửi ra ngoài", () => {
        const csp = contentSecurityPolicy(PROD);
        expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
        expect(directive(csp, "object-src")).toBe("object-src 'none'");
        expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
        expect(directive(csp, "form-action")).toBe("form-action 'self'");
        expect(directive(csp, "default-src")).toBe("default-src 'self'");
    });

    it("production: không 'unsafe-eval', không websocket", () => {
        const csp = contentSecurityPolicy(PROD);
        expect(csp).not.toContain("unsafe-eval");
        expect(csp).not.toMatch(/\bwss?:/);
    });

    it("dev: cần 'unsafe-eval' cho React và websocket cho HMR", () => {
        const csp = contentSecurityPolicy({...PROD, isDev: true});
        expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
        expect(directive(csp, "connect-src")).toContain("ws:");
    });

    it("origin của R2_PUBLIC_URL chỉ được vào img-src và media-src, origin tải lên chỉ vào connect-src", () => {
        const csp = contentSecurityPolicy(PROD);
        expect(directive(csp, "img-src")).toContain("https://media.example.com");
        expect(directive(csp, "media-src")).toContain("https://media.example.com");
        expect(directive(csp, "connect-src")).toContain("https://abc123.r2.cloudflarestorage.com");
        // URL đã ký dạng virtual-hosted: https://<bucket>.<account>.r2.cloudflarestorage.com (thiếu thì tải ảnh lên bị chặn)
        expect(directive(csp, "connect-src")).toContain("https://*.abc123.r2.cloudflarestorage.com");
        expect(directive(csp, "connect-src")).not.toContain("media.example.com");
        expect(directive(csp, "script-src")).not.toContain("example.com");
        expect(directive(csp, "script-src")).not.toContain("r2.cloudflarestorage.com");
        expect(directive(csp, "img-src")).not.toContain("r2.cloudflarestorage.com");
    });

    it("chưa cấu hình R2 thì không nới thêm nguồn nào", () => {
        const csp = contentSecurityPolicy({isDev: false, mediaOrigin: null, uploadOrigins: []});
        expect(directive(csp, "img-src")).toBe("img-src 'self' data: blob:");
        expect(directive(csp, "media-src")).toBe("media-src 'self' blob:");
        expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    });

    it("không có ký tự đại diện, http:, hay nguồn script ngoài", () => {
        const csp = contentSecurityPolicy(PROD);
        expect(csp).not.toMatch(/(^|[ ;])\*($|[ ;])/);
        expect(csp).not.toContain("http:");
        expect(directive(csp, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    });
});

describe("httpsOrigin", () => {
    it("lấy origin của URL https, bỏ đường dẫn", () => {
        expect(httpsOrigin("https://media.example.com/media/")).toBe("https://media.example.com");
        expect(httpsOrigin("https://media.example.com:8443/x")).toBe("https://media.example.com:8443");
    });

    it.each([undefined, "", "http://media.example.com", "không phải url", "javascript:alert(1)", "ftp://x.example.com"])("%j → null", (value) => {
        expect(httpsOrigin(value)).toBeNull();
    });
});

describe("r2UploadOrigins", () => {
    it("cho cả tên miền gốc của tài khoản lẫn mọi subdomain của nó (URL ký kiểu virtual-hosted có tên bucket làm subdomain)", () => {
        expect(r2UploadOrigins("abc123")).toEqual(["https://abc123.r2.cloudflarestorage.com", "https://*.abc123.r2.cloudflarestorage.com"]);
        expect(r2UploadOrigins(" ABC-123 ")).toEqual(["https://ABC-123.r2.cloudflarestorage.com", "https://*.ABC-123.r2.cloudflarestorage.com"]);
    });

    it("chỉ tài khoản của bạn: không có ký tự đại diện ở cấp tên miền chung", () => {
        for (const origin of r2UploadOrigins("abc123")) expect(origin).not.toMatch(/^https:\/\/\*\.r2\./);
    });

    // giá trị lạ không được chèn thêm chỉ thị hay nguồn vào CSP
    it.each([undefined, "", "a b", "a;script-src *", "a\nb", "evil.com/x", "a.b", "a:1"])("%j → không có origin nào", (value) => {
        expect(r2UploadOrigins(value)).toEqual([]);
    });
});

describe("securityHeaders", () => {
    const list = securityHeaders(PROD);

    it("có đủ các header bảo mật cơ bản", () => {
        expect(header(list, "X-Content-Type-Options")).toBe("nosniff");
        expect(header(list, "X-Frame-Options")).toBe("DENY");
        expect(header(list, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
        expect(header(list, "Permissions-Policy")).toContain("camera=()");
        expect(header(list, "Content-Security-Policy")).toBe(contentSecurityPolicy(PROD));
    });

    it("HSTS không kéo cả subdomain và không đòi preload (người dùng có thể chạy thứ khác ở subdomain)", () => {
        const hsts = header(list, "Strict-Transport-Security") ?? "";
        expect(hsts).toMatch(/^max-age=\d+$/);
        expect(hsts).not.toContain("includeSubDomains");
        expect(hsts).not.toContain("preload");
    });

    it("mỗi header chỉ xuất hiện một lần và giá trị không chứa xuống dòng", () => {
        expect(new Set(list.map((h) => h.key)).size).toBe(list.length);
        for (const {value} of list) expect(value).not.toMatch(/[\r\n]/);
    });
});

describe("securityHeadersFromEnv", () => {
    it("đọc R2_PUBLIC_URL và R2_ACCOUNT_ID từ biến môi trường", () => {
        const csp = header(securityHeadersFromEnv({R2_PUBLIC_URL: "https://media.example.com/", R2_ACCOUNT_ID: "abc123"}, false), "Content-Security-Policy") ?? "";
        expect(directive(csp, "img-src")).toContain("https://media.example.com");
        expect(directive(csp, "connect-src")).toContain("https://abc123.r2.cloudflarestorage.com");
        expect(directive(csp, "connect-src")).toContain("https://*.abc123.r2.cloudflarestorage.com");
    });

    it("biến trống hoặc sai định dạng thì bỏ qua thay vì làm hỏng header", () => {
        const csp = header(securityHeadersFromEnv({R2_PUBLIC_URL: "không phải url", R2_ACCOUNT_ID: "a;b"}, false), "Content-Security-Policy") ?? "";
        expect(directive(csp, "img-src")).toBe("img-src 'self' data: blob:");
        expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    });
});

// Bộ khớp nguồn CSP tối giản (chỉ https://host và https://*.host) đủ để so với URL thật
function allowedBy(origin: string, directiveText: string): boolean {
    const {protocol, host} = new URL(origin);
    return directiveText.split(" ").slice(1).some((source) => {
        if (!source.startsWith("https://")) return false;
        const sourceHost = source.slice("https://".length);
        return sourceHost.startsWith("*.") ? host.endsWith(sourceHost.slice(1)) && protocol === "https:" : source === origin;
    });
}

// CSP phải cho phép ĐÚNG những địa chỉ mà code thật sinh ra. (Lần thử đầu chỉ cho https://<account>.r2..., trong khi URL đã ký của SDK dùng dạng
// https://<bucket>.<account>.r2...: mọi lần tải ảnh lên đều bị chặn mà test đơn vị không ai thấy, chỉ lộ khi thử trên trình duyệt.)
describe("CSP khớp với địa chỉ thật của R2", () => {
    const env = {
        R2_ACCOUNT_ID: "abc123",
        R2_ACCESS_KEY_ID: "khoa-truy-cap",
        R2_SECRET_ACCESS_KEY: "khoa-bi-mat",
        R2_BUCKET: "my-bucket",
        R2_PUBLIC_URL: "https://media.example.com",
    };

    it("URL PUT đã ký (ký thật bằng SDK, không qua mạng) nằm trong connect-src; URL công khai nằm trong img-src và media-src", async () => {
        for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
        const {uploadUrl, publicUrl} = await createPresignedUpload("image/jpeg", 2048);
        const csp = header(securityHeadersFromEnv(env, false), "Content-Security-Policy") ?? "";

        expect(new URL(uploadUrl).host).toBe("my-bucket.abc123.r2.cloudflarestorage.com");
        expect(allowedBy(new URL(uploadUrl).origin, directive(csp, "connect-src"))).toBe(true);
        expect(allowedBy(new URL(publicUrl).origin, directive(csp, "img-src"))).toBe(true);
        expect(allowedBy(new URL(publicUrl).origin, directive(csp, "media-src"))).toBe(true);
        // và không cho nhầm tài khoản R2 khác
        expect(allowedBy("https://my-bucket.khac999.r2.cloudflarestorage.com", directive(csp, "connect-src"))).toBe(false);
    });
});
