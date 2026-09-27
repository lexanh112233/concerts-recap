import {describe, expect, it} from "vitest";
import {en as enDict} from "@/i18n/dictionaries/en";
import {vi as viDict} from "@/i18n/dictionaries/vi";
import {moodFor} from "@/lib/mood";

describe("moodFor", () => {
    it.each([
        [5, -8],
        [4, -6],
        [3, 6],
        [2, 4],
        [1, -5],
        [0, -3],
    ])("điểm %d → nghiêng %d°", (rating, tilt) => {
        expect(moodFor(rating)).toEqual({stars: rating, tilt});
    });

    it("làm tròn điểm lẻ (dữ liệu cũ có thể lưu 4.5)", () => {
        expect(moodFor(4.4).stars).toBe(4);
        expect(moodFor(4.5).stars).toBe(5);
        expect(moodFor(2.6).stars).toBe(3);
    });

    it("kẹp điểm ngoài khoảng 0 đến 5", () => {
        expect(moodFor(9).stars).toBe(5);
        expect(moodFor(-3).stars).toBe(0);
    });

    it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])("điểm hỏng (%s) thì coi như chưa chấm", (rating) => {
        expect(moodFor(rating).stars).toBe(0);
    });

    it("mỗi mức luôn cho cùng một góc dán (không ngẫu nhiên)", () => {
        expect(moodFor(5)).toBe(moodFor(5));
        expect([0, 1, 2, 3, 4, 5].map((n) => moodFor(n).stars)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("chữ viết tay theo điểm nằm trong từ điển: mỗi ngôn ngữ có sáu dòng chữ khác nhau, đúng chỉ số theo số sao", () => {
        for (const dict of [viDict, enDict]) {
            expect(dict.mood).toHaveLength(6);
            expect(new Set(dict.mood).size).toBe(6);
        }
        expect(viDict.mood[moodFor(5).stars]).toBe("mê tít");
        expect(enDict.mood[moodFor(0).stars]).toBe("not rated yet");
    });
});
