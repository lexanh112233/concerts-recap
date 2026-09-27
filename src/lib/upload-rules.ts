import type {Lang} from "@/i18n/config";
import {validationMessages} from "@/i18n/admin/validation";
import {format} from "@/i18n/format";

// Quy tắc tải lên dùng chung cho trình duyệt (kiểm tra sớm) và server (kiểm tra thật).
export const UPLOAD_TYPES: Record<string, { ext: string, kind: "image" | "video" }> = {
    "image/jpeg": {ext: "jpg", kind: "image"},
    "image/png": {ext: "png", kind: "image"},
    "image/webp": {ext: "webp", kind: "image"},
    "image/gif": {ext: "gif", kind: "image"},
    "image/avif": {ext: "avif", kind: "image"},
    "video/mp4": {ext: "mp4", kind: "video"},
    "video/webm": {ext: "webm", kind: "video"},
    "video/quicktime": {ext: "mov", kind: "video"},
};

// Ảnh HEIC/HEIF (iPhone): trình duyệt trừ Safari không hiển thị được, và server không giải mã được HEVC, nên ảnh được
// đổi sang JPEG ngay trên trình duyệt trước khi tải lên (xem lib/heic.ts). Vì vậy HEIC không nằm trong UPLOAD_TYPES:
// R2 chỉ bao giờ nhận JPEG.
export const HEIC_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];
const HEIC_EXT = /\.(heic|heif|hif)$/i;

// Nhận ra HEIC theo MIME hoặc đuôi file (một số trình duyệt để type rỗng với HEIC)
export const looksLikeHeic = (name: string, type: string) => HEIC_TYPES.includes(type.toLowerCase()) || HEIC_EXT.test(name);

export const MAX_BYTES = {
    image: 25 * 1024 * 1024,
    video: 60 * 1024 * 1024,
};

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

// Nhãn hiển thị cho người dùng, tính từ hằng số nên không bao giờ lệch với giới hạn thật
export const MAX_LABEL = {
    image: `${mb(MAX_BYTES.image)}MB`,
    video: `${mb(MAX_BYTES.video)}MB`,
};

// Gợi ý cho hộp chọn file: thêm HEIC (cả MIME lẫn đuôi vì hộp chọn file trên máy tính lọc theo đuôi)
export const UPLOAD_ACCEPT = [...Object.keys(UPLOAD_TYPES), ...HEIC_TYPES.slice(0, 2), ".heic", ".heif"].join(",");

// Trả về thông báo lỗi theo ngôn ngữ (mặc định tiếng Việt), hoặc null nếu hợp lệ.
export function validateUpload(type: string, size: number, lang: Lang = "vi"): string | null {
    const m = validationMessages(lang).upload;
    const spec = UPLOAD_TYPES[type];
    if (!spec) return m.unsupported;
    if (size <= 0) return m.empty;
    if (size > MAX_BYTES[spec.kind]) {
        return format(m.tooBig, {kind: spec.kind === "image" ? m.image : m.video, max: MAX_LABEL[spec.kind]});
    }
    return null;
}

// File HEIC gốc chỉ cần kiểm tra dung lượng (kiểu file được đổi sang JPEG rồi mới qua validateUpload lần nữa)
export function validateHeic(size: number, lang: Lang = "vi"): string | null {
    const m = validationMessages(lang).upload;
    if (size <= 0) return m.empty;
    if (size > MAX_BYTES.image) return format(m.tooBig, {kind: m.image, max: MAX_LABEL.image});
    return null;
}
