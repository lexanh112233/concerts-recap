import {describe, expect, it} from "vitest";
import {BRAND_NAME, BRAND_SUFFIX, DEFAULT_OWNER_NAME, OWNER_NAME, resolveOwnerName} from "@/lib/brand";

describe("resolveOwnerName", () => {
    it("chưa đặt biến hoặc để trống thì dùng tên mặc định (site đang chạy không bị đổi tên ngầm)", () => {
        expect(resolveOwnerName(undefined)).toBe(DEFAULT_OWNER_NAME);
        expect(resolveOwnerName("")).toBe(DEFAULT_OWNER_NAME);
        expect(resolveOwnerName("   ")).toBe(DEFAULT_OWNER_NAME);
        expect(resolveOwnerName("\t\n")).toBe(DEFAULT_OWNER_NAME);
    });

    it("dùng đúng tên được đặt, giữ nguyên chữ hoa và dấu tiếng Việt", () => {
        expect(resolveOwnerName("Linh")).toBe("Linh");
        expect(resolveOwnerName("Nguyễn Thảo")).toBe("Nguyễn Thảo");
        expect(resolveOwnerName("An")).toBe("An");
    });

    it("bỏ khoảng trắng thừa ở đầu, cuối và giữa tên", () => {
        expect(resolveOwnerName("  Linh  ")).toBe("Linh");
        expect(resolveOwnerName("Nguyễn   Thảo")).toBe("Nguyễn Thảo");
        expect(resolveOwnerName("\tLinh\n")).toBe("Linh");
    });

    it("tên mặc định là trung tính (\"Mình\"), không mang tên riêng của ai", () => {
        expect(DEFAULT_OWNER_NAME).toBe("Mình");
    });
});

describe("BRAND_NAME", () => {
    it("là tên chủ trang + 'đi show'", () => {
        expect(BRAND_SUFFIX).toBe("đi show");
        expect(BRAND_NAME).toBe(`${OWNER_NAME} ${BRAND_SUFFIX}`);
    });

    it("không có khoảng trắng thừa hay chữ 'undefined'", () => {
        expect(BRAND_NAME).not.toContain("undefined");
        expect(BRAND_NAME).toBe(BRAND_NAME.trim().replace(/\s+/g, " "));
    });
});
