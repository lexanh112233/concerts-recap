import {describe, expect, it} from "vitest";
import {vi} from "@/i18n/admin/dictionaries/vi";
import {en} from "@/i18n/admin/dictionaries/en";
import {EVENT_PAGE_COUNT, errorPages, firstErrorPage} from "@/lib/event-pages";

describe("errorPages", () => {
    it("không có lỗi thì không trang nào", () => {
        expect(errorPages(undefined).size).toBe(0);
        expect(errorPages({}).size).toBe(0);
    });

    it("xếp mỗi ô về đúng trang của nó", () => {
        expect([...errorPages({title: "x"})]).toEqual([0]);
        expect([...errorPages({ticketPrice: "x"})]).toEqual([0]);
        expect([...errorPages({extraCosts: "x"})]).toEqual([1]);
        expect([...errorPages({merchResale: "x"})]).toEqual([1]);
        expect([...errorPages({body: "x"})]).toEqual([2]);
        expect([...errorPages({images: "x"})]).toEqual([3]);
        expect([...errorPages({rating: "x"})]).toEqual([3]);
    });

    it("nhiều lỗi ở nhiều trang thì đánh dấu đủ các trang, mỗi trang một lần", () => {
        const pages = errorPages({title: "a", date: "b", body: "c", extraCosts: "d"});
        expect([...pages].sort()).toEqual([0, 1, 2]);
    });

    it("lỗi chung của form không thuộc trang nào", () => {
        expect(errorPages({form: "Không lưu được"}).size).toBe(0);
    });

    it("bỏ qua lỗi rỗng", () => {
        expect(errorPages({title: ""}).size).toBe(0);
    });

    it("mọi trang đều có nhãn tab ở cả hai ngôn ngữ", () => {
        expect(vi.form.pageTabs).toHaveLength(EVENT_PAGE_COUNT);
        expect(en.form.pageTabs).toHaveLength(EVENT_PAGE_COUNT);
    });
});

describe("firstErrorPage", () => {
    it("là trang nhỏ nhất có lỗi, không phụ thuộc thứ tự khoá", () => {
        expect(firstErrorPage({body: "c", extraCosts: "d"})).toBe(1);
        expect(firstErrorPage({images: "e", title: "a"})).toBe(0);
    });

    it("không có lỗi ô nào thì null (kể cả khi có lỗi chung)", () => {
        expect(firstErrorPage({})).toBeNull();
        expect(firstErrorPage({form: "x"})).toBeNull();
        expect(firstErrorPage(undefined)).toBeNull();
    });
});
