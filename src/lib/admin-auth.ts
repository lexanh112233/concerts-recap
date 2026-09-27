import {createHash, createHmac, scryptSync, timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {DEFAULT_LANG, pathFor, type Lang} from "@/i18n/config";

// Đăng nhập admin đơn giản bằng một mật khẩu trong .env (ADMIN_PASSWORD).
// Không đặt biến này thì mọi thứ trong /admin đều bị từ chối.
// Tên gốc của cookie phiên. Tên thật xem adminCookieName(): ở production có thêm tiền tố "__Host-".
export const ADMIN_COOKIE = "cj_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
// Muối cố định cho việc dẫn xuất khoá ký. Đổi chuỗi này (hay cách ký) là đăng xuất mọi phiên đang có.
const SESSION_SALT = "concerts-recap/admin-session/v1";

// Cookie chỉ gắn cờ Secure ở production (chạy http://localhost khi phát triển vẫn đăng nhập được).
const secureCookies = () => process.env.NODE_ENV === "production";

// Ở production cookie mang tiền tố "__Host-": trình duyệt chỉ nhận khi có Secure, path=/ và KHÔNG có Domain, tức là cookie gắn cứng vào đúng
// host này, subdomain hay trang khác cùng tên miền gốc không ghi đè được. Ở dev (http) không dùng được tiền tố này vì nó bắt buộc Secure.
export const adminCookieName = () => (secureCookies() ? `__Host-${ADMIN_COOKIE}` : ADMIN_COOKIE);

export function isAdminConfigured() {
    return Boolean(process.env.ADMIN_PASSWORD);
}

const digest = (value: string) => createHash("sha256").update(value).digest();

// So sánh băm để hằng thời gian và không phụ thuộc độ dài mật khẩu
export function checkPassword(input: string) {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) return false;
    return timingSafeEqual(digest(input), digest(password));
}

// Khoá ký KHÔNG phải mật khẩu thô mà là kết quả của scrypt (hàm băm cố ý chậm) trên mật khẩu: ai lấy được cookie cũng không dò mật khẩu offline
// nhanh được (mỗi lần thử tốn ~vài chục ms thay vì một phép HMAC). Vẫn không cần biến môi trường nào thêm, và đổi mật khẩu thì khoá đổi theo,
// nên mọi phiên đang đăng nhập bị vô hiệu. Tính một lần mỗi tiến trình rồi nhớ theo giá trị mật khẩu.
let keyCache: { password: string, key: Buffer } | null = null;

function signingKey() {
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (keyCache?.password !== password) keyCache = {password, key: scryptSync(password, SESSION_SALT, 32)};
    return keyCache.key;
}

function sign(expiresAt: string) {
    return createHmac("sha256", signingKey()).update(`admin:${expiresAt}`).digest("base64url");
}

export async function startAdminSession() {
    const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
    (await cookies()).set(adminCookieName(), `${expiresAt}.${sign(expiresAt)}`, {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookies(),
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
    });
}

export async function endAdminSession() {
    (await cookies()).delete(adminCookieName());
}

export async function isAdmin() {
    if (!isAdminConfigured()) return false;
    const token = (await cookies()).get(adminCookieName())?.value;
    if (!token) return false;

    const [expiresAt, signature] = token.split(".");
    if (!expiresAt || !signature || Number(expiresAt) <= Date.now() / 1000) return false;

    const actual = Buffer.from(signature);
    const expected = Buffer.from(sign(expiresAt));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Dùng ở đầu mỗi server action: throw nếu chưa đăng nhập.
export async function assertAdmin() {
    if (!(await isAdmin())) throw new Error("Chưa đăng nhập quản trị.");
}

// Dùng ở đầu các trang admin con (thêm/sửa): chuyển về /admin (hoặc /en/admin, cùng ngôn ngữ) nếu chưa đăng nhập. Ở đó là cuốn sổ còn khoá, mật khẩu điền trên bìa.
export async function requireAdmin(lang: Lang = DEFAULT_LANG) {
    if (!(await isAdmin())) redirect(pathFor(lang, "/admin"));
}
