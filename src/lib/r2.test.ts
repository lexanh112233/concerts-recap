import {beforeEach, describe, expect, it, vi} from "vitest";

// Không ký thật và không gọi mạng: chỉ kiểm tra server đưa gì cho bộ ký
vi.mock("@aws-sdk/s3-request-presigner", () => ({getSignedUrl: vi.fn()}));

// S3Client giả (mọi lệnh đi qua `send`, không có gì ra mạng); các lớp lệnh thật vẫn dùng để xem đúng Bucket/Key được đưa vào
const send = vi.hoisted(() => vi.fn());
vi.mock("@aws-sdk/client-s3", async (importActual) => {
    const actual = await importActual<typeof import("@aws-sdk/client-s3")>();
    return {...actual, S3Client: class { send = send; }};
});

const {getSignedUrl} = await import("@aws-sdk/s3-request-presigner");
const {createPresignedUpload, deleteR2Objects, getR2Config, isR2Configured, mediaPublicBases} = await import("@/lib/r2");

const ENV = {
    R2_ACCOUNT_ID: "tai-khoan",
    R2_ACCESS_KEY_ID: "khoa-truy-cap",
    R2_SECRET_ACCESS_KEY: "khoa-bi-mat",
    R2_BUCKET: "my-bucket",
    R2_PUBLIC_URL: "https://media.example.com",
};

const configure = (extra: Record<string, string> = {}) => {
    for (const [key, value] of Object.entries({...ENV, ...extra})) vi.stubEnv(key, value);
};

beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({});
    vi.mocked(getSignedUrl).mockReset();
    vi.mocked(getSignedUrl).mockResolvedValue("https://ky-san.example/upload?sig=abc");
});

describe("getR2Config", () => {
    it("đủ năm biến thì trả cấu hình", () => {
        configure();
        expect(getR2Config()).toEqual({
            accountId: "tai-khoan",
            accessKeyId: "khoa-truy-cap",
            secretAccessKey: "khoa-bi-mat",
            bucket: "my-bucket",
            publicUrl: "https://media.example.com",
        });
        expect(isR2Configured()).toBe(true);
    });

    it.each(Object.keys(ENV))("thiếu %s thì coi như chưa cấu hình (vẫn sửa được chữ, chưa tải được file)", (missing) => {
        configure();
        vi.stubEnv(missing, "");
        expect(getR2Config()).toBeNull();
        expect(isR2Configured()).toBe(false);
    });

    // không còn địa chỉ mặc định nào ghi cứng: thiếu R2_PUBLIC_URL thì ảnh sẽ trỏ đi đâu? Không đâu cả, nên coi như chưa cấu hình
    it("R2_PUBLIC_URL là bắt buộc (không có địa chỉ công khai mặc định)", () => {
        configure({R2_PUBLIC_URL: ""});
        expect(getR2Config()).toBeNull();
        expect(isR2Configured()).toBe(false);
    });

    it("R2_PUBLIC_URL được dùng và bỏ dấu / ở cuối", () => {
        configure({R2_PUBLIC_URL: "https://media.example.com///"});
        expect(getR2Config()?.publicUrl).toBe("https://media.example.com");
    });
});

describe("createPresignedUpload", () => {
    it("chưa cấu hình R2 thì báo lỗi và không ký gì", async () => {
        for (const key of Object.keys(ENV)) vi.stubEnv(key, "");
        await expect(createPresignedUpload("image/jpeg", 1024)).rejects.toThrow("Chưa cấu hình Cloudflare R2 trong .env.");
        expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it("thông báo lỗi theo ngôn ngữ được truyền vào", async () => {
        for (const key of Object.keys(ENV)) vi.stubEnv(key, "");
        await expect(createPresignedUpload("image/jpeg", 1024, "en")).rejects.toThrow("Cloudflare R2 isn't configured in .env.");
        configure();
        await expect(createPresignedUpload("image/jpeg", 0, "en")).rejects.toThrow("The file is empty.");
        expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it.each([
        ["image/svg+xml", 1024, "Định dạng không được hỗ trợ"],
        ["image/heic", 1024, "Định dạng không được hỗ trợ"],
        ["application/x-msdownload", 1024, "Định dạng không được hỗ trợ"],
        ["image/jpeg", 0, "File rỗng."],
        ["image/jpeg", 25 * 1024 * 1024 + 1, "Ảnh quá lớn"],
        ["video/mp4", 60 * 1024 * 1024 + 1, "Video quá lớn"],
    ])("từ chối %s (%d byte) trước khi ký", async (type, size, message) => {
        configure();
        await expect(createPresignedUpload(type, size)).rejects.toThrow(message);
        expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it("trả URL đã ký, địa chỉ công khai và key sinh ngẫu nhiên ở phía server", async () => {
        configure();
        const result = await createPresignedUpload("image/jpeg", 2048);
        expect(result.uploadUrl).toBe("https://ky-san.example/upload?sig=abc");
        expect(result.key).toMatch(/^diary-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/);
        expect(result.publicUrl).toBe(`https://media.example.com/${result.key}`);
    });

    it("đưa cho bộ ký đúng bucket, key, content-type và hạn 10 phút", async () => {
        configure();
        const {key} = await createPresignedUpload("image/png", 2048);
        const [client, command, options] = vi.mocked(getSignedUrl).mock.calls[0] as unknown as [unknown, { input: unknown }, unknown];
        expect(client).toBeDefined();
        expect(command.input).toEqual({Bucket: "my-bucket", Key: key, ContentType: "image/png"});
        expect(options).toEqual({expiresIn: 600});
    });

    it("dùng địa chỉ công khai riêng khi có R2_PUBLIC_URL", async () => {
        configure({R2_PUBLIC_URL: "https://media.example.com/"});
        const {key, publicUrl} = await createPresignedUpload("video/mp4", 2048);
        expect(publicUrl).toBe(`https://media.example.com/${key}`);
    });

    it.each([
        ["image/jpeg", "jpg"],
        ["image/png", "png"],
        ["image/webp", "webp"],
        ["image/gif", "gif"],
        ["image/avif", "avif"],
        ["video/mp4", "mp4"],
        ["video/webm", "webm"],
        ["video/quicktime", "mov"],
    ])("%s lưu với đuôi .%s", async (type, ext) => {
        configure();
        const {key} = await createPresignedUpload(type, 2048);
        expect(key.endsWith(`.${ext}`)).toBe(true);
        expect(key.startsWith("diary-images/")).toBe(true);
    });

    it("mỗi lần một key khác nhau nên không thể ghi đè file đã có", async () => {
        configure();
        const keys = await Promise.all(Array.from({length: 20}, () => createPresignedUpload("image/jpeg", 2048).then((r) => r.key)));
        expect(new Set(keys).size).toBe(20);
    });
});

describe("mediaPublicBases", () => {
    it("chỉ có địa chỉ công khai của bucket đã cấu hình; chưa cấu hình thì không có địa chỉ nào", () => {
        for (const key of Object.keys(ENV)) vi.stubEnv(key, "");
        expect(mediaPublicBases()).toEqual([]);

        configure({R2_PUBLIC_URL: "https://media.example.com/"});
        expect(mediaPublicBases()).toEqual(["https://media.example.com"]);
    });
});

describe("deleteR2Objects", () => {
    const sent = () => send.mock.calls.map(([command]) => command.input);

    it("mỗi file một lệnh xoá, đúng bucket đang cấu hình và đúng key", async () => {
        configure();
        const result = await deleteR2Objects(["diary-images/a.jpg", "diary-videos/b.mp4"]);
        expect(result).toEqual({deleted: 2, failed: 0});
        expect(sent()).toEqual([
            {Bucket: "my-bucket", Key: "diary-images/a.jpg"},
            {Bucket: "my-bucket", Key: "diary-videos/b.mp4"},
        ]);
    });

    it("không có file nào thì không gọi gì, kể cả khi chưa cấu hình R2", async () => {
        for (const key of Object.keys(ENV)) vi.stubEnv(key, "");
        expect(await deleteR2Objects([])).toEqual({deleted: 0, failed: 0});
        expect(send).not.toHaveBeenCalled();
    });

    it("chưa cấu hình R2 thì không xoá gì và báo hết là còn lại (không throw)", async () => {
        for (const key of Object.keys(ENV)) vi.stubEnv(key, "");
        expect(await deleteR2Objects(["diary-images/a.jpg", "diary-images/b.jpg"])).toEqual({deleted: 0, failed: 2});
        expect(send).not.toHaveBeenCalled();
    });

    it("một file lỗi (vd. token chưa có quyền xoá) không chặn các file còn lại, và được đếm đúng", async () => {
        configure();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        send.mockImplementation(async (command) => {
            if (command.input.Key === "diary-images/b.jpg") throw Object.assign(new Error("Access Denied"), {name: "AccessDenied"});
            return {};
        });
        const result = await deleteR2Objects(["diary-images/a.jpg", "diary-images/b.jpg", "diary-images/c.jpg"]);
        expect(result).toEqual({deleted: 2, failed: 1});
        expect(send).toHaveBeenCalledTimes(3);
    });

    it("mọi file lỗi thì vẫn không throw; log chỉ có tên lỗi và số lượng, không có key hay khoá", async () => {
        configure();
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        send.mockRejectedValue(Object.assign(new Error("Access Denied for khoa-bi-mat"), {name: "AccessDenied"}));
        await expect(deleteR2Objects(["diary-images/a.jpg", "diary-images/b.jpg"])).resolves.toEqual({deleted: 0, failed: 2});
        const logged = log.mock.calls.flat().join(" ");
        expect(logged).toContain("2/2");
        expect(logged).toContain("AccessDenied");
        expect(logged).not.toContain("khoa-bi-mat");
        expect(logged).not.toContain("diary-images");
    });
});
