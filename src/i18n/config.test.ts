import {describe, expect, it} from "vitest";
import {isLang, langOfPath, localeTag, pathFor, switchPath} from "@/i18n/config";

describe("pathFor", () => {
    it("tiếng Việt là mặc định nên giữ nguyên đường dẫn, không tiền tố", () => {
        expect(pathFor("vi", "/")).toBe("/");
        expect(pathFor("vi", "/concerts/x")).toBe("/concerts/x");
        expect(pathFor("vi", "/#archive")).toBe("/#archive");
    });

    it("tiếng Anh thêm tiền tố /en", () => {
        expect(pathFor("en", "/")).toBe("/en");
        expect(pathFor("en", "/concerts/x")).toBe("/en/concerts/x");
    });

    it("mốc # và query của trang chủ dính vào /en, không thành /en/#archive", () => {
        expect(pathFor("en", "/#archive")).toBe("/en#archive");
        expect(pathFor("en", "/?a=1")).toBe("/en?a=1");
    });
});

describe("trang quản trị theo cùng quy tắc với trang công khai", () => {
    it("pathFor: /admin là tiếng Việt, /en/admin là tiếng Anh (kể cả có query)", () => {
        expect(pathFor("vi", "/admin")).toBe("/admin");
        expect(pathFor("en", "/admin")).toBe("/en/admin");
        expect(pathFor("en", "/admin/login")).toBe("/en/admin/login");
        expect(pathFor("en", "/admin/fancon/edit")).toBe("/en/admin/fancon/edit");
        expect(pathFor("en", "/admin?saved=fancon")).toBe("/en/admin?saved=fancon");
        expect(pathFor("vi", "/admin?saved=fancon")).toBe("/admin?saved=fancon");
    });

    it("langOfPath và switchPath nhận ra và đổi đúng trang admin", () => {
        expect(langOfPath("/admin")).toBe("vi");
        expect(langOfPath("/en/admin")).toBe("en");
        expect(langOfPath("/en/admin/new")).toBe("en");
        expect(switchPath("/admin", "en")).toBe("/en/admin");
        expect(switchPath("/en/admin", "vi")).toBe("/admin");
        expect(switchPath("/admin/x/edit", "en")).toBe("/en/admin/x/edit");
        expect(switchPath("/en/admin/x/edit", "vi")).toBe("/admin/x/edit");
        expect(switchPath("/en/admin/login", "en")).toBe("/en/admin/login");
    });
});

describe("langOfPath", () => {
    it.each([
        ["/", "vi"],
        ["/concerts/x", "vi"],
        ["/en", "en"],
        ["/en/concerts/x", "en"],
        ["/admin", "vi"],
    ])("%s → %s", (path, lang) => {
        expect(langOfPath(path)).toBe(lang);
    });

    it("chỉ nhận /en đứng riêng: /english hay /entry KHÔNG phải tiếng Anh", () => {
        expect(langOfPath("/english")).toBe("vi");
        expect(langOfPath("/entry/x")).toBe("vi");
    });
});

describe("switchPath", () => {
    it.each([
        ["/", "en", "/en"],
        ["/en", "vi", "/"],
        ["/concerts/x", "en", "/en/concerts/x"],
        ["/en/concerts/x", "vi", "/concerts/x"],
    ] as const)("%s → %s = %s", (path, to, expected) => {
        expect(switchPath(path, to)).toBe(expected);
    });

    it("đổi sang chính ngôn ngữ đang dùng thì giữ nguyên trang", () => {
        expect(switchPath("/en/concerts/x", "en")).toBe("/en/concerts/x");
        expect(switchPath("/concerts/x", "vi")).toBe("/concerts/x");
    });

    it("đổi qua lại hai lần trở về đường dẫn cũ", () => {
        for (const path of ["/", "/concerts/gap-show", "/en", "/en/concerts/gap-show"]) {
            expect(switchPath(switchPath(path, "en"), langOfPath(path))).toBe(path);
        }
    });
});

describe("isLang và localeTag", () => {
    it("chỉ nhận vi và en", () => {
        expect(isLang("vi")).toBe(true);
        expect(isLang("en")).toBe(true);
        expect(isLang("fr")).toBe(false);
        expect(isLang(undefined)).toBe(false);
    });

    it("thẻ locale cho Intl", () => {
        expect(localeTag("vi")).toBe("vi-VN");
        expect(localeTag("en")).toBe("en-US");
    });
});
