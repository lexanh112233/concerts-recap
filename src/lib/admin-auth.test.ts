import {createHmac, scryptSync} from "node:crypto";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

// Cookie giả thay cho next/headers, và redirect ném lỗi như Next thật (redirect ném NEXT_REDIRECT để dừng luồng chạy)
const state = vi.hoisted(() => ({
    jar: new Map<string, string>(),
    lastSet: null as null | { name: string, value: string, options: Record<string, unknown> },
}));

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (state.jar.has(name) ? {name, value: state.jar.get(name)!} : undefined),
        set: (name: string, value: string, options: Record<string, unknown>) => {
            state.jar.set(name, value);
            state.lastSet = {name, value, options};
        },
        delete: (name: string) => {
            state.jar.delete(name);
        },
    }),
}));

vi.mock("next/navigation", () => ({
    redirect: (url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    },
}));

const {ADMIN_COOKIE, adminCookieName, assertAdmin, checkPassword, endAdminSession, isAdmin, isAdminConfigured, requireAdmin, startAdminSession} =
    await import("@/lib/admin-auth");

const PASSWORD = "mat-khau-bi-mat";
const DAY = 24 * 60 * 60;
const T0 = new Date("2026-09-20T00:00:00.000Z");

beforeEach(() => {
    state.jar.clear();
    state.lastSet = null;
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    vi.useFakeTimers({toFake: ["Date"]});
    vi.setSystemTime(T0);
});

afterEach(() => {
    vi.useRealTimers();
});

const advance = (seconds: number) => vi.setSystemTime(new Date(T0.getTime() + seconds * 1000));
const token = () => state.jar.get(adminCookieName())!;
const setToken = (value: string) => state.jar.set(adminCookieName(), value);
// Cách ký hiện hành viết lại độc lập ở đây (hợp đồng của định dạng cookie: đổi cách ký là đăng xuất mọi phiên, nên phải cố ý)
const sign = (expiresAt: string, password = PASSWORD) =>
    createHmac("sha256", scryptSync(password, "concerts-recap/admin-session/v1", 32)).update(`admin:${expiresAt}`).digest("base64url");
// Cách ký CŨ (khoá là mật khẩu thô): không còn được chấp nhận
const legacySign = (expiresAt: string, password = PASSWORD) => createHmac("sha256", password).update(`nkan-admin:${expiresAt}`).digest("base64url");

describe("isAdminConfigured", () => {
    it("bật khi có ADMIN_PASSWORD, tắt khi thiếu hoặc rỗng", () => {
        expect(isAdminConfigured()).toBe(true);
        vi.stubEnv("ADMIN_PASSWORD", "");
        expect(isAdminConfigured()).toBe(false);
    });
});

describe("checkPassword", () => {
    it("đúng mật khẩu thì true, sai thì false", () => {
        expect(checkPassword(PASSWORD)).toBe(true);
        expect(checkPassword("sai")).toBe(false);
        expect(checkPassword(`${PASSWORD} `)).toBe(false);
        expect(checkPassword(PASSWORD.toUpperCase())).toBe(false);
        expect(checkPassword("")).toBe(false);
    });

    it("so sánh được cả mật khẩu có dấu và độ dài khác nhau (không ném lỗi)", () => {
        vi.stubEnv("ADMIN_PASSWORD", "mật-khẩu-đặc-biệt");
        expect(checkPassword("mật-khẩu-đặc-biệt")).toBe(true);
        expect(checkPassword("mật")).toBe(false);
        expect(checkPassword("a".repeat(10_000))).toBe(false);
    });

    it("chưa đặt ADMIN_PASSWORD thì từ chối mọi thứ, kể cả chuỗi rỗng", () => {
        vi.stubEnv("ADMIN_PASSWORD", "");
        expect(checkPassword("")).toBe(false);
        expect(checkPassword("bất kỳ")).toBe(false);
    });
});

describe("startAdminSession", () => {
    it("đặt cookie httpOnly, sameSite lax, sống 7 ngày, hết hạn đúng 7 ngày sau", async () => {
        await startAdminSession();
        expect(state.lastSet?.name).toBe("cj_admin");
        expect(state.lastSet?.options).toMatchObject({httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * DAY});
        const [expiresAt, signature] = token().split(".");
        expect(Number(expiresAt)).toBe(Math.floor(T0.getTime() / 1000) + 7 * DAY);
        expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("chỉ bật cờ secure ở production (chạy http://localhost khi phát triển vẫn đăng nhập được)", async () => {
        await startAdminSession();
        expect(state.lastSet?.options.secure).toBe(false);
        vi.stubEnv("NODE_ENV", "production");
        await startAdminSession();
        expect(state.lastSet?.options.secure).toBe(true);
    });

    it("production: cookie mang tiền tố __Host- (buộc Secure, path /, không Domain); dev thì tên thường", async () => {
        expect(adminCookieName()).toBe(ADMIN_COOKIE);
        vi.stubEnv("NODE_ENV", "production");
        expect(adminCookieName()).toBe(`__Host-${ADMIN_COOKIE}`);
        await startAdminSession();
        expect(state.lastSet?.name).toBe("__Host-cj_admin");
        expect(state.lastSet?.options).toMatchObject({secure: true, path: "/"});
        expect(state.lastSet?.options).not.toHaveProperty("domain");
        expect(await isAdmin()).toBe(true);
    });

    it("cookie chỉ đọc đúng theo tên của môi trường: cookie tên thường không được nhận ở production", async () => {
        await startAdminSession();
        const plain = token();
        vi.stubEnv("NODE_ENV", "production");
        state.jar.clear();
        state.jar.set(ADMIN_COOKIE, plain);
        expect(await isAdmin()).toBe(false);
    });

    it("đăng nhập xong thì isAdmin = true", async () => {
        await startAdminSession();
        expect(await isAdmin()).toBe(true);
    });
});

describe("isAdmin", () => {
    it("chưa có cookie thì false", async () => {
        expect(await isAdmin()).toBe(false);
    });

    it.each(["", "abc", "123", "123.", ".chu-ky", "a.b.c", "khong-so.chu-ky"])("cookie hỏng %j thì false", async (value) => {
        setToken(value);
        expect(await isAdmin()).toBe(false);
    });

    it("hết hạn đúng sau 7 ngày, còn hạn thì vẫn đăng nhập", async () => {
        await startAdminSession();
        advance(7 * DAY - 1);
        expect(await isAdmin()).toBe(true);
        advance(7 * DAY);
        expect(await isAdmin()).toBe(false);
        advance(7 * DAY + 1);
        expect(await isAdmin()).toBe(false);
    });

    it("sửa chữ ký thì bị từ chối", async () => {
        await startAdminSession();
        const [expiresAt, signature] = token().split(".");
        const flipped = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
        setToken(`${expiresAt}.${flipped}`);
        expect(await isAdmin()).toBe(false);
        setToken(`${expiresAt}.${signature}x`);
        expect(await isAdmin()).toBe(false);
        setToken(`${expiresAt}.${signature.slice(0, -1)}`);
        expect(await isAdmin()).toBe(false);
    });

    it("kéo dài hạn thủ công (sửa expiresAt, giữ chữ ký cũ) thì bị từ chối", async () => {
        await startAdminSession();
        const [expiresAt, signature] = token().split(".");
        setToken(`${Number(expiresAt) + 30 * DAY}.${signature}`);
        expect(await isAdmin()).toBe(false);
    });

    it("tự làm cookie bằng mật khẩu sai thì bị từ chối, bằng mật khẩu đúng thì được (định dạng cookie ổn định)", async () => {
        const expiresAt = String(Math.floor(T0.getTime() / 1000) + DAY);
        setToken(`${expiresAt}.${sign(expiresAt, "mat-khau-khac")}`);
        expect(await isAdmin()).toBe(false);
        setToken(`${expiresAt}.${sign(expiresAt)}`);
        expect(await isAdmin()).toBe(true);
    });

    // Khoá ký không còn là mật khẩu thô: cookie ký kiểu cũ (HMAC trực tiếp bằng mật khẩu) bị từ chối, và biết mật khẩu thô không đủ để giả cookie
    it("cookie ký kiểu cũ (khoá là mật khẩu thô) không còn được chấp nhận", async () => {
        const expiresAt = String(Math.floor(T0.getTime() / 1000) + DAY);
        setToken(`${expiresAt}.${legacySign(expiresAt)}`);
        expect(await isAdmin()).toBe(false);
    });

    it("chữ ký không trùng với HMAC tính thẳng bằng mật khẩu (không dò mật khẩu offline nhanh được từ cookie)", async () => {
        await startAdminSession();
        const [expiresAt, signature] = token().split(".");
        expect(signature).not.toBe(legacySign(expiresAt));
        expect(signature).not.toBe(createHmac("sha256", PASSWORD).update(`admin:${expiresAt}`).digest("base64url"));
        expect(signature).toBe(sign(expiresAt));
    });

    it("đổi mật khẩu rồi đổi lại thì khoá tính lại đúng (bộ nhớ đệm không giữ khoá cũ)", async () => {
        await startAdminSession();
        const first = token();
        vi.stubEnv("ADMIN_PASSWORD", "mat-khau-moi");
        expect(await isAdmin()).toBe(false);
        vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
        setToken(first);
        expect(await isAdmin()).toBe(true);
    });

    it("đổi mật khẩu thì mọi phiên đang đăng nhập bị vô hiệu", async () => {
        await startAdminSession();
        expect(await isAdmin()).toBe(true);
        vi.stubEnv("ADMIN_PASSWORD", "mat-khau-moi");
        expect(await isAdmin()).toBe(false);
    });

    it("gỡ ADMIN_PASSWORD thì trang quản trị bị tắt hẳn, dù cookie cũ còn nguyên", async () => {
        await startAdminSession();
        vi.stubEnv("ADMIN_PASSWORD", "");
        expect(await isAdmin()).toBe(false);
    });

    it("cookie do mật khẩu rỗng ký cũng không được chấp nhận khi chưa cấu hình", async () => {
        vi.stubEnv("ADMIN_PASSWORD", "");
        const expiresAt = String(Math.floor(T0.getTime() / 1000) + DAY);
        setToken(`${expiresAt}.${sign(expiresAt, "")}`);
        expect(await isAdmin()).toBe(false);
    });
});

describe("endAdminSession", () => {
    it("xóa cookie nên đăng xuất ngay", async () => {
        await startAdminSession();
        await endAdminSession();
        expect(state.jar.has(adminCookieName())).toBe(false);
        expect(await isAdmin()).toBe(false);
    });
});

describe("assertAdmin (dùng đầu mỗi server action)", () => {
    it("ném lỗi khi chưa đăng nhập", async () => {
        await expect(assertAdmin()).rejects.toThrow("Chưa đăng nhập quản trị.");
    });

    it("chạy tiếp khi đã đăng nhập", async () => {
        await startAdminSession();
        await expect(assertAdmin()).resolves.toBeUndefined();
    });

    it("phiên hết hạn thì server action bị chặn", async () => {
        await startAdminSession();
        advance(8 * DAY);
        await expect(assertAdmin()).rejects.toThrow("Chưa đăng nhập quản trị.");
    });
});

describe("requireAdmin (dùng đầu mỗi trang admin)", () => {
    it("chưa đăng nhập thì chuyển về /admin, nơi cuốn sổ còn khoá", async () => {
        await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/admin");
    });

    it("chưa đăng nhập ở bản tiếng Anh thì về /en/admin (giữ ngôn ngữ)", async () => {
        await expect(requireAdmin("en")).rejects.toThrow("NEXT_REDIRECT:/en/admin");
        await expect(requireAdmin("vi")).rejects.toThrow("NEXT_REDIRECT:/admin");
    });

    it("đã đăng nhập thì cho vào, ở cả hai ngôn ngữ (cookie phiên dùng chung path /)", async () => {
        await startAdminSession();
        await expect(requireAdmin()).resolves.toBeUndefined();
        await expect(requireAdmin("en")).resolves.toBeUndefined();
    });
});
