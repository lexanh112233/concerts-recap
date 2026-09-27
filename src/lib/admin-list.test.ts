import {describe, expect, it} from "vitest";
import type {IConcert} from "@/lib/concerts";
import {
    ADMIN_PER_PAGE,
    computeStats,
    filterRows,
    formatVndShort,
    pageOfSlug,
    paginate,
    sortRows,
    toAdminRow,
    yearTabs,
    type AdminRow,
} from "@/lib/admin-list";

function concert(over: Partial<IConcert> = {}): IConcert {
    return {
        slug: "s",
        kind: "concert",
        date: new Date(2026, 8, 20),
        title: "Fancon Tinh Tú",
        body: "",
        images: [],
        city: "Hồ Chí Minh",
        venue: "Nhà hát Quân đội",
        artistName: "Vương Anh Tú",
        concertVenue: "",
        zone: null,
        row: null,
        seat: null,
        companion: "Một mình",
        ticketPrice: 1_300_000,
        rating: 5,
        active: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        ...over,
    };
}

// mốc "bây giờ" cố định: mặc định đêm diễn (20/9/2026) đã qua, ngày 1/10/2026 là sắp diễn ra
const NOW = new Date(2026, 8, 25, 12, 0, 0);
const PAST = new Date(2026, 8, 20);
const FUTURE = new Date(2026, 9, 1);

const row = (over: Partial<IConcert> = {}) => toAdminRow(concert(over), "vi", NOW);

describe("toAdminRow", () => {
    it("dựng nhãn ngày tiếng Việt, năm và mốc thời gian", () => {
        const r = row({date: new Date(2026, 8, 20)});
        expect(r.dateLabel).toBe("20 tháng 9, 2026");
        expect(r.year).toBe(2026);
        expect(r.time).toBe(new Date(2026, 8, 20).getTime());
    });

    it("đọc được ngày kiểu cũ DD.MM.YYYY", () => {
        expect(row({date: "31.01.2026"}).year).toBe(2026);
    });

    it("chưa có ngày hợp lệ: năm null, thời gian 0, nhãn rỗng", () => {
        const r = row({date: "không phải ngày"});
        expect(r.year).toBeNull();
        expect(r.time).toBe(0);
        expect(r.dateLabel).toBe("");
    });

    // "sắp diễn ra" suy ra từ ngày, "ẩn" là công tắc hiển thị: hai chuyện độc lập nhau nên có đủ bốn tổ hợp
    it.each([
        ["đã qua, đang hiện", PAST, true, false],
        ["đã qua, đang ẩn", PAST, false, false],
        ["sắp diễn ra, đang hiện", FUTURE, true, true],
        ["sắp diễn ra, đang ẩn", FUTURE, false, true],
    ])("%s", (_, date, active, upcoming) => {
        const r = row({date, active});
        expect(r.upcoming).toBe(upcoming);
        expect(r.active).toBe(active);
    });

    it("chưa có ngày hợp lệ thì không phải sắp diễn ra", () => {
        expect(row({date: "không phải ngày"}).upcoming).toBe(false);
    });

    it("mốc so sánh là `now` truyền vào: cùng một đêm, đổi `now` thì đổi trạng thái", () => {
        const c = concert({date: FUTURE});
        expect(toAdminRow(c, "vi", NOW).upcoming).toBe(true);
        expect(toAdminRow(c, "vi", new Date(2026, 9, 2)).upcoming).toBe(false);
    });

    it("thực chi = giá vé + phát sinh − bán merch, kèm nhãn", () => {
        const r = row({ticketPrice: 1_000_000, extraCosts: [{label: "Taxi", amount: 200_000}], merchResale: [{label: "Set", amount: 50_000}]});
        expect(r.net).toBe(1_150_000);
        expect(r.netLabel).toBe("Thực chi 1.150.000đ");
        expect(r.netShort).toBe("1.150.000đ");
    });

    it("bán merch nhiều hơn chi ra thì là lãi, bản rút gọn vẫn ghi rõ Lãi", () => {
        const r = row({ticketPrice: 500_000, merchResale: [{label: "Set", amount: 800_000}]});
        expect(r.net).toBe(-300_000);
        expect(r.netLabel).toBe("Lãi 300.000đ");
        expect(r.netShort).toBe("Lãi 300.000đ");
    });

    it("chưa có giá vé: thực chi và nhãn đều null, không bịa số 0", () => {
        const r = row({ticketPrice: null, extraCosts: [{label: "Taxi", amount: 200_000}]});
        expect(r.ticketPrice).toBeNull();
        expect(r.net).toBeNull();
        expect(r.netLabel).toBeNull();
        expect(r.netShort).toBeNull();
    });

    it("giá vé 0 (vé mời) vẫn là đã có giá", () => {
        const r = row({ticketPrice: 0});
        expect(r.ticketPrice).toBe(0);
        expect(r.net).toBe(0);
    });

    it("ảnh bìa lấy tệp media đầu tiên, bỏ qua đường dẫn không phải ảnh/video", () => {
        expect(row({images: ["x.txt", "a.jpg", "b.mp4"]}).cover).toEqual({src: "a.jpg", isVideo: false});
        expect(row({images: []}).cover).toBeNull();
    });

    it("dùng concertVenue khi không có venue, và bỏ dấu để tìm kiếm", () => {
        const r = row({venue: null, concertVenue: "Sân vận động Mỹ Đình", city: null});
        expect(r.haystack).toContain("san van dong my dinh");
        expect(r.haystack).toContain("vuong anh tu");
    });
});

describe("tiếng Anh", () => {
    it("toAdminRow: ngày viết kiểu Mỹ, nhãn thực chi và bản rút gọn", () => {
        const r = toAdminRow(concert({
            date: new Date(2026, 8, 20),
            ticketPrice: 1_000_000,
            extraCosts: [{label: "Taxi", amount: 200_000}],
            merchResale: [{label: "Set", amount: 50_000}],
        }), "en");
        expect(r.dateLabel).toBe("September 20, 2026");
        expect(r.netLabel).toBe("Net spent 1,150,000đ");
        expect(r.netShort).toBe("1,150,000đ");
        expect(r.time).toBe(new Date(2026, 8, 20).getTime());
    });

    it("toAdminRow: lãi vẫn ghi rõ Profit ở bản rút gọn", () => {
        const r = toAdminRow(concert({ticketPrice: 500_000, merchResale: [{label: "Set", amount: 800_000}]}), "en");
        expect(r.netLabel).toBe("Profit 300,000đ");
        expect(r.netShort).toBe("Profit 300,000đ");
    });

    it("formatVndShort: k / M / B và dấu chấm thập phân", () => {
        expect(formatVndShort(850_000, "en")).toBe("850k");
        expect(formatVndShort(1_500_000, "en")).toBe("1.5M");
        expect(formatVndShort(24_870_000, "en")).toBe("24.87M");
        expect(formatVndShort(1_200_000_000, "en")).toBe("1.2B");
        expect(formatVndShort(999_999, "en")).toBe("1M");
        expect(formatVndShort(-1_250_000, "en")).toBe("−1.25M");
        expect(formatVndShort(500, "en")).toBe("500đ");
    });
});

describe("computeStats", () => {
    it("đếm đêm, nghệ sĩ (không phân biệt hoa thường/khoảng trắng), đang ẩn", () => {
        const rows = [
            row({slug: "a", artistName: "EXO"}),
            row({slug: "b", artistName: " exo "}),
            row({slug: "c", artistName: "Grey D", active: false}),
        ];
        expect(computeStats(rows)).toMatchObject({nights: 3, artists: 2, hidden: 1});
    });

    it("chỉ cộng thực chi của đêm có giá vé, và đếm đêm chưa có giá riêng", () => {
        const rows = [
            row({slug: "a", ticketPrice: 1_000_000}),
            row({slug: "b", ticketPrice: 2_000_000, merchResale: [{label: "x", amount: 500_000}]}),
            row({slug: "c", ticketPrice: null, extraCosts: [{label: "taxi", amount: 999_000}]}),
        ];
        const stats = computeStats(rows);
        expect(stats.spent).toBe(2_500_000);
        expect(stats.missingPrice).toBe(1);
    });

    it("đếm sắp diễn ra (theo ngày) và đang ẩn (theo công tắc) riêng nhau, đêm vừa sắp diễn ra vừa ẩn tính ở cả hai", () => {
        const rows = [
            row({slug: "a", date: PAST, active: true}),
            row({slug: "b", date: PAST, active: false}),
            row({slug: "c", date: FUTURE, active: true}),
            row({slug: "d", date: FUTURE, active: false}),
            row({slug: "e", date: FUTURE, active: true}),
        ];
        // số đếm cố ý lệch nhau (3 sắp diễn ra, 2 đang ẩn) để lẫn hai trục là lộ ngay
        expect(computeStats(rows)).toMatchObject({nights: 5, upcoming: 3, hidden: 2});
    });

    it("danh sách rỗng ra toàn số 0", () => {
        expect(computeStats([])).toEqual({nights: 0, artists: 0, upcoming: 0, hidden: 0, spent: 0, missingPrice: 0});
    });
});

describe("filterRows", () => {
    const rows = [
        row({slug: "a", title: "Rock in Museum", artistName: "Nhiều nghệ sĩ", active: true, ticketPrice: 500_000}),
        row({slug: "b", title: "Giữa Một Vạn Tour", artistName: "Phùng Khánh Linh", active: false, ticketPrice: null}),
        row({slug: "c", title: "Fancon", artistName: "Vương Anh Tú", active: true, ticketPrice: null, city: "Đà Nẵng"}),
    ];
    const slugs = (list: AdminRow[]) => list.map((r) => r.slug);

    it("không điều kiện thì giữ nguyên", () => {
        expect(slugs(filterRows(rows))).toEqual(["a", "b", "c"]);
    });

    it("tìm không cần gõ dấu và không phân biệt hoa thường", () => {
        expect(slugs(filterRows(rows, {query: "phung khanh"}))).toEqual(["b"]);
        expect(slugs(filterRows(rows, {query: "GIUA MOT VAN"}))).toEqual(["b"]);
    });

    it("tìm cả theo thành phố, chữ đ ↔ d", () => {
        expect(slugs(filterRows(rows, {query: "da nang"}))).toEqual(["c"]);
    });

    it("nhiều từ phải có mặt hết, không cần đúng thứ tự", () => {
        expect(slugs(filterRows(rows, {query: "tu vuong"}))).toEqual(["c"]);
        expect(slugs(filterRows(rows, {query: "vuong linh"}))).toEqual([]);
    });

    it("chỉ toàn khoảng trắng coi như không tìm gì", () => {
        expect(slugs(filterRows(rows, {query: "   "}))).toEqual(["a", "b", "c"]);
    });

    // ngày (đã diễn ra / sắp diễn ra) và công tắc hiển thị (đang ẩn) là hai trục độc lập, nên các nhóm chồng nhau được
    describe("lọc theo trạng thái", () => {
        const mixed = [
            row({slug: "past-shown", title: "Rock in Museum", date: PAST, active: true}),
            row({slug: "past-hidden", title: "Giữa Một Vạn Tour", date: PAST, active: false}),
            row({slug: "future-shown", title: "Fancon", date: FUTURE, active: true}),
            row({slug: "future-hidden", title: "ATVNCG", date: FUTURE, active: false}),
        ];

        it("tất cả: không lọc", () => {
            expect(slugs(filterRows(mixed, {filter: "all"}))).toEqual(["past-shown", "past-hidden", "future-shown", "future-hidden"]);
        });

        it("đã diễn ra: theo ngày, không quan tâm đang ẩn hay hiện", () => {
            expect(slugs(filterRows(mixed, {filter: "happened"}))).toEqual(["past-shown", "past-hidden"]);
        });

        it("sắp diễn ra: theo ngày, không quan tâm đang ẩn hay hiện", () => {
            expect(slugs(filterRows(mixed, {filter: "upcoming"}))).toEqual(["future-shown", "future-hidden"]);
        });

        it("đang ẩn: theo công tắc, không quan tâm ngày", () => {
            expect(slugs(filterRows(mixed, {filter: "hidden"}))).toEqual(["past-hidden", "future-hidden"]);
        });

        it("đêm không có ngày hợp lệ thuộc nhóm đã diễn ra (không phải sắp diễn ra)", () => {
            const undated = [row({slug: "undated", date: "hỏng"})];
            expect(slugs(filterRows(undated, {filter: "happened"}))).toEqual(["undated"]);
            expect(slugs(filterRows(undated, {filter: "upcoming"}))).toEqual([]);
        });
    });

    it("kết hợp tìm kiếm và bộ lọc", () => {
        expect(slugs(filterRows(rows, {query: "van", filter: "hidden"}))).toEqual(["b"]);
        expect(slugs(filterRows(rows, {query: "fancon", filter: "hidden"}))).toEqual([]);
        expect(slugs(filterRows(rows, {query: "fancon", filter: "happened"}))).toEqual(["c"]);
        expect(slugs(filterRows(rows, {query: "fancon", filter: "upcoming"}))).toEqual([]);
    });
});

describe("sortRows", () => {
    const rows = [
        row({slug: "old", date: new Date(2025, 0, 1), ticketPrice: 900_000}),
        row({slug: "new", date: new Date(2026, 5, 1), ticketPrice: 500_000}),
        row({slug: "none", date: new Date(2026, 0, 1), ticketPrice: null}),
        row({slug: "nodate", date: "hỏng", ticketPrice: 700_000}),
    ];
    const slugs = (list: AdminRow[]) => list.map((r) => r.slug);

    it("mới nhất trước, đêm không có ngày xuống cuối", () => {
        expect(slugs(sortRows(rows, "newest"))).toEqual(["new", "none", "old", "nodate"]);
    });

    it("cũ nhất trước", () => {
        expect(slugs(sortRows(rows, "oldest"))).toEqual(["nodate", "old", "none", "new"]);
    });

    it("giá vé cao trước, chưa có giá xuống cuối", () => {
        expect(slugs(sortRows(rows, "price"))).toEqual(["old", "nodate", "new", "none"]);
    });

    it("thực chi cao trước, chưa có giá xuống cuối", () => {
        const withCosts = [
            row({slug: "cheap", ticketPrice: 100_000}),
            row({slug: "dear", ticketPrice: 100_000, extraCosts: [{label: "bay", amount: 3_000_000}]}),
            row({slug: "unknown", ticketPrice: null}),
        ];
        expect(slugs(sortRows(withCosts, "net"))).toEqual(["dear", "cheap", "unknown"]);
    });

    it("hai đêm cùng chưa có số liệu thì đêm mới hơn lên trước", () => {
        const unknown = [
            row({slug: "a", date: new Date(2025, 0, 1), ticketPrice: null}),
            row({slug: "b", date: new Date(2026, 0, 1), ticketPrice: null}),
        ];
        expect(slugs(sortRows(unknown, "price"))).toEqual(["b", "a"]);
        expect(slugs(sortRows(unknown, "net"))).toEqual(["b", "a"]);
    });

    it("hoà thì đêm mới hơn lên trước", () => {
        const tie = [
            row({slug: "a", date: new Date(2025, 0, 1), ticketPrice: 1}),
            row({slug: "b", date: new Date(2026, 0, 1), ticketPrice: 1}),
        ];
        expect(slugs(sortRows(tie, "price"))).toEqual(["b", "a"]);
    });

    it("không làm đổi mảng gốc", () => {
        const before = slugs(rows);
        sortRows(rows, "oldest");
        expect(slugs(rows)).toEqual(before);
    });
});

describe("paginate", () => {
    it("mỗi trang tối đa perPage, trang cuối có phần dư", () => {
        const pages = paginate([1, 2, 3, 4, 5, 6, 7], 3);
        expect(pages).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it("đúng bội số thì không sinh trang rỗng thừa", () => {
        expect(paginate([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
    });

    it("rỗng vẫn có đúng một trang (rỗng)", () => {
        expect(paginate([])).toEqual([[]]);
    });

    it("mặc định 5 đêm mỗi trang", () => {
        expect(ADMIN_PER_PAGE).toBe(5);
        expect(paginate(Array.from({length: 11}, (_, i) => i)).map((p) => p.length)).toEqual([5, 5, 1]);
    });
});

describe("pageOfSlug", () => {
    const rows = ["a", "b", "c", "d", "e", "f"].map((slug) => row({slug}));

    it("trả về chỉ số trang chứa đêm đó", () => {
        expect(pageOfSlug(rows, "a", 2)).toBe(0);
        expect(pageOfSlug(rows, "b", 2)).toBe(0);
        expect(pageOfSlug(rows, "c", 2)).toBe(1);
        expect(pageOfSlug(rows, "f", 2)).toBe(2);
    });

    it("không có trong danh sách thì -1", () => {
        expect(pageOfSlug(rows, "zzz", 2)).toBe(-1);
    });
});

describe("yearTabs", () => {
    const at = (slug: string, year: number | null) => row({slug, date: year === null ? "hỏng" : new Date(year, 5, 1)});

    it("mỗi năm một tab, trỏ tới trang đầu tiên có năm đó", () => {
        const rows = [at("a", 2026), at("b", 2026), at("c", 2026), at("d", 2025), at("e", 2025), at("f", 2024)];
        expect(yearTabs(rows, 2)).toEqual([
            {year: 2026, page: 0},
            {year: 2025, page: 1},
            {year: 2024, page: 2},
        ]);
    });

    it("đi theo thứ tự trong danh sách (sắp cũ → mới thì năm nhỏ trước)", () => {
        const rows = [at("a", 2024), at("b", 2025), at("c", 2026)];
        expect(yearTabs(rows, 5).map((t) => t.year)).toEqual([2024, 2025, 2026]);
    });

    it("đêm không có ngày không có tab", () => {
        expect(yearTabs([at("a", null), at("b", 2026)], 5)).toEqual([{year: 2026, page: 0}]);
    });

    it("danh sách rỗng thì không có tab", () => {
        expect(yearTabs([])).toEqual([]);
    });
});

describe("formatVndShort", () => {
    it("dưới một nghìn giữ nguyên đồng", () => {
        expect(formatVndShort(0)).toBe("0đ");
        expect(formatVndShort(999)).toBe("999đ");
    });

    it("nghìn: k", () => {
        expect(formatVndShort(1_000)).toBe("1k");
        expect(formatVndShort(850_000)).toBe("850k");
        expect(formatVndShort(999_500)).toBe("999,5k");
    });

    it("triệu: tr, dấu phẩy thập phân, tối đa hai chữ số, bỏ số 0 thừa", () => {
        expect(formatVndShort(1_000_000)).toBe("1tr");
        expect(formatVndShort(1_500_000)).toBe("1,5tr");
        expect(formatVndShort(24_870_000)).toBe("24,87tr");
        expect(formatVndShort(24_874_999)).toBe("24,87tr");
        expect(formatVndShort(25_000_000)).toBe("25tr");
    });

    it("làm tròn sát ngưỡng thì nhảy lên đơn vị kế tiếp", () => {
        expect(formatVndShort(999_999)).toBe("1tr");
        expect(formatVndShort(999_999_999)).toBe("1 tỷ");
    });

    it("tỷ", () => {
        expect(formatVndShort(1_200_000_000)).toBe("1,2 tỷ");
    });

    it("số âm (bán merch nhiều hơn chi) có dấu trừ", () => {
        expect(formatVndShort(-50_000)).toBe("−50k");
        expect(formatVndShort(-1_250_000)).toBe("−1,25tr");
        expect(formatVndShort(-500)).toBe("−500đ");
    });
});
