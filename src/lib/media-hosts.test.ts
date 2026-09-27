import {describe, expect, it, vi} from "vitest";
import {allowedMediaHosts, isAllowedMediaUrl, mediaKeysToDelete} from "@/lib/media-hosts";

// Host giả của bucket "của bạn": chỉ host của R2_PUBLIC_URL được phép, không còn host nào ghi cứng trong code
const HOST = "media.example.com";
const configure = (url = `https://${HOST}`) => vi.stubEnv("R2_PUBLIC_URL", url);

describe("allowedMediaHosts", () => {
    it("chưa đặt R2_PUBLIC_URL thì không host nào được phép (không còn host mặc định)", () => {
        vi.stubEnv("R2_PUBLIC_URL", "");
        expect(allowedMediaHosts()).toEqual([]);
    });

    it("chỉ lấy host của R2_PUBLIC_URL, bỏ đường dẫn và dấu / ở cuối", () => {
        configure("https://media.example.com/");
        expect(allowedMediaHosts()).toEqual([HOST]);
        configure("https://cdn.example.com/media/");
        expect(allowedMediaHosts()).toEqual(["cdn.example.com"]);
    });

    it("R2_PUBLIC_URL sai định dạng thì bỏ qua thay vì làm hỏng server", () => {
        vi.stubEnv("R2_PUBLIC_URL", "không phải url");
        expect(allowedMediaHosts()).toEqual([]);
    });
});

describe("isAllowedMediaUrl", () => {
    const ok = `https://${HOST}/diary-images/a.jpg`;

    it("nhận https từ host của R2_PUBLIC_URL", () => {
        configure();
        expect(isAllowedMediaUrl(ok)).toBe(true);
    });

    it("chưa cấu hình thì từ chối tất cả, kể cả https hợp lệ", () => {
        vi.stubEnv("R2_PUBLIC_URL", "");
        expect(isAllowedMediaUrl(ok)).toBe(false);
    });

    it("từ chối http, dù đúng host", () => {
        configure();
        expect(isAllowedMediaUrl(`http://${HOST}/a.jpg`)).toBe(false);
    });

    it("từ chối host lạ và các mẹo giả host", () => {
        configure();
        expect(isAllowedMediaUrl("https://evil.example.com/a.jpg")).toBe(false);
        expect(isAllowedMediaUrl(`https://${HOST}.evil.com/a.jpg`)).toBe(false);
        expect(isAllowedMediaUrl(`https://evil.com/${HOST}/a.jpg`)).toBe(false);
        expect(isAllowedMediaUrl(`https://evil.com?u=${HOST}`)).toBe(false);
    });

    it("từ chối chuỗi không phải URL và các scheme nguy hiểm", () => {
        configure();
        expect(isAllowedMediaUrl("")).toBe(false);
        expect(isAllowedMediaUrl("a.jpg")).toBe(false);
        expect(isAllowedMediaUrl("javascript:alert(1)")).toBe(false);
        expect(isAllowedMediaUrl(`data:image/png;base64,AAAA`)).toBe(false);
        expect(isAllowedMediaUrl(`//${HOST}/a.jpg`)).toBe(false);
    });
});

// Xoá file R2 không hoàn tác được, nên hàm này chỉ ra key khi CHẮC: đúng địa chỉ công khai của bucket và đúng thư mục do admin ghi.
describe("mediaKeysToDelete", () => {
    const LEGACY = "https://old.example.com";
    const BASES = [LEGACY, "https://media.example.com"];

    it("URL của các địa chỉ công khai được truyền vào đều ra key trong diary-images/ và diary-videos/", () => {
        expect(mediaKeysToDelete([
            `${LEGACY}/diary-images/a.jpg`,
            "https://media.example.com/diary-images/b.png",
            `${LEGACY}/diary-videos/c.mp4`,
        ], BASES)).toEqual(["diary-images/a.jpg", "diary-images/b.png", "diary-videos/c.mp4"]);
    });

    it("domain riêng có thêm đường dẫn: cắt đúng tiền tố đó ra để lấy key", () => {
        expect(mediaKeysToDelete(["https://cdn.example.com/media/diary-images/a.jpg"], ["https://cdn.example.com/media/"]))
            .toEqual(["diary-images/a.jpg"]);
        // cùng host nhưng ngoài đường dẫn tiền tố thì không phải file của mình
        expect(mediaKeysToDelete(["https://cdn.example.com/other/diary-images/a.jpg"], ["https://cdn.example.com/media"])).toEqual([]);
    });

    it("bỏ query và hash, giải mã ký tự %", () => {
        expect(mediaKeysToDelete([`${LEGACY}/diary-images/a%20b.jpg?v=2#x`], BASES)).toEqual(["diary-images/a b.jpg"]);
    });

    it("loại trùng, giữ thứ tự xuất hiện đầu tiên", () => {
        expect(mediaKeysToDelete([`${LEGACY}/diary-images/a.jpg`, `${LEGACY}/diary-images/b.jpg`, `${LEGACY}/diary-images/a.jpg`], BASES))
            .toEqual(["diary-images/a.jpg", "diary-images/b.jpg"]);
    });

    it.each([
        ["host lạ", "https://evil.example.com/diary-images/a.jpg"],
        ["host giống tên nhưng khác đuôi", `https://old.example.com.evil.com/diary-images/a.jpg`],
        ["host là tiền tố của host được phép", `${LEGACY}.vn/diary-images/a.jpg`],
        ["http thường", `http://old.example.com/diary-images/a.jpg`],
        ["thư mục lạ", `${LEGACY}/other/a.jpg`],
        ["file ngay gốc bucket", `${LEGACY}/a.jpg`],
        ["thư mục lồng nhau", `${LEGACY}/diary-images/sub/a.jpg`],
        ["đường dẫn đi lùi", `${LEGACY}/diary-images/../secret.txt`],
        ["tên file là ..", `${LEGACY}/diary-images/..`],
        ["dấu / mã hoá để lách thư mục lồng", `${LEGACY}/diary-images/a%2Fb.jpg`],
        ["thư mục trống", `${LEGACY}/diary-images/`],
        ["mã hoá hỏng", `${LEGACY}/diary-images/%E0%A4%A.jpg`],
        ["không phải URL", "diary-images/a.jpg"],
        ["chuỗi rỗng", ""],
    ])("bỏ qua: %s", (_, url) => {
        expect(mediaKeysToDelete([url], BASES)).toEqual([]);
    });

    it("một URL hỏng không làm mất các URL tốt bên cạnh", () => {
        expect(mediaKeysToDelete(["không phải url", `${LEGACY}/diary-images/ok.jpg`, "https://evil.example.com/diary-images/x.jpg"], BASES))
            .toEqual(["diary-images/ok.jpg"]);
    });

    it("địa chỉ cấu hình sai định dạng hoặc http bị bỏ qua thay vì làm hỏng", () => {
        expect(mediaKeysToDelete(["https://media.example.com/diary-images/a.jpg"], ["không phải url", "http://media.example.com"])).toEqual([]);
        expect(mediaKeysToDelete([`${LEGACY}/diary-images/a.jpg`], ["không phải url", LEGACY])).toEqual(["diary-images/a.jpg"]);
    });

    it("không có URL hoặc không có địa chỉ công khai thì không có gì để xoá", () => {
        expect(mediaKeysToDelete([], BASES)).toEqual([]);
        expect(mediaKeysToDelete([`${LEGACY}/diary-images/a.jpg`], [])).toEqual([]);
    });
});
