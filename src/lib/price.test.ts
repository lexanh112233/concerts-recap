import {describe, expect, it} from "vitest";
import {formatPrice, MAX_TICKET_PRICE, normalizePrice} from "@/lib/price";

describe("normalizePrice", () => {
    it.each([
        ["", ""],
        ["   ", ""],
        ["0", "0"],
        ["007", "7"],
        ["1500000", "1500000"],
        ["1.500.000", "1500000"],
        ["1,500,000", "1500000"],
        ["1 500 000", "1500000"],
        ["1.500.000đ", "1500000"],
        ["1.500.000 đ", "1500000"],
        ["500₫", "500"],
        ["350000 vnd", "350000"],
        ["350000VND", "350000"],
        ["350000 VNĐ", "350000"],
        ["100.000.000", "100000000"],
    ])("nhận %j → %j", (input, expected) => {
        expect(normalizePrice(input)).toBe(expected);
    });

    it.each([
        ["100000001", "vượt mức tối đa"],
        ["1500000000", "quá 9 chữ số"],
        ["1.5", "dấu chấm không phải dấu ngăn nghìn: từ chối thay vì lặng lẽ thành 15đ"],
        ["1.50", "nhóm sau dấu chấm không đủ 3 chữ số"],
        ["1..500", "hai dấu liền nhau"],
        ["12.34.567", "nhóm nghìn sai vị trí"],
        ["-5", "số âm"],
        ["1e6", "ký hiệu khoa học"],
        ["abc", "không phải số"],
        ["đ", "chỉ có đơn vị"],
    ])("từ chối %j (%s)", (input) => {
        expect(normalizePrice(input)).toBeNull();
    });

    it("mức tối đa là 100 triệu và được chấp nhận đúng ở biên", () => {
        expect(MAX_TICKET_PRICE).toBe(100_000_000);
        expect(normalizePrice(String(MAX_TICKET_PRICE))).toBe("100000000");
        expect(normalizePrice(String(MAX_TICKET_PRICE + 1))).toBeNull();
    });
});

describe("formatPrice", () => {
    it.each([
        [1500000, "1.500.000đ"],
        [350000, "350.000đ"],
        [999, "999đ"],
        [100000000, "100.000.000đ"],
    ])("%d → %s", (price, label) => {
        expect(formatPrice(price, "vi")).toBe(label);
    });

    it.each([
        [1500000, "1,500,000đ"],
        [350000, "350,000đ"],
        [999, "999đ"],
    ])("en: %d → %s (dấu phẩy ngăn nghìn)", (price, label) => {
        expect(formatPrice(price, "en")).toBe(label);
    });

    it("0 là vé mời nên ghi Miễn phí / Free", () => {
        expect(formatPrice(0, "vi")).toBe("Miễn phí");
        expect(formatPrice(0, "en")).toBe("Free");
    });

    it.each([null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY])("chưa có giá hoặc giá hỏng (%s) thì trả null để vé không hiện dòng giá", (price) => {
        expect(formatPrice(price, "vi")).toBeNull();
        expect(formatPrice(price, "en")).toBeNull();
    });
});
