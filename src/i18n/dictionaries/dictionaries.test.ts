import {describe, expect, it} from "vitest";
import {en} from "@/i18n/dictionaries/en";
import {vi} from "@/i18n/dictionaries/vi";

// Kiểu Dict đã bắt thiếu/thừa khoá lúc typecheck; test này bắt những thứ kiểu không thấy: chuỗi rỗng, độ dài mảng,
// và {tham số} lệch nhau giữa hai ngôn ngữ (bản dịch quên {n} thì câu hiện ra sai mà không báo lỗi).

type Leaf = string | string[] | { [key: string]: Leaf };

function flatten(node: Leaf, path = ""): Array<[string, string]> {
    if (typeof node === "string") return [[path, node]];
    if (Array.isArray(node)) return node.flatMap((item, i) => flatten(item, `${path}[${i}]`));
    return Object.entries(node).flatMap(([key, value]) => flatten(value, path ? `${path}.${key}` : key));
}

const viEntries = flatten(vi as Leaf);
const enEntries = flatten(en as Leaf);
const enByPath = new Map(enEntries);

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("từ điển vi/en", () => {
    it("cùng một tập khoá (kể cả chỉ số trong mảng)", () => {
        expect(enEntries.map(([path]) => path)).toEqual(viEntries.map(([path]) => path));
    });

    it("không có chuỗi rỗng hay chỉ toàn khoảng trắng", () => {
        for (const [path, text] of [...viEntries, ...enEntries]) {
            expect(text.trim(), path).not.toBe("");
        }
    });

    it("mỗi khoá có cùng tập {tham số} ở hai ngôn ngữ", () => {
        for (const [path, text] of viEntries) {
            expect(placeholders(enByPath.get(path) ?? ""), path).toEqual(placeholders(text));
        }
    });

    it("mảng lịch có đủ 12 tháng và 7 thứ, mood có 6 mức", () => {
        for (const dict of [vi, en]) {
            expect(dict.date.months).toHaveLength(12);
            expect(dict.date.monthsShort).toHaveLength(12);
            expect(dict.date.weekdays).toHaveLength(7);
            expect(dict.mood).toHaveLength(6);
        }
    });

    it("mọi mục số nhiều có đủ hai nhánh one/other và cùng {n}", () => {
        const pluralPaths = ["ago.days", "ago.weeks", "ago.months", "ago.years", "archive.nights", "archive.matches", "desk.count", "marquee.nightsSr"];
        for (const path of pluralPaths) {
            for (const dict of [vi, en]) {
                const entry = path.split(".").reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, dict as unknown as Record<string, unknown>) as unknown as { one: string, other: string };
                expect(entry.one, path).toContain("{n}");
                expect(entry.other, path).toContain("{n}");
            }
        }
    });

    it("tiếng Anh thật sự đã được dịch (không sót nguyên văn tiếng Việt có dấu ở các chuỗi giao diện)", () => {
        const vietnamese = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
        for (const [path, text] of enEntries) {
            // tên riêng "Khương" (chủ nhân của trang) được phép xuất hiện trong bản tiếng Anh
            expect(text.replaceAll("Khương", ""), path).not.toMatch(vietnamese);
        }
    });
});
