import {describe, expect, it} from "vitest";
import {en} from "@/i18n/admin/dictionaries/en";
import {vi} from "@/i18n/admin/dictionaries/vi";
import {validationMessages} from "@/i18n/admin/validation";

// Kiểu AdminDict đã bắt thiếu/thừa khoá lúc typecheck; test này bắt những thứ kiểu không thấy: chuỗi rỗng, độ dài mảng,
// và {tham số} lệch nhau giữa hai ngôn ngữ (bản dịch quên {n} thì câu hiện ra sai mà không báo lỗi).

type Leaf = string | string[] | { [key: string]: Leaf };

function flatten(node: Leaf, path = ""): Array<[string, string]> {
    if (typeof node === "string") return [[path, node]];
    if (Array.isArray(node)) return node.flatMap((item, i) => flatten(item, `${path}[${i}]`));
    return Object.entries(node).flatMap(([key, value]) => flatten(value, path ? `${path}.${key}` : key));
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// Tiếng Việt viết tháng bằng số ("Tháng {n}"), tiếng Anh bằng tên ("{name}", "{short}"): các khoá này được phép khác tập tham số
const MONTH_KEYS = new Set(["date.monthYear", "date.gridLabel", "date.monthCell"]);

// Chuỗi tiếng Anh được phép chứa nguyên văn tiếng Việt: giá trị dữ liệu lưu trong DB ("Một mình") không dịch
const VIETNAMESE_ALLOWED = new Set(["form.companionHint"]);
const VIETNAMESE = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

describe("từ điển admin vi/en", () => {
    const viEntries = flatten(vi as Leaf);
    const enEntries = flatten(en as Leaf);
    const enByPath = new Map(enEntries);

    it("cùng một tập khoá (kể cả chỉ số trong mảng)", () => {
        expect(enEntries.map(([path]) => path)).toEqual(viEntries.map(([path]) => path));
    });

    it("không có chuỗi rỗng hay chỉ toàn khoảng trắng", () => {
        for (const [path, text] of [...viEntries, ...enEntries]) expect(text.trim(), path).not.toBe("");
    });

    it("mỗi khoá có cùng tập {tham số} ở hai ngôn ngữ (trừ cách viết tháng)", () => {
        for (const [path, text] of viEntries) {
            if (MONTH_KEYS.has(path)) continue;
            expect(placeholders(enByPath.get(path) ?? ""), path).toEqual(placeholders(text));
        }
    });

    it("cách viết tháng: mỗi ngôn ngữ chỉ dùng tham số nó được truyền (n, name, short, year)", () => {
        const allowed = new Set(["n", "name", "short", "year"]);
        for (const dict of [vi, en]) {
            for (const key of ["monthYear", "gridLabel", "monthCell"] as const) {
                for (const p of placeholders(dict.date[key])) expect(allowed.has(p), `${key}.${p}`).toBe(true);
            }
        }
        expect(placeholders(en.date.monthYear)).toEqual(["name", "year"]);
        expect(placeholders(vi.date.monthYear)).toEqual(["n", "year"]);
    });

    it("mảng có đúng độ dài: bốn tab của form, bảy thứ, và các nhãn gợi ý không rỗng", () => {
        for (const dict of [vi, en]) {
            expect(dict.form.pageTabs).toHaveLength(4);
            expect(dict.date.weekdaysShort).toHaveLength(7);
            expect(dict.form.extraQuickAdds.length).toBeGreaterThan(0);
            expect(dict.form.recoupQuickAdds.length).toBeGreaterThan(0);
        }
    });

    it("mục số nhiều có đủ hai nhánh và cùng {n}", () => {
        for (const dict of [vi, en]) {
            for (const entry of [dict.list.spentMissing, dict.media.waiting]) {
                expect(entry.one).toContain("{n}");
                expect(entry.other).toContain("{n}");
            }
        }
        // tiếng Anh phải phân biệt số ít/số nhiều thật sự
        expect(en.list.spentMissing.one).not.toBe(en.list.spentMissing.other);
        expect(en.media.waiting.one).not.toBe(en.media.waiting.other);
    });

    it("bản tiếng Anh không sót tiếng Việt có dấu (trừ giá trị dữ liệu được phép)", () => {
        for (const [path, text] of enEntries) {
            if (VIETNAMESE_ALLOWED.has(path)) continue;
            expect(VIETNAMESE.test(text), `${path}: ${text}`).toBe(false);
        }
    });

    it("tiêu đề tab dùng {brand} (tên chủ trang lấy từ NEXT_PUBLIC_YOUR_NAME) chứ không viết cứng tên ai", () => {
        for (const dict of [vi, en]) {
            expect(dict.meta.title).toContain("{brand}");
            expect(dict.meta.title).not.toContain("Khương");
        }
    });

    // "Sắp diễn ra"/"Đã diễn ra" suy ra từ NGÀY; "Đang ẩn" là công tắc hiển thị. Hai chuyện độc lập, không được lẫn từ ngữ với nhau
    it("\"sắp diễn ra\" là chuyện ngày, \"đang ẩn\" là chuyện hiển thị: chữ của hai bên không lẫn vào nhau", () => {
        expect(vi.list.upcoming).toBe("sắp diễn ra");
        expect(vi.list.upcomingBadge).toBe("Sắp diễn ra");
        expect(vi.list.filterUpcoming).toBe("Sắp diễn ra");
        expect(vi.list.filterHappened).toBe("Đã diễn ra");
        expect(vi.list.filterHidden).toBe("Đang ẩn");
        expect(en.list.filterHidden).toBe("Hidden");

        // nút ẩn/hiện và ô "hiện trên trang chủ" chỉ nói về việc hiển thị, không nhắc thời gian
        const visibility = [vi.list.hide, vi.list.show, vi.list.hiddenBadge, vi.form.visible, vi.form.visibleHint, en.list.hide, en.list.show, en.list.hiddenBadge, en.form.visible, en.form.visibleHint];
        for (const text of visibility) expect(text.toLowerCase(), text).not.toMatch(/sắp diễn ra|đã diễn ra|upcoming|happened/);

        // gợi ý theo ngày thì ngược lại: nói về việc chưa diễn ra
        expect(vi.form.upcomingHint).toContain("chưa diễn ra");
        expect(en.form.upcomingHint).toContain("hasn't happened");

        // hai khoá cũ gộp hai chuyện làm một đã bỏ
        expect("markUpcoming" in vi.list).toBe(false);
        expect("markHappened" in vi.list).toBe(false);
    });

    it("khoản thu hồi không còn gọi là \"bán lại merch\"", () => {
        expect(vi.form.recoup).toBe("Khoản thu hồi");
        expect(validationMessages("vi").labels.recoup).toBe("Khoản thu hồi");
    });
});

describe("thông báo kiểm tra dữ liệu vi/en", () => {
    const viEntries = flatten(validationMessages("vi") as unknown as Leaf);
    const enEntries = flatten(validationMessages("en") as unknown as Leaf);
    const enByPath = new Map(enEntries);

    it("cùng một tập khoá và không rỗng", () => {
        expect(enEntries.map(([path]) => path)).toEqual(viEntries.map(([path]) => path));
        for (const [path, text] of [...viEntries, ...enEntries]) expect(text.trim(), path).not.toBe("");
    });

    it("mỗi khoá có cùng tập {tham số} ở hai ngôn ngữ", () => {
        for (const [path, text] of viEntries) expect(placeholders(enByPath.get(path) ?? ""), path).toEqual(placeholders(text));
    });

    it("bản tiếng Anh không sót tiếng Việt có dấu", () => {
        for (const [path, text] of enEntries) expect(VIETNAMESE.test(text), `${path}: ${text}`).toBe(false);
    });
});
