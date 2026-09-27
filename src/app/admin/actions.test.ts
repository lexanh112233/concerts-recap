import {beforeEach, describe, expect, it, vi} from "vitest";

// Mọi thứ ngoài server action đều giả: đăng nhập, MongoDB, R2, cache của Next. Redirect ném lỗi như Next thật (NEXT_REDIRECT) để dừng luồng chạy.
const mocks = vi.hoisted(() => ({
    assertAdmin: vi.fn(),
    checkPassword: vi.fn(),
    isAdminConfigured: vi.fn(),
    startAdminSession: vi.fn(),
    endAdminSession: vi.fn(),
    attemptGet: vi.fn(),
    attemptFail: vi.fn(),
    attemptClear: vi.fn(),
    requestHeaders: vi.fn(),
    findOneAndDelete: vi.fn(),
    find: vi.fn(),
    deleteR2Objects: vi.fn(),
    revalidatePath: vi.fn(),
    connect: vi.fn(),
}));

// "server-only" là gói Next chặn import từ client; ngoài Next (Vitest) không có nên thay bằng rỗng
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({revalidatePath: mocks.revalidatePath}));
vi.mock("next/headers", () => ({headers: async () => mocks.requestHeaders()}));
vi.mock("@/lib/login-attempts-store", () => ({
    mongoAttemptStore: {get: mocks.attemptGet, fail: mocks.attemptFail, clear: mocks.attemptClear},
}));
vi.mock("next/navigation", () => ({
    redirect: (url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    },
}));
vi.mock("@/lib/db", () => ({default: mocks.connect}));
vi.mock("@/models/diaries", () => ({default: {findOneAndDelete: mocks.findOneAndDelete, find: mocks.find}}));
vi.mock("@/lib/admin-auth", () => ({
    assertAdmin: mocks.assertAdmin,
    checkPassword: mocks.checkPassword,
    endAdminSession: mocks.endAdminSession,
    isAdminConfigured: mocks.isAdminConfigured,
    startAdminSession: mocks.startAdminSession,
}));
vi.mock("@/lib/r2", () => ({
    createPresignedUpload: vi.fn(),
    deleteR2Objects: mocks.deleteR2Objects,
    mediaPublicBases: () => ["https://old.example.com", "https://media.example.com"],
}));

const {deleteEventAction, loginAction} = await import("@/app/admin/actions");

const LEGACY = "https://old.example.com";
const NOW = new Date("2026-09-26T03:00:00.000Z");

const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) fd.set(key, value);
    return fd;
};

const run = (fields: Record<string, string>) => deleteEventAction({}, form(fields));
const redirectedTo = async (fields: Record<string, string>) => {
    try {
        await run(fields);
    } catch (error) {
        const message = (error as Error).message;
        if (message.startsWith("NEXT_REDIRECT:")) return message.slice("NEXT_REDIRECT:".length);
        throw error;
    }
    throw new Error("không redirect");
};

// mongoose: findOneAndDelete(...).lean() và find(...).select(...).lean()
const removes = (doc: unknown) => mocks.findOneAndDelete.mockReturnValue({lean: () => Promise.resolve(doc)});
const othersUse = (docs: Array<{ images?: string[] }>) => mocks.find.mockReturnValue({select: () => ({lean: () => Promise.resolve(docs)})});

beforeEach(() => {
    vi.useFakeTimers({toFake: ["Date"]});
    vi.setSystemTime(NOW);
    for (const fn of Object.values(mocks)) fn.mockReset();
    mocks.assertAdmin.mockResolvedValue(undefined);
    mocks.connect.mockResolvedValue(undefined);
    mocks.deleteR2Objects.mockImplementation(async () => ({deleted: 0, failed: 0}));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    removes({images: []});
    othersUse([]);
});

describe("deleteEventAction", () => {
    it("chưa đăng nhập thì bị chặn và KHÔNG xoá gì (bản ghi lẫn file R2)", async () => {
        mocks.assertAdmin.mockRejectedValue(new Error("Chưa đăng nhập quản trị."));
        await expect(run({slug: "dem-1"})).rejects.toThrow("Chưa đăng nhập quản trị.");
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
        expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("xoá đúng bản ghi theo slug rồi về /admin kèm mốc thời gian của lần xoá", async () => {
        removes({images: []});
        expect(await redirectedTo({slug: "dem-1"})).toBe(`/admin?deleted=${NOW.getTime()}`);
        expect(mocks.findOneAndDelete).toHaveBeenCalledExactlyOnceWith({slug: "dem-1"});
    });

    it("bản tiếng Anh về /en/admin", async () => {
        expect(await redirectedTo({slug: "dem-1", lang: "en"})).toBe(`/en/admin?deleted=${NOW.getTime()}`);
    });

    it("ngôn ngữ lạ thì rơi về tiếng Việt", async () => {
        expect(await redirectedTo({slug: "dem-1", lang: "fr"})).toBe(`/admin?deleted=${NOW.getTime()}`);
    });

    it("không có slug thì báo lỗi và không đụng vào DB", async () => {
        expect(await run({slug: ""})).toEqual({error: "Chưa xoá được, thử lại nhé."});
        expect(await run({})).toEqual({error: "Chưa xoá được, thử lại nhé."});
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("lỗi thông báo theo ngôn ngữ", async () => {
        expect(await run({slug: "", lang: "en"})).toEqual({error: "Couldn't delete it, try again."});
    });

    it("DB lỗi thì trả lỗi, KHÔNG xoá file R2, không làm mới cache và không chuyển trang", async () => {
        mocks.findOneAndDelete.mockReturnValue({lean: () => Promise.reject(new Error("mất kết nối"))});
        expect(await run({slug: "dem-1"})).toEqual({error: "Chưa xoá được, thử lại nhé."});
        expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("không kết nối được DB cũng chỉ là lỗi trả về, không phải sự cố", async () => {
        mocks.connect.mockRejectedValue(new Error("không kết nối được"));
        expect(await run({slug: "dem-1"})).toEqual({error: "Chưa xoá được, thử lại nhé."});
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
    });

    it("sự kiện đã bị xoá từ trước (bấm hai lần) thì vẫn êm: về /admin, không có file nào để xoá", async () => {
        removes(null);
        expect(await redirectedTo({slug: "dem-1"})).toBe(`/admin?deleted=${NOW.getTime()}`);
        expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).toHaveBeenCalled();
    });

    it("làm mới cả hai cây công khai (kèm tên nhóm route) và cả hai trang admin", async () => {
        await redirectedTo({slug: "dem-1"});
        const calls = mocks.revalidatePath.mock.calls;
        expect(calls).toContainEqual(["/"]);
        expect(calls).toContainEqual(["/en"]);
        expect(calls).toContainEqual(["/admin"]);
        expect(calls).toContainEqual(["/en/admin"]);
        expect(calls).toContainEqual(["/(vi)/concerts/[slug]", "page"]);
        expect(calls).toContainEqual(["/en/(site)/concerts/[slug]", "page"]);
    });

    describe("file ảnh/video trên R2", () => {
        it("xoá đúng các key của sự kiện (bucket cũ và R2_PUBLIC_URL), đủ thì không có dòng 'còn lại'", async () => {
            removes({images: [`${LEGACY}/diary-images/a.jpg`, "https://media.example.com/diary-images/b.png", `${LEGACY}/diary-videos/c.mp4`]});
            expect(await redirectedTo({slug: "dem-1"})).toBe(`/admin?deleted=${NOW.getTime()}`);
            expect(mocks.deleteR2Objects).toHaveBeenCalledExactlyOnceWith(["diary-images/a.jpg", "diary-images/b.png", "diary-videos/c.mp4"]);
        });

        it("bản ghi xoá xong rồi mới đụng tới R2 (DB lỗi thì không mất ảnh)", async () => {
            const order: string[] = [];
            mocks.findOneAndDelete.mockImplementation(() => ({lean: async () => (order.push("db"), {images: [`${LEGACY}/diary-images/a.jpg`]})}));
            mocks.deleteR2Objects.mockImplementation(async () => (order.push("r2"), {deleted: 1, failed: 0}));
            await redirectedTo({slug: "dem-1"});
            expect(order).toEqual(["db", "r2"]);
        });

        it("chỉ xoá file chắc là của mình: host lạ, thư mục lạ, http đều bị bỏ qua", async () => {
            removes({images: [
                "https://evil.example.com/diary-images/x.jpg",
                `${LEGACY}/other/y.jpg`,
                `http://old.example.com/diary-images/z.jpg`,
                `${LEGACY}/diary-images/../secret.txt`,
                `${LEGACY}/diary-images/ok.jpg`,
            ]});
            await redirectedTo({slug: "dem-1"});
            expect(mocks.deleteR2Objects).toHaveBeenCalledExactlyOnceWith(["diary-images/ok.jpg"]);
        });

        it("file còn được sự kiện khác dùng thì giữ lại", async () => {
            removes({images: [`${LEGACY}/diary-images/mine.jpg`, `${LEGACY}/diary-images/shared.jpg`]});
            othersUse([{images: [`${LEGACY}/diary-images/shared.jpg`, `${LEGACY}/diary-images/other.jpg`]}]);
            await redirectedTo({slug: "dem-1"});
            expect(mocks.deleteR2Objects).toHaveBeenCalledExactlyOnceWith(["diary-images/mine.jpg"]);
            // hỏi DB đúng các URL của sự kiện vừa xoá
            expect(mocks.find).toHaveBeenCalledExactlyOnceWith({images: {$in: [`${LEGACY}/diary-images/mine.jpg`, `${LEGACY}/diary-images/shared.jpg`]}});
        });

        it("cùng một URL ghi hai lần trong sự kiện chỉ xoá một lần", async () => {
            removes({images: [`${LEGACY}/diary-images/a.jpg`, `${LEGACY}/diary-images/a.jpg`]});
            await redirectedTo({slug: "dem-1"});
            expect(mocks.deleteR2Objects).toHaveBeenCalledExactlyOnceWith(["diary-images/a.jpg"]);
        });

        it("R2 xoá hụt (vd. token chưa có quyền xoá) thì vẫn xoá xong sự kiện nhưng báo số file còn lại", async () => {
            removes({images: [`${LEGACY}/diary-images/a.jpg`, `${LEGACY}/diary-images/b.jpg`]});
            mocks.deleteR2Objects.mockResolvedValue({deleted: 0, failed: 2});
            expect(await redirectedTo({slug: "dem-1"})).toBe(`/admin?deleted=${NOW.getTime()}&leftover=2`);
            expect(mocks.revalidatePath).toHaveBeenCalled();
        });

        it("báo còn lại cũng đúng ở bản tiếng Anh", async () => {
            removes({images: [`${LEGACY}/diary-images/a.jpg`]});
            mocks.deleteR2Objects.mockResolvedValue({deleted: 0, failed: 1});
            expect(await redirectedTo({slug: "dem-1", lang: "en"})).toBe(`/en/admin?deleted=${NOW.getTime()}&leftover=1`);
        });

        it("không kiểm tra được file có dùng chung không thì KHÔNG dám xoá file nào, và báo còn lại", async () => {
            removes({images: [`${LEGACY}/diary-images/a.jpg`, `${LEGACY}/diary-images/b.jpg`, "https://evil.example.com/diary-images/x.jpg"]});
            mocks.find.mockReturnValue({select: () => ({lean: () => Promise.reject(new Error("mất kết nối"))})});
            expect(await redirectedTo({slug: "dem-1"})).toBe(`/admin?deleted=${NOW.getTime()}&leftover=2`);
            expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
        });

        it("sự kiện không có ảnh/video thì không hỏi DB dùng chung và không đụng R2", async () => {
            removes({images: []});
            await redirectedTo({slug: "dem-1"});
            expect(mocks.find).not.toHaveBeenCalled();
            expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
        });

        it("bản ghi cũ không có trường images thì coi như không có file", async () => {
            removes({});
            expect(await redirectedTo({slug: "dem-1"})).toBe(`/admin?deleted=${NOW.getTime()}`);
            expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
        });
    });
});

// ---------- đăng nhập: giới hạn số lần sai ----------
describe("loginAction", () => {
    const IP = "203.0.113.7";
    const WINDOW_MS = 15 * 60 * 1000;
    const login = (fields: Record<string, string> = {password: "dung"}) => loginAction({}, form(fields));
    // mỗi lần sai bị làm chậm 0,6 giây bằng setTimeout: chạy đồng hồ giả cho nhanh
    const run = async (fields?: Record<string, string>) => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        const pending = login(fields);
        await vi.advanceTimersByTimeAsync(600);
        return pending;
    };
    const live = (count: number, expiresInMs = WINDOW_MS) => ({count, expiresAt: new Date(NOW.getTime() + expiresInMs)});

    beforeEach(() => {
        mocks.isAdminConfigured.mockReturnValue(true);
        mocks.checkPassword.mockImplementation((value: string) => value === "dung");
        mocks.startAdminSession.mockResolvedValue(undefined);
        mocks.requestHeaders.mockReturnValue(new Headers({"x-forwarded-for": `${IP}, 10.0.0.1`}));
        mocks.attemptGet.mockResolvedValue(null);
        mocks.attemptFail.mockResolvedValue(live(1));
        mocks.attemptClear.mockResolvedValue(undefined);
    });

    it("chưa đặt ADMIN_PASSWORD thì báo trang quản trị đang tắt và không đụng vào bộ đếm", async () => {
        mocks.isAdminConfigured.mockReturnValue(false);
        expect(await login()).toEqual({error: "Chưa đặt ADMIN_PASSWORD trong .env nên trang quản trị đang tắt."});
        expect(mocks.attemptGet).not.toHaveBeenCalled();
        expect(mocks.startAdminSession).not.toHaveBeenCalled();
    });

    it("đúng mật khẩu: xoá bộ đếm của IP đó rồi mở phiên", async () => {
        expect(await login()).toEqual({ok: true});
        expect(mocks.startAdminSession).toHaveBeenCalledOnce();
        expect(mocks.attemptClear).toHaveBeenCalledOnce();
        expect(mocks.attemptFail).not.toHaveBeenCalled();
    });

    it("bộ đếm dùng khoá BĂM của IP đầu tiên trong x-forwarded-for, không phải IP thô", async () => {
        await login();
        const key = mocks.attemptGet.mock.calls[0][0] as string;
        expect(key).toMatch(/^[0-9a-f]{64}$/);
        expect(key).not.toContain(IP);
        expect(mocks.attemptClear).toHaveBeenCalledWith(key);
    });

    it("sai mật khẩu: báo sai, ghi nhận một lần sai cho IP đó và KHÔNG mở phiên", async () => {
        expect(await run({password: "sai"})).toEqual({error: "Mật khẩu không đúng."});
        expect(mocks.attemptFail).toHaveBeenCalledExactlyOnceWith(mocks.attemptGet.mock.calls[0][0], NOW);
        expect(mocks.startAdminSession).not.toHaveBeenCalled();
        expect(mocks.attemptClear).not.toHaveBeenCalled();
    });

    it("sai mật khẩu vẫn bị làm chậm 0,6 giây", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        let done = false;
        const pending = login({password: "sai"}).then(() => (done = true));
        await vi.advanceTimersByTimeAsync(599);
        expect(done).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await pending;
        expect(done).toBe(true);
    });

    it("đã sai đủ 10 lần trong cửa sổ thì bị khoá: không so mật khẩu nữa, kể cả nhập đúng", async () => {
        mocks.attemptGet.mockResolvedValue(live(10, 4 * 60_000));
        expect(await login({password: "dung"})).toEqual({error: "Sai quá nhiều lần rồi. Thử lại sau 4 phút nhé."});
        expect(mocks.checkPassword).not.toHaveBeenCalled();
        expect(mocks.startAdminSession).not.toHaveBeenCalled();
        expect(mocks.attemptFail).not.toHaveBeenCalled();
        expect(mocks.attemptClear).not.toHaveBeenCalled();
    });

    it("thông báo khoá theo ngôn ngữ", async () => {
        mocks.attemptGet.mockResolvedValue(live(12, WINDOW_MS));
        expect(await login({password: "dung", lang: "en"})).toEqual({error: "Too many wrong tries. Please try again in 15 min."});
    });

    it("mới sai 9 lần thì chưa khoá: nhập đúng vẫn vào được", async () => {
        mocks.attemptGet.mockResolvedValue(live(9));
        expect(await login()).toEqual({ok: true});
    });

    it("cửa sổ đã hết hạn (bản ghi cũ chưa bị dọn) thì không khoá nữa", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        mocks.attemptGet.mockResolvedValue({count: 10, expiresAt: new Date(NOW.getTime() - 1)});
        expect(await login()).toEqual({ok: true});
    });

    describe("bộ đếm lỗi thì cho qua (không chặn admin), chỉ ghi log tên lỗi", () => {
        it("không đọc được bộ đếm: đúng mật khẩu vẫn vào, sai vẫn bị báo sai", async () => {
            mocks.attemptGet.mockRejectedValue(new Error("mất kết nối"));
            expect(await login()).toEqual({ok: true});
            expect(await run({password: "sai"})).toEqual({error: "Mật khẩu không đúng."});
        });

        it("không ghi được lần sai: vẫn báo sai bình thường", async () => {
            mocks.attemptFail.mockRejectedValue(new Error("mất kết nối"));
            expect(await run({password: "sai"})).toEqual({error: "Mật khẩu không đúng."});
        });

        it("không xoá được bộ đếm khi đăng nhập đúng: vẫn mở phiên", async () => {
            mocks.attemptClear.mockRejectedValue(new Error("mất kết nối"));
            expect(await login()).toEqual({ok: true});
            expect(mocks.startAdminSession).toHaveBeenCalledOnce();
        });

        it("log chỉ có tên lỗi, không có nội dung lỗi (có thể chứa địa chỉ DB)", async () => {
            const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
            mocks.attemptGet.mockRejectedValue(Object.assign(new Error("mongodb://user:secret@host"), {name: "MongoNetworkError"}));
            await login();
            const logged = log.mock.calls.flat().join(" ");
            expect(logged).toContain("MongoNetworkError");
            expect(logged).not.toContain("secret");
        });
    });
});
