"use server";

import {revalidatePath} from "next/cache";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import connectToDatabase from "@/lib/db";
import diaryEntries from "@/models/diaries";
import {assertAdmin, checkPassword, endAdminSession, isAdminConfigured, startAdminSession} from "@/lib/admin-auth";
import {DEFAULT_LANG, isLang, pathFor, type Lang} from "@/i18n/config";
import {getAdminDict} from "@/i18n/admin/server";
import {validationMessages} from "@/i18n/admin/validation";
import {parseEventForm, toDoc, type EventFormValues, type FieldErrors} from "@/lib/event-input";
import {deleteR2Objects, createPresignedUpload, mediaPublicBases} from "@/lib/r2";
import {mediaKeysToDelete} from "@/lib/media-hosts";
import {slugify} from "@/lib/slug";
import {clientKey, isLockedOut, retryMinutes, type AttemptRecord} from "@/lib/login-throttle";
import {mongoAttemptStore} from "@/lib/login-attempts-store";
import {format} from "@/i18n/format";

export interface LoginState {
    error?: string
    // đăng nhập đúng. Không redirect: trang /admin đang mở chính là cuốn sổ khoá, sau khi action ghi cookie Next dựng lại trang đó (giờ là danh sách thật)
    // và gửi kèm phản hồi, nên sổ mở ra ngay tại chỗ với đủ nội dung
    ok?: boolean
}

// Ngôn ngữ của trang gọi action (/admin là vi, /en/admin là en) do form gửi kèm trong trường ẩn "lang": action không có đường dẫn để tự đoán.
// Chỉ dùng để chọn thông báo và địa chỉ chuyển hướng nên tin dữ liệu từ client là đủ (giá trị lạ thì rơi về tiếng Việt).
const langOf = (formData: FormData): Lang => {
    const value = formData.get("lang");
    return isLang(value) ? value : DEFAULT_LANG;
};

// Kho đếm lần sai lỗi thì CHO QUA (và ghi log) thay vì chặn: DB sập thì admin cũng chẳng làm được gì, và người ngoài không tự gây được lỗi DB.
async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
    try {
        return await run();
    } catch (error) {
        console.error("Không đọc/ghi được bộ đếm đăng nhập sai:", error instanceof Error ? error.name : error);
        return null;
    }
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
    const lang = langOf(formData);
    const t = getAdminDict(lang).login;
    if (!isAdminConfigured()) return {error: t.notConfigured};

    // Giới hạn số lần sai theo IP (xem lib/login-throttle.ts). Đang bị khoá thì không so mật khẩu nữa, dù nhập đúng.
    const key = clientKey(await headers());
    const now = new Date();
    const before: AttemptRecord | null = await attempt(() => mongoAttemptStore.get(key));
    if (before && isLockedOut(before, now)) return {error: format(t.tooMany, {minutes: retryMinutes(before, now)})};

    if (!checkPassword(String(formData.get("password") ?? ""))) {
        // làm chậm thêm một lớp nữa (cùng với giới hạn số lần) để khó dò mật khẩu hàng loạt
        await new Promise((resolve) => setTimeout(resolve, 600));
        await attempt(() => mongoAttemptStore.fail(key, now));
        return {error: t.wrong};
    }

    await attempt(() => mongoAttemptStore.clear(key));
    await startAdminSession();
    return {ok: true};
}

export async function logoutAction(formData: FormData) {
    await endAdminSession();
    redirect(pathFor(langOf(formData), "/admin"));
}

export type UploadUrlResult =
    | { ok: true, uploadUrl: string, publicUrl: string }
    | { ok: false, error: string };

// Trình duyệt xin URL đã ký rồi tự PUT file thẳng lên R2.
export async function createUploadUrl(input: { contentType: string, size: number, lang: Lang }): Promise<UploadUrlResult> {
    await assertAdmin();
    const lang = isLang(input.lang) ? input.lang : DEFAULT_LANG;
    try {
        const {uploadUrl, publicUrl} = await createPresignedUpload(String(input.contentType), Number(input.size), lang);
        return {ok: true, uploadUrl, publicUrl};
    } catch (error) {
        return {ok: false, error: error instanceof Error ? error.message : validationMessages(lang).r2.urlFailed};
    }
}

export interface SaveState {
    errors?: FieldErrors
    values?: EventFormValues
}

// Trang chi tiết được cache và mỗi trang phụ thuộc cả các đêm khác (số vé, đêm trước/sau, "lần thứ mấy xem nghệ sĩ này"),
// nên thêm/sửa/ẩn một đêm phải làm mới mọi trang chi tiết chứ không riêng trang của đêm đó.
// Có HAI cây route công khai (app/(vi) ở "/" và app/en ở "/en"); quên một cây thì trang cũ không báo lỗi, chỉ lặng lẽ không cập nhật.
// Thẻ cache của route động GỒM tên nhóm route: trang chi tiết tiếng Việt mang thẻ "/(vi)/concerts/[slug]/page", nên viết "/concerts/[slug]"
// (không có "(vi)") sẽ không trúng gì; bản tiếng Anh cũng vậy: "/en/(site)/concerts/[slug]". "/" và "/en" là đường dẫn cụ thể nên không bị ảnh hưởng, rất dễ bỏ sót.
function revalidateSite() {
    revalidatePath("/");
    revalidatePath("/en");
    revalidatePath("/admin");
    revalidatePath("/en/admin");
    revalidatePath("/(vi)/concerts/[slug]", "page");
    revalidatePath("/en/(site)/concerts/[slug]", "page");
}

async function uniqueSlug(title: string) {
    const base = slugify(title);
    let slug = base;
    for (let n = 2; await diaryEntries.exists({slug}); n++) slug = `${base}-${n}`;
    return slug;
}

export async function saveEventAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
    await assertAdmin();

    const lang = langOf(formData);
    const m = validationMessages(lang);
    const originalSlug = String(formData.get("originalSlug") ?? "");
    const {values, errors} = parseEventForm(formData, lang);
    if (Object.keys(errors).length > 0) return {errors, values};

    let slug = originalSlug;
    try {
        await connectToDatabase();
        if (originalSlug) {
            const updated = await diaryEntries.findOneAndUpdate(
                {slug: originalSlug},
                {$set: toDoc(values)},
                {runValidators: true},
            );
            if (!updated) return {errors: {form: m.form.notFound}, values};
        } else {
            slug = await uniqueSlug(values.title);
            await diaryEntries.create({...toDoc(values), slug});
        }
    } catch (error) {
        console.error("Không lưu được sự kiện:", error);
        return {errors: {form: m.form.database}, values};
    }

    revalidateSite();
    // ?saved=slug: sổ quản trị tự mở tới đúng trang chứa đêm vừa lưu, nháy dòng đó và hiện giấy nhớ "Lưu rồi nha!"
    redirect(pathFor(lang, `/admin?saved=${encodeURIComponent(slug)}`));
}

export interface DeleteState {
    error?: string
}

// Xoá file media của một sự kiện vừa bị xoá khỏi DB. Không bao giờ throw; trả số file CÒN LẠI trên R2 (không xoá được).
// Chỉ xoá file chắc chắn là của mình: key hợp lệ (xem mediaKeysToDelete) và không còn sự kiện nào khác trỏ tới.
async function removeEventMedia(images: string[]): Promise<number> {
    const urls = [...new Set(images)];
    if (urls.length === 0) return 0;

    let free = urls;
    try {
        // đã xoá bản ghi này nên mọi bản ghi còn lại trỏ tới một URL là dùng chung: giữ file đó lại
        const others = (await diaryEntries.find({images: {$in: urls}}).select("images").lean()) as unknown as Array<{ images?: string[] }>;
        const used = new Set(others.flatMap((doc) => doc.images ?? []));
        free = urls.filter((url) => !used.has(url));
    } catch (error) {
        // không kiểm tra được thì không dám xoá file nào: giữ hết và báo còn lại
        console.error("Không kiểm tra được file media có dùng chung không:", error);
        return mediaKeysToDelete(urls, mediaPublicBases()).length;
    }

    const {failed} = await deleteR2Objects(mediaKeysToDelete(free, mediaPublicBases()));
    return failed;
}

// Xoá hẳn một sự kiện (bản ghi MongoDB rồi file ảnh/video của nó trên R2). Nút xoá luôn nằm sau hộp thoại xác nhận, nhưng action
// vẫn tự kiểm tra đăng nhập như mọi action khác. Xong thì về /admin kèm giấy nhớ "đã xoá" (?deleted=<mốc thời gian>, và ?leftover=N khi còn file R2 chưa xoá được).
export async function deleteEventAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
    await assertAdmin();

    const lang = langOf(formData);
    const t = getAdminDict(lang).delete;
    const slug = String(formData.get("slug") ?? "");
    if (!slug) return {error: t.failed};

    let images: string[] = [];
    try {
        await connectToDatabase();
        // xoá và lấy luôn danh sách file trong một bước; đã bị xoá từ trước (vd. bấm hai lần) thì `null`, coi như xong
        const removed = (await diaryEntries.findOneAndDelete({slug}).lean()) as unknown as { images?: string[] } | null;
        images = removed?.images ?? [];
    } catch (error) {
        console.error("Không xoá được sự kiện:", error);
        return {error: t.failed};
    }

    // DB xong rồi mới đụng R2: ngược lại, DB lỗi giữa chừng sẽ để lại một sự kiện còn đó mà mất ảnh
    const leftover = await removeEventMedia(images);

    revalidateSite();
    redirect(pathFor(lang, `/admin?deleted=${Date.now()}${leftover > 0 ? `&leftover=${leftover}` : ""}`));
}

// Ẩn/hiện một sự kiện (không xoá dữ liệu).
export async function toggleActiveAction(formData: FormData) {
    await assertAdmin();
    const slug = String(formData.get("slug") ?? "");
    const active = formData.get("active") === "true";
    if (!slug) return;

    await connectToDatabase();
    await diaryEntries.updateOne({slug}, {$set: {active}});

    revalidateSite();
}
