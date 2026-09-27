import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

// chỉ host của R2_PUBLIC_URL được phép (không còn host ghi cứng trong code)
const HOST = "media.example.com";
beforeEach(() => {
    vi.stubEnv("R2_PUBLIC_URL", `https://${HOST}`);
});

// tone.ts import sharp (module native) chỉ để đọc điểm ảnh; các test ở đây không cần ảnh thật nên thay bằng giả cho nhanh và độc lập máy.
vi.mock("sharp", () => ({default: vi.fn()}));

const {getCoverTones, toneFromDominant, toneSourceUrl} = await import("@/lib/tone");

const media = (name: string) => `https://${HOST}/diary-images/${name}`;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
    const [r, g, b] = rgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// độ sặc sỡ thô: khoảng cách giữa kênh lớn nhất và nhỏ nhất
const saturation = (hex: string) => Math.max(...rgb(hex)) - Math.min(...rgb(hex));

describe("toneFromDominant", () => {
    const hues = [0, 30, 90, 150, 210, 270, 330];
    const chromas = [0.02, 0.05, 0.1, 0.2];

    it.each(hues.flatMap((hue) => chromas.map((chroma) => [hue, chroma] as const)))("hue %d, chroma %d cho ra mã hex hợp lệ", (hue, chroma) => {
        const tone = toneFromDominant({hue, chroma});
        for (const value of Object.values(tone)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    });

    it.each(hues)("hue %d: ba tầng giấy đi từ sáng đến đậm để chữ mực đen luôn đủ tương phản", (hue) => {
        const {f1, f2, f3} = toneFromDominant({hue, chroma: 0.1});
        expect(luminance(f1)).toBeGreaterThan(luminance(f2));
        expect(luminance(f2)).toBeGreaterThan(luminance(f3));
        // tầng đậm nhất vẫn là giấy sáng (pastel), không tối như nền
        expect(luminance(f3)).toBeGreaterThan(150);
    });

    it("ổn định: cùng đầu vào thì cùng kết quả", () => {
        expect(toneFromDominant({hue: 210, chroma: 0.12})).toEqual(toneFromDominant({hue: 210, chroma: 0.12}));
    });

    it("ảnh rực màu cho giấy đậm sắc hơn ảnh nhạt màu", () => {
        const pale = toneFromDominant({hue: 30, chroma: 0.04});
        const vivid = toneFromDominant({hue: 30, chroma: 0.16});
        expect(saturation(vivid.f3)).toBeGreaterThan(saturation(pale.f3));
        expect(saturation(vivid.glow)).toBeGreaterThan(saturation(pale.glow));
    });

    it("chroma quá nhỏ hoặc quá lớn vẫn bị kẹp trong khoảng an toàn", () => {
        expect(toneFromDominant({hue: 200, chroma: 0})).toEqual(toneFromDominant({hue: 200, chroma: 0.03}));
        expect(toneFromDominant({hue: 200, chroma: 5})).toEqual(toneFromDominant({hue: 200, chroma: 0.14}));
    });

    it("sắc độ khác nhau cho màu khác nhau", () => {
        const red = toneFromDominant({hue: 25, chroma: 0.12});
        const blue = toneFromDominant({hue: 260, chroma: 0.12});
        expect(red.f2).not.toBe(blue.f2);
        expect(rgb(red.f2)[0]).toBeGreaterThan(rgb(red.f2)[2]);
        expect(rgb(blue.f2)[2]).toBeGreaterThan(rgb(blue.f2)[0]);
    });
});

describe("toneSourceUrl", () => {
    it("lấy ảnh đầu tiên không phải video", () => {
        expect(toneSourceUrl([media("a.jpg"), media("b.png")])).toBe(media("a.jpg"));
        expect(toneSourceUrl([media("a.mp4"), media("b.webp")])).toBe(media("b.webp"));
    });

    it("bỏ qua mục không phải ảnh/video", () => {
        expect(toneSourceUrl([media("ghi-chu.txt"), media("b.avif")])).toBe(media("b.avif"));
    });

    it("không có ảnh nào (chỉ video, rỗng, undefined) thì null", () => {
        expect(toneSourceUrl([media("a.mp4"), media("b.mov")])).toBeNull();
        expect(toneSourceUrl([])).toBeNull();
        expect(toneSourceUrl(undefined)).toBeNull();
    });
});

describe("getCoverTones", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("đêm diễn không có ảnh thì tông là null, vé dùng platinum trung tính", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const tones = await getCoverTones([
            {slug: "khong-anh", images: []},
            {slug: "chi-video", images: [media("a.mp4")]},
        ]);
        expect(tones.get("khong-anh")).toBeNull();
        expect(tones.get("chi-video")).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("KHÔNG tải ảnh từ host ngoài danh sách cho phép (chặn server bị lợi dụng để gọi URL bất kỳ)", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const tones = await getCoverTones([
            {slug: "host-la", images: ["https://evil.example.com/a.jpg"]},
            {slug: "noi-bo", images: ["https://169.254.169.254/latest/meta-data/a.jpg"]},
            {slug: "http", images: [`http://${HOST}/a.jpg`]},
        ]);
        expect(fetchMock).not.toHaveBeenCalled();
        expect([...tones.values()]).toEqual([null, null, null]);
    });

    it("trả về đủ mọi slug được hỏi, đúng thứ tự", async () => {
        const tones = await getCoverTones([
            {slug: "b", images: []},
            {slug: "a", images: []},
        ]);
        expect([...tones.keys()]).toEqual(["b", "a"]);
    });

    it("lỗi mạng khi tải ảnh cho phép thì tông null chứ không làm hỏng trang", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("mạng đứt")));
        const tones = await getCoverTones([{slug: "loi-mang", images: [media("loi-mang.jpg")]}]);
        expect(tones.get("loi-mang")).toBeNull();
    });

    it("phản hồi không thành công (404) cũng cho tông null", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("không có", {status: 404})));
        const tones = await getCoverTones([{slug: "404", images: [media("404.jpg")]}]);
        expect(tones.get("404")).toBeNull();
    });
});
