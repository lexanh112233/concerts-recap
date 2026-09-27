import {describe, expect, it} from "vitest";
import {slugify} from "@/lib/slug";

describe("slugify", () => {
    // các cặp dưới đây là tiêu đề và slug thật đang có trong DB
    it.each([
        ["Buổi Liên Hoan Văn Nghệ - Đầu tiên", "buoi-lien-hoan-van-nghe-dau-tien"],
        ["LIVE CONCERT: ÁNH SÁNG & MÀN ĐÊM", "live-concert-anh-sang-man-dem"],
        ["ExhOrizon #6", "exhorizon-6"],
        ['IN ĐẬM "indie"', "in-dam-indie"],
        ["[WELCOM BACK] ASIA TOUR", "welcom-back-asia-tour"],
        ["BAEKHYUN [Lonsdaleite]", "baekhyun-lonsdaleite"],
        ["ĐI VỀ NHÀ", "di-ve-nha"],
        ["[LIVESHOW] ĐẸP & BUỒN", "liveshow-dep-buon"],
    ])("%s → %s", (title, slug) => {
        expect(slugify(title)).toBe(slug);
    });

    it("bỏ dấu, đ → d, gom ký tự lạ và khoảng trắng thành một dấu gạch", () => {
        expect(slugify("  Đêm   nhạc --- Mùa  thu!!  ")).toBe("dem-nhac-mua-thu");
    });

    it("không để lại gạch ở đầu và cuối", () => {
        expect(slugify("---abc---")).toBe("abc");
    });

    it("tiêu đề không còn ký tự hợp lệ nào thì dùng slug mặc định", () => {
        expect(slugify("")).toBe("su-kien");
        expect(slugify("!!! ???")).toBe("su-kien");
        expect(slugify("★☆")).toBe("su-kien");
    });

    it("cắt theo độ dài tối đa và không để gạch dư ở cuối", () => {
        expect(slugify("a".repeat(100))).toHaveLength(80);
        expect(slugify("abc def", 4)).toBe("abc");
        expect(slugify("abcd efgh", 5)).toBe("abcd");
    });

    it("chỉ cho ra ký tự an toàn để đặt trong URL", () => {
        expect(slugify("Ảnh/Đường\\dẫn?x=1&y=<2>")).toMatch(/^[a-z0-9-]+$/);
    });
});
