import {afterEach, describe, expect, it} from "vitest";
import type {Lang} from "@/i18n/config";
import {en as enDict} from "@/i18n/dictionaries/en";
import {vi as viDict} from "@/i18n/dictionaries/vi";
import {
    artistKey,
    clampRatio,
    excerpt,
    formatLongDate,
    getCoverMedia,
    getMediaList,
    hasCompanion,
    hashString,
    isMediaUrl,
    isUpcoming,
    parseConcertDate,
    sortNewestFirst,
    splitTitle,
    ticketNumber,
    timeAgo,
    toCard,
    weekdayName,
    type IConcert,
} from "@/lib/concerts";

const ymd = (d: Date | null) => (d ? [d.getFullYear(), d.getMonth() + 1, d.getDate()] : null);

// toCard mặc định tiếng Việt cho gọn; ca tiếng Anh truyền lang riêng
const cardOf = (c: IConcert, order = 0, tone: Parameters<typeof toCard>[2] = null, lang: Lang = "vi") => toCard(c, order, tone, lang);

describe("parseConcertDate", () => {
    it("đọc ngày kiểu cũ DD.MM.YYYY (dữ liệu cũ trong DB lưu chuỗi)", () => {
        expect(ymd(parseConcertDate("31.01.2026"))).toEqual([2026, 1, 31]);
        expect(ymd(parseConcertDate("06.04.2024"))).toEqual([2024, 4, 6]);
    });

    it("chấp nhận số 0 dẫn đầu bị thiếu và dấu phân cách . / -", () => {
        expect(ymd(parseConcertDate("1.2.2026"))).toEqual([2026, 2, 1]);
        expect(ymd(parseConcertDate("5/3/2025"))).toEqual([2025, 3, 5]);
        expect(ymd(parseConcertDate("05-03-2025"))).toEqual([2025, 3, 5]);
        expect(ymd(parseConcertDate("  31.01.2026  "))).toEqual([2026, 1, 31]);
    });

    it("ngày là D/M chứ không phải M/D", () => {
        expect(ymd(parseConcertDate("03.04.2026"))).toEqual([2026, 4, 3]);
    });

    it("nhận Date và trả lại đúng đối tượng đó", () => {
        const d = new Date(2026, 6, 3, 12);
        expect(parseConcertDate(d)).toBe(d);
    });

    it("nhận chuỗi ISO", () => {
        expect(parseConcertDate("2026-07-03T12:00:00.000Z")).not.toBeNull();
    });

    it.each([null, undefined, "", "abc", "32.13.abcd"])("%j → null", (value) => {
        expect(parseConcertDate(value)).toBeNull();
    });

    it("Date hỏng → null", () => {
        expect(parseConcertDate(new Date("không phải ngày"))).toBeNull();
    });
});

describe("formatLongDate và weekdayName", () => {
    it("ngày dài kiểu Việt Nam", () => {
        expect(formatLongDate("31.01.2026", "vi")).toBe("31 tháng 1, 2026");
        expect(formatLongDate(new Date(2025, 11, 13), "vi")).toBe("13 tháng 12, 2025");
    });

    it("ngày dài kiểu Mỹ cho tiếng Anh", () => {
        expect(formatLongDate("31.01.2026", "en")).toBe("January 31, 2026");
        expect(formatLongDate(new Date(2025, 11, 13), "en")).toBe("December 13, 2025");
    });

    it("thứ trong tuần theo từ điển của từng ngôn ngữ", () => {
        expect(weekdayName("31.01.2026", viDict.date.weekdays)).toBe("Thứ bảy");
        expect(weekdayName("01.02.2026", viDict.date.weekdays)).toBe("Chủ nhật");
        expect(weekdayName("02.02.2026", viDict.date.weekdays)).toBe("Thứ hai");
        expect(weekdayName("31.01.2026", enDict.date.weekdays)).toBe("Saturday");
        expect(weekdayName("01.02.2026", enDict.date.weekdays)).toBe("Sunday");
    });

    it("không có ngày hợp lệ thì trả chuỗi rỗng", () => {
        expect(formatLongDate(null, "vi")).toBe("");
        expect(formatLongDate("abc", "en")).toBe("");
        expect(weekdayName(undefined, viDict.date.weekdays)).toBe("");
    });
});

describe("sortNewestFirst", () => {
    it("sắp theo ngày thật, trộn cả chuỗi cũ lẫn Date mới", () => {
        const list = [
            {id: "cu-2025", date: "01.01.2025"},
            {id: "moi-2026", date: new Date(2026, 0, 1, 12)},
            {id: "cu-giua-2025", date: "15.06.2025"},
            {id: "moi-2024", date: new Date(2024, 3, 6, 12)},
        ];
        expect(sortNewestFirst(list).map((e) => e.id)).toEqual(["moi-2026", "cu-giua-2025", "cu-2025", "moi-2024"]);
    });

    it("không so chuỗi theo thứ tự chữ cái (31.01.2024 phải cũ hơn 01.01.2026)", () => {
        const sorted = sortNewestFirst([{date: "31.01.2024"}, {date: "01.01.2026"}]);
        expect(sorted.map((e) => e.date)).toEqual(["01.01.2026", "31.01.2024"]);
    });

    it("ngày hỏng xếp cuối cùng và không làm hỏng danh sách", () => {
        const sorted = sortNewestFirst([{date: "abc"}, {date: "01.01.2020"}]);
        expect(sorted.map((e) => e.date)).toEqual(["01.01.2020", "abc"]);
    });

    it("không sửa mảng gốc", () => {
        const list = [{date: "01.01.2020"}, {date: "01.01.2026"}];
        const copy = [...list];
        sortNewestFirst(list);
        expect(list).toEqual(copy);
    });
});

describe("isUpcoming", () => {
    const NOW = new Date(2026, 8, 19, 12, 0, 0);

    it.each([
        ["ngày mai", new Date(2026, 8, 20), true],
        ["chuỗi cũ DD.MM.YYYY ở tương lai", "01.01.2027", true],
        ["đúng bằng bây giờ thì chưa tính là sắp diễn ra", new Date(NOW), false],
        ["hôm qua", new Date(2026, 8, 18), false],
        ["chuỗi cũ DD.MM.YYYY đã qua", "31.01.2024", false],
    ])("%s", (_, date, expected) => {
        expect(isUpcoming(date, NOW)).toBe(expected);
    });

    it("không có ngày hợp lệ thì không phải sắp diễn ra", () => {
        expect(isUpcoming(null, NOW)).toBe(false);
        expect(isUpcoming(undefined, NOW)).toBe(false);
        expect(isUpcoming("abc", NOW)).toBe(false);
        expect(isUpcoming(new Date("abc"), NOW)).toBe(false);
    });

    it("ngày lưu 12:00 UTC: đêm diễn hôm nay hết là sắp diễn ra đúng lúc 12:00 UTC", () => {
        const showDay = new Date("2026-09-19T12:00:00.000Z");
        expect(isUpcoming(showDay, new Date("2026-09-19T11:59:59.000Z"))).toBe(true);
        expect(isUpcoming(showDay, new Date("2026-09-19T12:00:00.000Z"))).toBe(false);
    });

    // nhãn "Sắp diễn ra" ở trang công khai (timeAgo) và badge ở sổ quản trị (isUpcoming) phải luôn cùng một kết luận
    it("luôn khớp với nhãn \"sắp diễn ra\" của timeAgo", () => {
        for (let offset = -400; offset <= 400; offset += 7) {
            const date = new Date(2026, 8, 19 + offset, offset % 5 === 0 ? 12 : 0);
            expect(isUpcoming(date, NOW)).toBe(timeAgo(date, "vi", viDict.ago, NOW) === viDict.ago.upcoming);
        }
    });
});

describe("timeAgo", () => {
    const NOW = new Date(2026, 8, 19, 12, 0, 0);

    it.each([
        ["19.09.2026", "Hôm nay"],
        ["18.09.2026", "Hôm qua"],
        ["17.09.2026", "2 ngày trước"],
        ["13.09.2026", "6 ngày trước"],
        ["12.09.2026", "1 tuần trước"],
        ["05.09.2026", "2 tuần trước"],
        ["22.08.2026", "4 tuần trước"],
        ["20.08.2026", "1 tháng trước"],
        ["19.03.2026", "6 tháng trước"],
        ["19.09.2025", "1 năm trước"],
        ["19.09.2023", "3 năm trước"],
        ["20.09.2026", "Sắp diễn ra"],
        ["01.01.2027", "Sắp diễn ra"],
    ])("%s → %s", (date, label) => {
        expect(timeAgo(date, "vi", viDict.ago, NOW)).toBe(label);
    });

    // tiếng Anh có số ít/số nhiều ("1 week ago" / "2 weeks ago") nên bảng riêng
    it.each([
        ["19.09.2026", "Today"],
        ["18.09.2026", "Yesterday"],
        ["17.09.2026", "2 days ago"],
        ["12.09.2026", "1 week ago"],
        ["05.09.2026", "2 weeks ago"],
        ["20.08.2026", "1 month ago"],
        ["19.03.2026", "6 months ago"],
        ["19.09.2025", "1 year ago"],
        ["19.09.2023", "3 years ago"],
        ["20.09.2026", "Coming up"],
    ])("en: %s → %s", (date, label) => {
        expect(timeAgo(date, "en", enDict.ago, NOW)).toBe(label);
    });

    it("ngày không hợp lệ thì rỗng", () => {
        expect(timeAgo(null, "vi", viDict.ago, NOW)).toBe("");
        expect(timeAgo("abc", "en", enDict.ago, NOW)).toBe("");
    });
});

describe("excerpt", () => {
    it("lấy đoạn đầu tiên của nhật ký HTML", () => {
        expect(excerpt("<p>Đoạn đầu</p><p>Đoạn hai</p>")).toBe("Đoạn đầu");
    });

    it("bỏ gạch đầu dòng và dòng trống ở nhật ký cũ dạng văn bản", () => {
        expect(excerpt("\n- Đi concert vui lắm\nDòng hai")).toBe("Đi concert vui lắm");
        expect(excerpt("• một\n- hai")).toBe("một");
    });

    it("cắt bớt nếu dài quá và thêm dấu …", () => {
        const long = "a".repeat(300);
        const out = excerpt(`<p>${long}</p>`);
        expect(out).toBe(`${"a".repeat(240)}…`);
        expect(excerpt(`<p>abcdef</p>`, 3)).toBe("abc…");
    });

    it("không thêm … khi đoạn vừa đủ", () => {
        expect(excerpt(`<p>${"a".repeat(240)}</p>`)).toBe("a".repeat(240));
    });

    it("bỏ khoảng trắng thừa trước dấu …", () => {
        expect(excerpt("<p>ab cd</p>", 3)).toBe("ab…");
    });

    it("nhật ký rỗng thì trích rỗng", () => {
        expect(excerpt("")).toBe("");
        expect(excerpt("<p></p>")).toBe("");
    });
});

describe("hashString", () => {
    it("đúng vector kiểm thử chuẩn của FNV-1a 32 bit (đổi thuật toán là đổi độ nghiêng/màu của mọi vé)", () => {
        expect(hashString("a")).toBe(0xe40c292c);
        expect(hashString("foobar")).toBe(0xbf9cf968);
    });

    it("chuỗi rỗng cho ra hằng số khởi đầu", () => {
        expect(hashString("")).toBe(2166136261);
    });

    it("ổn định, là số nguyên 32 bit không âm và khác nhau giữa các slug", () => {
        expect(hashString("limitless")).toBe(hashString("limitless"));
        for (const s of ["limitless", "exhorizon-6", "Đêm nhạc"]) {
            const h = hashString(s);
            expect(Number.isInteger(h)).toBe(true);
            expect(h).toBeGreaterThanOrEqual(0);
            expect(h).toBeLessThanOrEqual(0xffffffff);
        }
        expect(hashString("limitless")).not.toBe(hashString("exhorizon-6"));
    });
});

describe("splitTitle", () => {
    it("tiêu đề rỗng hoặc một từ giữ nguyên", () => {
        expect(splitTitle("")).toEqual([]);
        expect(splitTitle("   ")).toEqual([]);
        expect(splitTitle("LIMITLESS")).toEqual(["LIMITLESS"]);
        expect(splitTitle("Cực-kỳ-dài-nhưng-chỉ-một-từ-không-thể-tách-được-dù-dài-hơn-44-ký-tự")).toHaveLength(1);
    });

    it("tiêu đề ngắn giữ một dòng", () => {
        expect(splitTitle("Rock In")).toEqual(["Rock In"]);
    });

    it("chia sao cho dòng dài nhất ngắn nhất có thể", () => {
        expect(splitTitle("Sao Concert Day 2")).toEqual(["Sao Concert", "Day 2"]);
        expect(splitTitle("Rock In Bảo Tàng Mỹ Thuật")).toEqual(["Rock In", "Bảo Tàng", "Mỹ Thuật"]);
    });

    it.each([
        "Live Concert Ánh Sáng Màn Đêm",
        "Buổi Liên Hoan Văn Nghệ Đầu Tiên Của Đàn Ems Anh Lâm Hùng",
        "Concert Chị Đẹp 30 Chưa Từng Là Giới Hạn Đêm Cuối",
    ])("%s: không mất chữ, không quá 4 dòng, không dòng rỗng", (title) => {
        const lines = splitTitle(title);
        expect(lines.join(" ")).toBe(title);
        expect(lines.length).toBeLessThanOrEqual(4);
        expect(lines.every((l) => l.length > 0)).toBe(true);
    });

    it("gộp khoảng trắng thừa giữa các từ", () => {
        expect(splitTitle("  Rock    In  ")).toEqual(["Rock In"]);
    });
});

describe("artistKey", () => {
    it("bỏ khoảng trắng hai đầu và không phân biệt hoa thường (để gộp cùng một nghệ sĩ)", () => {
        expect(artistKey("  Grey D ")).toBe("grey d");
        expect(artistKey("PHÙNG KHÁNH LINH")).toBe(artistKey("Phùng Khánh Linh"));
    });
});

describe("hasCompanion", () => {
    it.each([
        "Một mình",
        "một mình",
        "MỘT MÌNH",
        "  Một   mình  ",
        "1 mình",
        "Đi một mình",
        "đi 1 mình",
        "Mot minh",
        "Solo",
        "alone",
        "By myself",
        "Just me",
    ])("%j là đi một mình nên không hiện Đi cùng", (value) => {
        expect(hasCompanion(value)).toBe(false);
    });

    it.each(["", "   ", null, undefined])("chưa có người đi cùng (%j) thì không hiện", (value) => {
        expect(hasCompanion(value)).toBe(false);
    });

    it.each(["@leminhthu", "Bạn thân", "Cả nhà", "Một mình bạn", "Hai đứa", "Mình và bạn"])("%j có người đi cùng thật nên vẫn hiện", (value) => {
        expect(hasCompanion(value)).toBe(true);
    });
});

describe("ticketNumber", () => {
    it("năm của ngày diễn ra và thứ tự đủ 4 chữ số", () => {
        expect(ticketNumber("28.08.2026", 21)).toBe("2026-0021");
        expect(ticketNumber(new Date(2024, 3, 6, 12), 1)).toBe("2024-0001");
        expect(ticketNumber("01.01.2025", 12345)).toBe("2025-12345");
    });

    it("thiếu ngày hoặc thứ tự thì không có số vé", () => {
        expect(ticketNumber("abc", 3)).toBeNull();
        expect(ticketNumber(null, 3)).toBeNull();
        expect(ticketNumber("28.08.2026", 0)).toBeNull();
    });
});

describe("clampRatio", () => {
    it("giữ nguyên tỉ lệ bình thường", () => {
        expect(clampRatio(1.5)).toBe(1.5);
        expect(clampRatio(0.8)).toBe(0.8);
    });

    it("kẹp ảnh cực đoan vào khoảng 0.5 đến 2.4", () => {
        expect(clampRatio(0.1)).toBe(0.5);
        expect(clampRatio(10)).toBe(2.4);
    });

    it.each([null, undefined, 0, Number.NaN, Number.POSITIVE_INFINITY])("chưa biết tỉ lệ (%s) thì dùng giá trị dự phòng", (ratio) => {
        expect(clampRatio(ratio)).toBe(0.8);
        expect(clampRatio(ratio, 1.2)).toBe(1.2);
    });
});

describe("media", () => {
    it("isMediaUrl nhận ảnh và video theo đuôi, không phân biệt hoa thường", () => {
        for (const ext of ["jpg", "JPEG", "png", "webp", "gif", "avif", "mp4", "webm", "MOV", "m4v"]) {
            expect(isMediaUrl(`https://x.example/a.${ext}`)).toBe(true);
        }
        for (const src of ["https://x.example/a.txt", "https://x.example/a", "https://x.example/jpg", "https://x.example/a.jpg.exe"]) {
            expect(isMediaUrl(src)).toBe(false);
        }
    });

    it("getMediaList lọc mục lạ, đánh dấu video và giữ thứ tự", () => {
        expect(getMediaList(["https://x/a.jpg", "https://x/ghi-chu.txt", "https://x/b.MP4", "https://x/c.webm"])).toEqual([
            {src: "https://x/a.jpg", isVideo: false},
            {src: "https://x/b.MP4", isVideo: true},
            {src: "https://x/c.webm", isVideo: true},
        ]);
    });

    it("getMediaList chịu được undefined và mảng rỗng", () => {
        expect(getMediaList(undefined)).toEqual([]);
        expect(getMediaList([])).toEqual([]);
    });

    it("getCoverMedia là mục đầu tiên hợp lệ (có thể là video)", () => {
        expect(getCoverMedia(["https://x/ghi-chu.txt", "https://x/a.mp4", "https://x/b.jpg"])).toEqual({src: "https://x/a.mp4", isVideo: true});
        expect(getCoverMedia([])).toBeUndefined();
    });
});

describe("toCard", () => {
    const base: IConcert = {
        slug: "rock-in-bao-tang-my-thuat",
        kind: "attended",
        date: "28.08.2026",
        title: "ROCK IN BẢO TÀNG MỸ THUẬT",
        body: "<p>Đi concert cũng nhiều rồi</p><p>Đoạn hai</p>",
        images: ["https://x.example/a.jpg", "https://x.example/b.mp4"],
        city: null,
        venue: "Bảo tàng Mỹ thuật",
        artistName: "Rock In Museum",
        concertVenue: "Nơi cũ",
        zone: null,
        row: null,
        seat: null,
        companion: "Một mình",
        ticketPrice: 900000,
        rating: 5,
        active: true,
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1),
    };

    it("gom dữ liệu hiển thị cho thẻ vé", () => {
        expect(cardOf(base, 21)).toEqual({
            slug: "rock-in-bao-tang-my-thuat",
            title: "ROCK IN BẢO TÀNG MỸ THUẬT",
            artistName: "Rock In Museum",
            longDate: "28 tháng 8, 2026",
            year: 2026,
            day: 28,
            month: 8,
            no: "2026-0021",
            city: null,
            place: "Bảo tàng Mỹ thuật",
            quote: "Đi concert cũng nhiều rồi",
            companion: "Một mình",
            priceLabel: "900.000đ",
            rating: 5,
            zone: null,
            row: null,
            seat: null,
            cover: {src: "https://x.example/a.jpg", isVideo: false},
            mediaCount: 2,
            tone: null,
        });
    });

    it("truyền tông giấy (tính theo ảnh bìa) vào thẻ", () => {
        const tone = {f1: "#fff", f2: "#eee", f3: "#ddd", glow: "#ccc"};
        expect(cardOf(base, 1, tone).tone).toBe(tone);
    });

    it("địa điểm lấy venue, không có thì lùi về concertVenue của dữ liệu cũ", () => {
        expect(cardOf(base).place).toBe("Bảo tàng Mỹ thuật");
        expect(cardOf({...base, venue: null}).place).toBe("Nơi cũ");
        expect(cardOf({...base, venue: null, concertVenue: undefined as unknown as string}).place).toBeNull();
    });

    it("tiếng Anh: ngày dài và giá theo cách viết Mỹ, vé mời ghi Free", () => {
        const card = cardOf(base, 21, null, "en");
        expect(card.longDate).toBe("August 28, 2026");
        expect(card.priceLabel).toBe("900,000đ");
        expect(cardOf({...base, ticketPrice: 0}, 21, null, "en").priceLabel).toBe("Free");
    });

    it("giá vé: có giá, miễn phí, chưa có", () => {
        expect(cardOf({...base, ticketPrice: 1500000}).priceLabel).toBe("1.500.000đ");
        expect(cardOf({...base, ticketPrice: 0}).priceLabel).toBe("Miễn phí");
        expect(cardOf({...base, ticketPrice: null}).priceLabel).toBeNull();
        expect(cardOf({...base, ticketPrice: undefined}).priceLabel).toBeNull();
    });

    it("số vé để trống khi không có thứ tự, ngày hỏng thì không có ngày", () => {
        expect(cardOf(base).no).toBe("");
        const bad = cardOf({...base, date: "abc"}, 3);
        expect(bad).toMatchObject({longDate: "", year: null, day: null, month: null, no: ""});
    });

    it("chưa có ảnh nào thì không có bìa", () => {
        expect(cardOf({...base, images: []})).toMatchObject({cover: null, mediaCount: 0});
        expect(cardOf({...base, images: ["https://x/ghi-chu.txt"]})).toMatchObject({cover: null, mediaCount: 0});
    });

    it("bìa là video thì cover.isVideo = true", () => {
        expect(cardOf({...base, images: ["https://x.example/a.mp4"]}).cover).toEqual({src: "https://x.example/a.mp4", isVideo: true});
    });

    it("dữ liệu cũ thiếu trường tùy chọn vẫn dùng được (null thay vì undefined)", () => {
        const legacy = {...base, zone: undefined, row: undefined, seat: undefined, city: undefined} as unknown as IConcert;
        expect(cardOf(legacy)).toMatchObject({zone: null, row: null, seat: null, city: null});
    });
});

// Server Vercel chạy giờ UTC còn máy bạn chạy UTC+7: ngày trên tờ vé phải giống nhau ở mọi nơi.
describe("ngày trên vé không lệch theo múi giờ của server", () => {
    const original = process.env.TZ;
    afterEach(() => {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
    });

    const legacyEntry = {date: "31.01.2026"} as IConcert;
    // toDoc lưu 12:00 UTC (xem lib/event-input.ts)
    const storedEntry = {date: new Date("2026-01-31T12:00:00.000Z")} as IConcert;
    const card = (c: IConcert) => {
        const full = {...c, slug: "s", title: "t", body: "<p>x</p>", images: [], artistName: "a", companion: "c", rating: 5} as IConcert;
        const {day, month, year, longDate} = cardOf(full, 1);
        return {day, month, year, longDate};
    };

    it.each(["UTC", "Asia/Ho_Chi_Minh", "Asia/Tokyo", "Europe/London", "America/Los_Angeles", "Pacific/Pago_Pago"])("%s", (tz) => {
        process.env.TZ = tz;
        // chắc chắn múi giờ thực sự đã đổi (nếu không, test này vô nghĩa)
        expect(new Date(2026, 0, 31).getTimezoneOffset()).toBe(
            {
                "UTC": 0, "Asia/Ho_Chi_Minh": -420, "Asia/Tokyo": -540, "Europe/London": 0,
                "America/Los_Angeles": 480, "Pacific/Pago_Pago": 660,
            }[tz],
        );
        const want = {day: 31, month: 1, year: 2026, longDate: "31 tháng 1, 2026"};
        expect(card(legacyEntry)).toEqual(want);
        expect(card(storedEntry)).toEqual(want);
    });
});
