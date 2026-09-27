import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {IConcert} from "@/lib/concerts";
import {dateToInput, EMPTY_VALUES, parseEventForm, toDoc, valuesFromDoc} from "@/lib/event-input";

// chỉ host của R2_PUBLIC_URL được phép (không còn host ghi cứng trong code)
const HOST = "media.example.com";
beforeEach(() => {
    vi.stubEnv("R2_PUBLIC_URL", `https://${HOST}`);
});

const media = (name: string) => `https://${HOST}/diary-images/${name}`;

// Form hợp lệ; truyền undefined để bỏ hẳn một trường (như ô checkbox không tick)
function form(overrides: Record<string, string | undefined> = {}) {
    const fields: Record<string, string | undefined> = {
        title: "Đêm nhạc thử",
        artistName: "Grey D",
        date: "2026-07-03",
        venue: "Nhà hát Hòa Bình",
        city: "",
        zone: "",
        row: "",
        seat: "",
        companion: "",
        ticketPrice: "",
        extraCosts: "[]",
        merchResale: "[]",
        rating: "5",
        body: "<p>Hay lắm</p>",
        active: "on",
        images: "[]",
        ...overrides,
    };
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value !== undefined) fd.set(key, value);
    return fd;
}

describe("parseEventForm: dữ liệu hợp lệ", () => {
    it("không có lỗi và trả lại đúng giá trị", () => {
        const {values, errors} = parseEventForm(form());
        expect(errors).toEqual({});
        expect(values).toMatchObject({
            title: "Đêm nhạc thử",
            artistName: "Grey D",
            date: "2026-07-03",
            venue: "Nhà hát Hòa Bình",
            companion: "",
            ticketPrice: "",
            extraCosts: [],
            merchResale: [],
            rating: "5",
            body: "<p>Hay lắm</p>",
            active: true,
            images: [],
        });
    });

    it("cắt khoảng trắng hai đầu của các ô văn bản", () => {
        const {values} = parseEventForm(form({title: "  Đêm nhạc  ", artistName: "\tGrey D\n", venue: " Nhà hát "}));
        expect(values).toMatchObject({title: "Đêm nhạc", artistName: "Grey D", venue: "Nhà hát"});
    });

    it("chuẩn hóa xuống dòng CRLF của thân bài", () => {
        expect(parseEventForm(form({body: "<p>a</p>\r\n<p>b</p>"})).values.body).toBe("<p>a</p>\n<p>b</p>");
    });

    it("ô hiển thị chỉ bật khi checkbox có giá trị on", () => {
        expect(parseEventForm(form({active: "on"})).values.active).toBe(true);
        expect(parseEventForm(form({active: undefined})).values.active).toBe(false);
        expect(parseEventForm(form({active: "true"})).values.active).toBe(false);
    });

    it("đánh giá thiếu thì mặc định 0", () => {
        const {values, errors} = parseEventForm(form({rating: undefined}));
        expect(values.rating).toBe("0");
        expect(errors.rating).toBeUndefined();
    });
});

describe("parseEventForm: trường bắt buộc và độ dài", () => {
    it.each([
        ["title", "Tên chương trình không được để trống."],
        ["artistName", "Nghệ sĩ không được để trống."],
        ["venue", "Địa điểm không được để trống."],
    ])("thiếu %s", (key, message) => {
        expect(parseEventForm(form({[key]: ""})).errors[key as "title"]).toBe(message);
        expect(parseEventForm(form({[key]: "   "})).errors[key as "title"]).toBe(message);
        expect(parseEventForm(form({[key]: undefined})).errors[key as "title"]).toBe(message);
    });

    it.each([
        ["title", 200, "Tên chương trình"],
        ["artistName", 120, "Nghệ sĩ"],
        ["venue", 200, "Địa điểm"],
        ["city", 100, "Thành phố"],
        ["zone", 50, "Zone"],
        ["row", 50, "Hàng"],
        ["seat", 50, "Ghế"],
        ["companion", 200, "Đi cùng"],
    ])("%s tối đa %d ký tự", (key, max, label) => {
        expect(parseEventForm(form({[key]: "a".repeat(max)})).errors[key as "title"]).toBeUndefined();
        expect(parseEventForm(form({[key]: "a".repeat(max + 1)})).errors[key as "title"]).toBe(`${label} tối đa ${max} ký tự.`);
    });

    it("các ô không bắt buộc được để trống", () => {
        const {errors} = parseEventForm(form({city: "", zone: "", row: "", seat: "", companion: ""}));
        expect(errors).toEqual({});
    });
});

describe("parseEventForm: nhật ký", () => {
    it("rỗng hoặc chỉ có thẻ trống thì báo lỗi", () => {
        expect(parseEventForm(form({body: ""})).errors.body).toBe("Cảm nhận không được để trống.");
        expect(parseEventForm(form({body: "<p></p>"})).errors.body).toBe("Cảm nhận không được để trống.");
        expect(parseEventForm(form({body: "<p>   </p>"})).errors.body).toBe("Cảm nhận không được để trống.");
    });

    it("quá 60.000 ký tự (kể cả định dạng) thì báo lỗi", () => {
        const fits = `<p>${"a".repeat(60000 - 7)}</p>`;
        expect(fits).toHaveLength(60000);
        expect(parseEventForm(form({body: fits})).errors.body).toBeUndefined();
        expect(parseEventForm(form({body: `${fits}a`})).errors.body).toContain("quá dài");
    });
});

describe("parseEventForm: ngày diễn ra", () => {
    it.each(["2026-07-03", "2026-02-28", "2024-02-29", "2026-12-31"])("nhận ngày có thật %s", (date) => {
        expect(parseEventForm(form({date})).errors.date).toBeUndefined();
    });

    it.each([
        "",
        "abc",
        "2026-7-3",
        "03/07/2026",
        "03.07.2026",
        "2026-13-01",
        "2026-00-10",
        "2026-07-00",
        "2026-07-32",
        // ngày không tồn tại: trước đây Date lặng lẽ tràn sang tháng sau (2026-02-31 thành 2026-03-03)
        "2026-02-31",
        "2026-02-29",
        "2026-04-31",
        "2026-06-31",
    ])("từ chối %j", (date) => {
        expect(parseEventForm(form({date})).errors.date).toBe("Chọn ngày diễn ra.");
    });

    it("thiếu hẳn ô ngày cũng báo lỗi", () => {
        expect(parseEventForm(form({date: undefined})).errors.date).toBe("Chọn ngày diễn ra.");
    });
});

describe("parseEventForm: đánh giá", () => {
    it.each(["0", "1", "2", "3", "4", "5"])("nhận %s", (rating) => {
        expect(parseEventForm(form({rating})).errors.rating).toBeUndefined();
    });

    it.each(["6", "-1", "10", "1.5", "abc", "05", "5 sao"])("từ chối %j", (rating) => {
        expect(parseEventForm(form({rating})).errors.rating).toBe("Đánh giá phải từ 0 đến 5.");
    });

    it("ô trống hoặc toàn khoảng trắng được coi là 0", () => {
        for (const rating of ["", "   "]) {
            const {values, errors} = parseEventForm(form({rating}));
            expect(values.rating).toBe("0");
            expect(errors.rating).toBeUndefined();
        }
    });
});

describe("parseEventForm: giá vé", () => {
    it("để trống là chưa có giá", () => {
        const {values, errors} = parseEventForm(form({ticketPrice: ""}));
        expect(values.ticketPrice).toBe("");
        expect(errors.ticketPrice).toBeUndefined();
    });

    it.each([
        ["1500000", "1500000"],
        ["1.500.000đ", "1500000"],
        ["1,500,000", "1500000"],
        ["350000 vnd", "350000"],
        ["0", "0"],
    ])("chuẩn hóa %j thành %j để lưu", (input, expected) => {
        const {values, errors} = parseEventForm(form({ticketPrice: input}));
        expect(errors.ticketPrice).toBeUndefined();
        expect(values.ticketPrice).toBe(expected);
    });

    it.each(["abc", "-5", "1.5", "100000001"])("từ chối %j và giữ nguyên chữ đã gõ để form hiện lại", (input) => {
        const {values, errors} = parseEventForm(form({ticketPrice: input}));
        expect(errors.ticketPrice).toBe("Giá vé phải là số từ 0 đến 100.000.000 (VND).");
        expect(values.ticketPrice).toBe(input);
    });
});

describe("parseEventForm: chi phí phát sinh & khoản thu hồi", () => {
    it("không có dòng nào là hợp lệ (mảng rỗng)", () => {
        const {values, errors} = parseEventForm(form({extraCosts: "[]", merchResale: "[]"}));
        expect(errors.extraCosts).toBeUndefined();
        expect(errors.merchResale).toBeUndefined();
        expect(values.extraCosts).toEqual([]);
        expect(values.merchResale).toEqual([]);
    });

    it("chuẩn hóa số tiền của từng dòng, giữ nhãn", () => {
        const extraCosts = JSON.stringify([{label: "Taxi", amount: "150000"}, {label: "Grab", amount: "1.500.000đ"}]);
        const merchResale = JSON.stringify([{label: "Áo thun", amount: "80.000"}]);
        const {values, errors} = parseEventForm(form({extraCosts, merchResale}));
        expect(errors.extraCosts).toBeUndefined();
        expect(errors.merchResale).toBeUndefined();
        expect(values.extraCosts).toEqual([{label: "Taxi", amount: "150000"}, {label: "Grab", amount: "1500000"}]);
        expect(values.merchResale).toEqual([{label: "Áo thun", amount: "80000"}]);
    });

    it("dòng để trống hoàn toàn bị bỏ qua êm, không báo lỗi", () => {
        const extraCosts = JSON.stringify([{label: "Taxi", amount: "50000"}, {label: "", amount: ""}]);
        const {values, errors} = parseEventForm(form({extraCosts}));
        expect(errors.extraCosts).toBeUndefined();
        expect(values.extraCosts).toEqual([{label: "Taxi", amount: "50000"}]);
    });

    it("có nhãn mà thiếu số tiền (hoặc ngược lại) thì báo lỗi riêng cho từng field", () => {
        const {errors: e1} = parseEventForm(form({extraCosts: JSON.stringify([{label: "Taxi", amount: ""}])}));
        expect(e1.extraCosts).toContain("Taxi");
        expect(e1.merchResale).toBeUndefined();

        const {errors: e2} = parseEventForm(form({merchResale: JSON.stringify([{label: "", amount: "50000"}])}));
        expect(e2.merchResale).toContain("50000");
        expect(e2.extraCosts).toBeUndefined();
    });

    it("JSON hỏng hoặc thiếu trường thì coi như không có dòng nào (không lỗi)", () => {
        for (const raw of [undefined, "không phải json", "{}", "null"]) {
            const {values, errors} = parseEventForm(form({extraCosts: raw, merchResale: raw}));
            expect(values.extraCosts).toEqual([]);
            expect(values.merchResale).toEqual([]);
            expect(errors.extraCosts).toBeUndefined();
            expect(errors.merchResale).toBeUndefined();
        }
    });
});

describe("parseEventForm: ảnh và video", () => {
    it("nhận danh sách địa chỉ hợp lệ, giữ thứ tự", () => {
        const images = [media("a.jpg"), media("b.mp4")];
        const {values, errors} = parseEventForm(form({images: JSON.stringify(images)}));
        expect(errors.images).toBeUndefined();
        expect(values.images).toEqual(images);
    });

    it("thiếu trường, JSON hỏng hoặc không phải mảng thì coi như không có ảnh (không lỗi)", () => {
        for (const images of [undefined, "không phải json", "{}", "null", '"abc"']) {
            const {values, errors} = parseEventForm(form({images}));
            expect(values.images).toEqual([]);
            expect(errors.images).toBeUndefined();
        }
    });

    it("bỏ các phần tử không phải chuỗi", () => {
        const {values} = parseEventForm(form({images: JSON.stringify([media("a.jpg"), 5, null, {x: 1}])}));
        expect(values.images).toEqual([media("a.jpg")]);
    });

    it("tối đa 80 ảnh/video", () => {
        const many = Array.from({length: 80}, (_, i) => media(`${i}.jpg`));
        expect(parseEventForm(form({images: JSON.stringify(many)})).errors.images).toBeUndefined();
        expect(parseEventForm(form({images: JSON.stringify([...many, media("81.jpg")])})).errors.images).toBe("Tối đa 80 ảnh/video.");
    });

    it.each([
        ["host lạ", "https://evil.example.com/a.jpg"],
        ["http thay vì https", `http://${HOST}/a.jpg`],
        ["không phải ảnh/video", media("ghi-chu.txt")],
        ["chuỗi không phải URL", "a.jpg"],
        ["scheme nguy hiểm", "javascript:alert(1)"],
    ])("từ chối địa chỉ %s (chặn lưu link tùy ý vào DB)", (_name, url) => {
        const {errors} = parseEventForm(form({images: JSON.stringify([media("ok.jpg"), url])}));
        expect(errors.images).toContain("Địa chỉ không hợp lệ");
        expect(errors.images).toContain(url);
        // báo rõ host nào được nhận (lấy từ R2_PUBLIC_URL)
        expect(errors.images).toContain(HOST);
    });

    it("chưa đặt R2_PUBLIC_URL thì không nhận URL nào và thông báo nêu đúng tên biến cần đặt", () => {
        vi.stubEnv("R2_PUBLIC_URL", "");
        const {errors} = parseEventForm(form({images: JSON.stringify([media("ok.jpg")])}));
        expect(errors.images).toContain("Địa chỉ không hợp lệ");
        expect(errors.images).toContain("R2_PUBLIC_URL");
    });
});

describe("parseEventForm: nhiều lỗi cùng lúc", () => {
    it("báo đủ từng trường", () => {
        const {errors} = parseEventForm(form({title: "", date: "", rating: "9", ticketPrice: "abc", body: ""}));
        expect(Object.keys(errors).sort()).toEqual(["body", "date", "rating", "ticketPrice", "title"]);
    });
});

describe("toDoc", () => {
    const docOf = (overrides: Record<string, string | undefined> = {}) => {
        const {values, errors} = parseEventForm(form(overrides));
        expect(errors).toEqual({});
        return toDoc(values);
    };

    it("ghi đúng các trường và loại sự kiện", () => {
        expect(docOf({city: "TP.HCM", zone: "The Sorrow", row: "JP", seat: "06", companion: "Bạn", rating: "4", ticketPrice: "1.199.000đ"})).toMatchObject({
            kind: "attended",
            title: "Đêm nhạc thử",
            artistName: "Grey D",
            venue: "Nhà hát Hòa Bình",
            city: "TP.HCM",
            zone: "The Sorrow",
            row: "JP",
            seat: "06",
            companion: "Bạn",
            rating: 4,
            ticketPrice: 1199000,
            active: true,
            images: [],
        });
    });

    it("ngày lưu lúc 12:00 UTC để không lệch sang ngày khác ở các múi giờ khác nhau", () => {
        const {date} = docOf({date: "2026-07-03"});
        expect(date).toBeInstanceOf(Date);
        expect(date.toISOString()).toBe("2026-07-03T12:00:00.000Z");
    });

    it("venue được ghi song song vào concertVenue (schema vẫn bắt buộc trường cũ này)", () => {
        const doc = docOf({venue: "Nhà hát Hòa Bình"});
        expect(doc.concertVenue).toBe("Nhà hát Hòa Bình");
        expect(doc).not.toHaveProperty("concertName");
    });

    it("ô để trống được lưu là null, riêng Đi cùng mặc định là Một mình", () => {
        const doc = docOf();
        expect(doc).toMatchObject({city: null, zone: null, row: null, seat: null, companion: "Một mình"});
    });

    it("giá vé: để trống là null, 0 là vé mời, số thì lưu dạng số", () => {
        expect(docOf({ticketPrice: ""}).ticketPrice).toBeNull();
        expect(docOf({ticketPrice: "0"}).ticketPrice).toBe(0);
        expect(docOf({ticketPrice: "900.000"}).ticketPrice).toBe(900000);
        expect(typeof docOf({ticketPrice: "900000"}).ticketPrice).toBe("number");
    });

    it("chi phí phát sinh và khoản thu hồi: mảng rỗng khi không có dòng, đủ nhãn+số khi có", () => {
        expect(docOf().extraCosts).toEqual([]);
        expect(docOf().merchResale).toEqual([]);
        const doc = docOf({
            extraCosts: JSON.stringify([{label: "Taxi", amount: "150000"}]),
            merchResale: JSON.stringify([{label: "Áo thun", amount: "80000"}]),
        });
        expect(doc.extraCosts).toEqual([{label: "Taxi", amount: 150000}]);
        expect(doc.merchResale).toEqual([{label: "Áo thun", amount: 80000}]);
    });

    it("thân bài được lọc HTML trước khi lưu", () => {
        const doc = docOf({body: '<p onclick="x()">ok</p><script>alert(1)</script>'});
        expect(doc.body).toBe("<p>ok</p>");
    });

    it("ẩn sự kiện khi không tick hiển thị", () => {
        expect(docOf({active: undefined}).active).toBe(false);
    });
});

describe("valuesFromDoc", () => {
    const base: IConcert = {
        slug: "s",
        kind: "attended",
        // trưa theo giờ địa phương để kết quả không phụ thuộc múi giờ máy chạy test
        date: new Date(2026, 6, 3, 12),
        title: "Tiêu đề",
        body: "<p>Nội dung</p>",
        images: [media("a.jpg")],
        city: "TP.HCM",
        venue: "Nhà hát",
        artistName: "Grey D",
        concertVenue: "Nơi cũ",
        zone: "GA2",
        row: "B",
        seat: "22",
        companion: "Bạn",
        ticketPrice: 1199000,
        extraCosts: [{label: "Taxi", amount: 150000}],
        merchResale: [{label: "Áo thun", amount: 80000}],
        rating: 4,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    it("đổi document thành giá trị form (toàn chuỗi)", () => {
        expect(valuesFromDoc(base)).toEqual({
            title: "Tiêu đề",
            artistName: "Grey D",
            date: "2026-07-03",
            venue: "Nhà hát",
            city: "TP.HCM",
            zone: "GA2",
            row: "B",
            seat: "22",
            companion: "Bạn",
            ticketPrice: "1199000",
            extraCosts: [{label: "Taxi", amount: "150000"}],
            merchResale: [{label: "Áo thun", amount: "80000"}],
            rating: "4",
            body: "<p>Nội dung</p>",
            active: true,
            images: [media("a.jpg")],
        });
    });

    it("dữ liệu cũ: ngày dạng chuỗi DD.MM.YYYY, địa điểm nằm ở concertVenue, các ô tùy chọn là null", () => {
        const legacy = {...base, date: "31.01.2026", venue: null, city: null, zone: null, row: null, seat: null, ticketPrice: null} as IConcert;
        expect(valuesFromDoc(legacy)).toMatchObject({date: "2026-01-31", venue: "Nơi cũ", city: "", zone: "", row: "", seat: "", ticketPrice: ""});
    });

    it("giá vé: có số thì thành chuỗi số, 0 vẫn giữ (không bị coi là trống), thiếu thì rỗng", () => {
        expect(valuesFromDoc({...base, ticketPrice: 0}).ticketPrice).toBe("0");
        expect(valuesFromDoc({...base, ticketPrice: undefined}).ticketPrice).toBe("");
    });

    it("chi phí phát sinh & khoản thu hồi: số thành chuỗi, thiếu trường (dữ liệu cũ) thì mảng rỗng", () => {
        expect(valuesFromDoc(base).extraCosts).toEqual([{label: "Taxi", amount: "150000"}]);
        expect(valuesFromDoc(base).merchResale).toEqual([{label: "Áo thun", amount: "80000"}]);
        expect(valuesFromDoc({...base, extraCosts: undefined, merchResale: undefined}).extraCosts).toEqual([]);
        expect(valuesFromDoc({...base, extraCosts: undefined, merchResale: undefined}).merchResale).toEqual([]);
    });

    it("đánh giá được làm tròn và kẹp trong khoảng 0 đến 5", () => {
        expect(valuesFromDoc({...base, rating: 4.6}).rating).toBe("5");
        expect(valuesFromDoc({...base, rating: -2}).rating).toBe("0");
        expect(valuesFromDoc({...base, rating: 9}).rating).toBe("5");
        expect(valuesFromDoc({...base, rating: undefined as unknown as number}).rating).toBe("0");
    });

    it("nhật ký cũ dạng văn bản được đổi sang HTML để trình soạn thảo mở được", () => {
        expect(valuesFromDoc({...base, body: "Mở đầu\n- một"}).body).toBe("<p>Mở đầu</p><ul><li><p>một</p></li></ul>");
    });

    it("thiếu ảnh và người đi cùng thì dùng giá trị rỗng", () => {
        const doc = {...base, images: undefined, companion: undefined} as unknown as IConcert;
        expect(valuesFromDoc(doc)).toMatchObject({images: [], companion: ""});
    });
});

describe("EMPTY_VALUES", () => {
    it("là form trắng cho sự kiện mới: hiển thị công khai, 5 sao, chưa có giá", () => {
        expect(EMPTY_VALUES).toMatchObject({title: "", artistName: "", date: "", ticketPrice: "", extraCosts: [], merchResale: [], rating: "5", active: true, images: []});
    });
});

describe("dateToInput", () => {
    const original = process.env.TZ;
    afterEach(() => {
        vi.unstubAllEnvs();
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
    });

    it("đổi mọi kiểu ngày trong DB sang YYYY-MM-DD cho ô chọn ngày", () => {
        expect(dateToInput("31.01.2026")).toBe("2026-01-31");
        expect(dateToInput("1.2.2026")).toBe("2026-02-01");
        expect(dateToInput(new Date(2026, 6, 3, 12))).toBe("2026-07-03");
    });

    it("không có ngày hợp lệ thì rỗng", () => {
        expect(dateToInput(null)).toBe("");
        expect(dateToInput(undefined)).toBe("");
        expect(dateToInput("abc")).toBe("");
    });

    // Lý do lưu 12:00 UTC: từ UTC-11 đến UTC+11 (mọi nơi có người dùng bình thường) đều rơi đúng ngày đã chọn.
    it.each(["Pacific/Pago_Pago", "America/Los_Angeles", "UTC", "Europe/Paris", "Asia/Ho_Chi_Minh", "Asia/Tokyo", "Pacific/Noumea"])(
        "ngày đã chọn không đổi khi mở form ở múi giờ %s",
        (tz) => {
            process.env.TZ = tz;
            const stored = toDoc(parseEventForm(form({date: "2026-07-03"})).values).date;
            expect(dateToInput(stored)).toBe("2026-07-03");
            expect(dateToInput(new Date("2026-01-01T12:00:00.000Z"))).toBe("2026-01-01");
            expect(dateToInput(new Date("2026-12-31T12:00:00.000Z"))).toBe("2026-12-31");
        },
    );
});

describe("parseEventForm: thông báo lỗi tiếng Anh", () => {
    it("trường bắt buộc và độ dài", () => {
        const {errors} = parseEventForm(form({title: "", artistName: "a".repeat(121), venue: " "}), "en");
        expect(errors.title).toBe("Show name can't be empty.");
        expect(errors.artistName).toBe("Artist can be at most 120 characters.");
        expect(errors.venue).toBe("Venue can't be empty.");
        expect(parseEventForm(form({city: "a".repeat(101)}), "en").errors.city).toBe("City can be at most 100 characters.");
    });

    it("nhật ký, ngày, đánh giá, giá vé", () => {
        expect(parseEventForm(form({body: "<p></p>"}), "en").errors.body).toBe("How it felt can't be empty.");
        expect(parseEventForm(form({date: "2026-02-31"}), "en").errors.date).toBe("Pick the show date.");
        expect(parseEventForm(form({rating: "9"}), "en").errors.rating).toBe("Rating must be between 0 and 5.");
        expect(parseEventForm(form({ticketPrice: "abc"}), "en").errors.ticketPrice).toBe("Ticket price must be a number from 0 to 100,000,000 (VND).");
    });

    it("chi phí dùng tên ô tiếng Anh; khoản thu hồi tên là Money back", () => {
        const bad = JSON.stringify([{label: "Taxi", amount: ""}]);
        expect(parseEventForm(form({extraCosts: bad}), "en").errors.extraCosts).toBe('Extra costs — line "Taxi": needs both a label and an amount.');
        expect(parseEventForm(form({merchResale: bad}), "en").errors.merchResale).toBe('Money back — line "Taxi": needs both a label and an amount.');
    });

    it("ảnh: quá nhiều và địa chỉ lạ", () => {
        const many = Array.from({length: 81}, (_, i) => media(`${i}.jpg`));
        expect(parseEventForm(form({images: JSON.stringify(many)}), "en").errors.images).toBe("At most 80 photos/videos.");
        expect(parseEventForm(form({images: JSON.stringify(["https://evil.example/a.jpg"])}), "en").errors.images).toMatch(/^Invalid address: https:\/\/evil\.example\/a\.jpg\. Only https photos\/videos from /);
    });

    it("tiếng Việt vẫn là mặc định và khác tiếng Anh", () => {
        expect(parseEventForm(form({title: ""})).errors.title).toBe("Tên chương trình không được để trống.");
    });
});
