import {describe, expect, it} from "vitest";
import {createSwipeTracker, SWIPE_QUIET_MS, SWIPE_THRESHOLD, type SwipeFlip} from "@/lib/swipe";

// Một cử chỉ vuốt giống thật: các delta tăng dần rồi giảm dần theo quán tính, cách nhau ~16ms
const SWIPE = [8, 18, 30, 42, 50, 46, 40, 34, 28, 22, 18, 14, 10, 8, 6, 4, 3, 2, 1];

function run(tracker = createSwipeTracker(), deltas = SWIPE, sign = 1, start = 1000, dy = 0) {
    const flips: Array<{ at: number, flip: SwipeFlip }> = [];
    const horizontal: boolean[] = [];
    let time = start;
    for (const d of deltas) {
        const result = tracker.feed(d * sign, dy, time);
        horizontal.push(result.horizontal);
        if (result.flip) flips.push({at: time, flip: result.flip});
        time += 16;
    }
    return {flips, horizontal, end: time};
}

describe("một cử chỉ vuốt ngang", () => {
    it("chỉ lật đúng MỘT lần dù quán tính kéo dài cả chục sự kiện", () => {
        const {flips} = run();
        expect(flips).toHaveLength(1);
    });

    it("vuốt sang trái (dx dương) là trang kế, sang phải (dx âm) là trang trước", () => {
        expect(run(createSwipeTracker(), SWIPE, 1).flips.map((f) => f.flip)).toEqual(["next"]);
        expect(run(createSwipeTracker(), SWIPE, -1).flips.map((f) => f.flip)).toEqual(["prev"]);
    });

    it("lật ngay khi tổng quãng vuốt chạm ngưỡng, không đợi hết quán tính", () => {
        const {flips} = run();
        // 8+18+30 = 56 < 60, thêm 42 thì vượt: sự kiện thứ tư (cách nhau 16ms)
        expect(flips[0].at).toBe(1000 + 3 * 16);
    });

    it("mọi sự kiện của cử chỉ, kể cả đuôi quán tính, đều báo là ngang để nơi gọi chặn cuộn/quay lại", () => {
        const {horizontal} = run();
        expect(horizontal.every(Boolean)).toBe(true);
    });

    it("vuốt nhẹ chưa tới ngưỡng thì không lật", () => {
        const {flips} = run(createSwipeTracker(), [5, 8, 10, 8, 6, 4, 2]);
        expect(flips).toHaveLength(0);
        expect(5 + 8 + 10 + 8 + 6 + 4 + 2).toBeLessThan(SWIPE_THRESHOLD);
    });
});

describe("nhiều cử chỉ liên tiếp", () => {
    it("nghỉ đủ lâu rồi vuốt tiếp thì lật thêm một lần nữa", () => {
        const tracker = createSwipeTracker();
        const first = run(tracker);
        const second = run(tracker, SWIPE, 1, first.end + SWIPE_QUIET_MS + 50);
        expect(first.flips).toHaveLength(1);
        expect(second.flips).toHaveLength(1);
    });

    it("vuốt lại ngay trong đuôi quán tính của cái trước (delta tăng vọt) cũng tính là cử chỉ mới", () => {
        const tracker = createSwipeTracker();
        const tail = [50, 40, 30, 20, 12, 8, 5];
        const first = run(tracker, [10, 20, 30, ...tail]);
        // đang giảm tới 5 thì người dùng vuốt thêm, không nghỉ: delta nhảy từ 5 lên 40
        const second = run(tracker, [40, 46, 50, 44], 1, first.end);
        expect(first.flips).toHaveLength(1);
        expect(second.flips).toHaveLength(1);
    });

    it("đuôi quán tính giảm dần liên tục không bị nhầm là cử chỉ mới", () => {
        const tracker = createSwipeTracker();
        const {flips} = run(tracker, [30, 40, 50, 48, 44, 40, 36, 30, 26, 22, 18, 14, 10, 8, 6, 4, 3, 2, 1]);
        expect(flips).toHaveLength(1);
    });

    it("đổi chiều: vuốt sang trái rồi (sau khi nghỉ) sang phải thì lật tới rồi lật lui", () => {
        const tracker = createSwipeTracker();
        const first = run(tracker, SWIPE, 1);
        const second = run(tracker, SWIPE, -1, first.end + SWIPE_QUIET_MS + 50);
        expect([...first.flips, ...second.flips].map((f) => f.flip)).toEqual(["next", "prev"]);
    });
});

describe("không phải vuốt ngang", () => {
    it("cuộn dọc bình thường thì không đụng tới (không chặn, không lật)", () => {
        const tracker = createSwipeTracker();
        for (let i = 0; i < 20; i++) {
            expect(tracker.feed(0, 40, 1000 + i * 16)).toEqual({horizontal: false, flip: null});
        }
    });

    it("cuộn chéo nghiêng về dọc (dx nhỏ hơn dy) là cuộn dọc", () => {
        const tracker = createSwipeTracker();
        expect(tracker.feed(30, 40, 1000)).toEqual({horizontal: false, flip: null});
        expect(tracker.feed(30, 30, 1016)).toEqual({horizontal: false, flip: null});
    });

    it("vuốt ngang có kèm chút lệch dọc vẫn tính là ngang", () => {
        const {flips, horizontal} = run(createSwipeTracker(), SWIPE, 1, 1000, 6);
        expect(horizontal.some(Boolean)).toBe(true);
        expect(flips).toHaveLength(1);
    });

    it("cuộn dọc xen giữa cuộc vuốt không làm hỏng việc gom quãng vuốt", () => {
        const tracker = createSwipeTracker();
        let time = 1000;
        const flips: SwipeFlip[] = [];
        for (const d of [20, 25]) {
            const r = tracker.feed(d, 0, time);
            time += 16;
            if (r.flip) flips.push(r.flip);
        }
        expect(tracker.feed(0, 30, time).horizontal).toBe(false);
        time += 16;
        const r = tracker.feed(30, 0, time);
        if (r.flip) flips.push(r.flip);
        expect(flips).toEqual(["next"]);
    });
});

describe("reset", () => {
    it("xoá hết trạng thái: sau reset một cử chỉ nhẹ nằm ngay sau cử chỉ trước không bị coi là đuôi quán tính", () => {
        const tracker = createSwipeTracker();
        const first = run(tracker);
        tracker.reset();
        const second = run(tracker, SWIPE, 1, first.end);
        expect(second.flips).toHaveLength(1);
    });
});
