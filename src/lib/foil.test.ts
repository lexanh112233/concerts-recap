import {describe, expect, it} from "vitest";
import {hashString, type ITone} from "@/lib/concerts";
import {foilStyle} from "@/lib/foil";

const TONE: ITone = {f1: "#fff1f1", f2: "#f5c8c8", f3: "#e19a9a", glow: "#ff8a8a"};

describe("foilStyle", () => {
    it("không có tông thì dùng platinum trung tính", () => {
        const style = foilStyle("limitless") as Record<string, unknown>;
        expect(style["--f1"]).toBe("#ffffff");
        expect(style["--f2"]).toBe("#e7e9ef");
        expect(style["--f3"]).toBe("#bfc4cf");
        expect(style["--glow"]).toBe("#b9d4ff");
        expect(foilStyle("limitless", null)).toEqual(style);
    });

    it("có tông tính từ ảnh bìa thì dùng đúng tông đó", () => {
        const style = foilStyle("limitless", TONE) as Record<string, unknown>;
        expect(style["--f1"]).toBe(TONE.f1);
        expect(style["--f2"]).toBe(TONE.f2);
        expect(style["--f3"]).toBe(TONE.f3);
        expect(style["--glow"]).toBe(TONE.glow);
    });

    it("cùng seed thì luôn ra cùng nhịp phát sáng (vé không nhấp nháy khác đi giữa các lần tải)", () => {
        expect(foilStyle("rock-in-bao-tang-my-thuat")).toEqual(foilStyle("rock-in-bao-tang-my-thuat"));
    });

    it("nhịp phát sáng --tw lệch pha theo seed, nằm trong khoảng 0 đến dưới 7 giây", () => {
        const values = ["a", "b", "limitless", "exhorizon-6", "grey-d", "tour-ve-khong", "gap-show"].map((seed) => {
            const tw = (foilStyle(seed) as Record<string, unknown>)["--tw"] as number;
            expect(tw).toBe(((hashString(seed) >>> 7) % 70) / 10);
            expect(tw).toBeGreaterThanOrEqual(0);
            expect(tw).toBeLessThan(7);
            return tw;
        });
        expect(new Set(values).size).toBeGreaterThan(1);
    });

    it("tông không ảnh hưởng đến nhịp phát sáng", () => {
        const a = foilStyle("limitless", TONE) as Record<string, unknown>;
        const b = foilStyle("limitless") as Record<string, unknown>;
        expect(a["--tw"]).toBe(b["--tw"]);
    });
});
