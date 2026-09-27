import {describe, expect, it} from "vitest";
import {normalizeText} from "@/lib/text";

describe("normalizeText", () => {
    it.each([
        ["Phùng Khánh Linh", "phung khanh linh"],
        ["Bùi Lan Hương", "bui lan huong"],
        ["Nhà hát Hòa Bình", "nha hat hoa binh"],
        ["ExhOrizon #6", "exhorizon #6"],
        ["", ""],
    ])("%j → %j", (input, expected) => {
        expect(normalizeText(input)).toBe(expected);
    });

    it("đ và Đ đều thành d (tiêu đề lưu chữ hoa như ĐI VỀ NHÀ vẫn tìm được bằng cách gõ không dấu)", () => {
        expect(normalizeText("đêm")).toBe("dem");
        expect(normalizeText("ĐÊM")).toBe("dem");
        expect(normalizeText("ĐI VỀ NHÀ")).toBe("di ve nha");
        expect(normalizeText("Đ")).toBe("d");
    });

    it("chữ hoa có dấu và chữ đã tách sẵn dấu cho cùng kết quả", () => {
        const composed = "LIVE CONCERT: ÁNH SÁNG & MÀN ĐÊM";
        const decomposed = composed.normalize("NFD");
        expect(normalizeText(composed)).toBe("live concert: anh sang & man dem");
        expect(normalizeText(decomposed)).toBe(normalizeText(composed));
    });

    it("chạy lại nhiều lần không đổi kết quả", () => {
        const once = normalizeText("Chuyển Mình Rực Rỡ");
        expect(normalizeText(once)).toBe(once);
    });

    it("gõ không dấu khớp chuỗi có dấu theo kiểu includes như ô tìm kiếm dùng", () => {
        const haystack = normalizeText("ĐI VỀ NHÀ CAM BY 8 - FINALE Nhà hát Hòa Bình");
        expect(haystack.includes(normalizeText("di ve"))).toBe(true);
        expect(haystack.includes(normalizeText("hòa bình"))).toBe(true);
        expect(haystack.includes(normalizeText("khong co"))).toBe(false);
    });
});
