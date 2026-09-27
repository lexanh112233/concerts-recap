import {describe, expect, it} from "vitest";
import {format, plural} from "@/i18n/format";

describe("format", () => {
    it("thay {tên} bằng giá trị, số được đổi thành chuỗi", () => {
        expect(format("Đêm số {n}", {n: 12})).toBe("Đêm số 12");
        expect(format("{a} và {b}", {a: "x", b: 0})).toBe("x và 0");
    });

    it("một biến dùng nhiều lần đều được thay", () => {
        expect(format("{n}/{n}", {n: 3})).toBe("3/3");
    });

    it("biến thiếu thì giữ nguyên {tên} để lỗi lộ ra chứ không lặng lẽ mất chữ", () => {
        expect(format("Xin chào {name}")).toBe("Xin chào {name}");
        expect(format("{a}-{b}", {a: 1})).toBe("1-{b}");
    });

    it("không có tham số thì trả nguyên chuỗi", () => {
        expect(format("Không có gì")).toBe("Không có gì");
    });

    it("giá trị chứa ký tự đặc biệt của regex hay dấu { } vẫn được chèn nguyên văn", () => {
        expect(format("Xem: {title}", {title: "$1 {n} (a|b)"})).toBe("Xem: $1 {n} (a|b)");
    });
});

describe("plural", () => {
    const nights = {one: "{n} night", other: "{n} nights"};

    it("tiếng Anh: 1 là số ít, còn lại (cả 0) là số nhiều", () => {
        expect(plural("en", nights, 1)).toBe("1 night");
        expect(plural("en", nights, 0)).toBe("0 nights");
        expect(plural("en", nights, 2)).toBe("2 nights");
        expect(plural("en", nights, 21)).toBe("21 nights");
    });

    it("tiếng Việt không có số nhiều: luôn rơi vào nhánh other", () => {
        const dem = {one: "{n} đêm (một)", other: "{n} đêm"};
        expect(plural("vi", dem, 1)).toBe("1 đêm");
        expect(plural("vi", dem, 5)).toBe("5 đêm");
    });

    it("truyền thêm biến ngoài n", () => {
        expect(plural("en", {one: "{n} show by {who}", other: "{n} shows by {who}"}, 3, {who: "Grey D"})).toBe("3 shows by Grey D");
    });
});
