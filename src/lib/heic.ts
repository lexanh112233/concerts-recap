import {looksLikeHeic} from "@/lib/upload-rules";

// Chỉ chạy ở trình duyệt. Chuyển ảnh HEIC/HEIF (iPhone) sang JPEG trước khi tải lên R2: xem ghi chú ở lib/upload-rules.ts.

// Nhãn "brand" của HEIC trong hộp ftyp (đầu file). "mif1"/"msf1" đứng riêng thì không kết luận được vì AVIF cũng dùng.
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);

// Đuôi/MIME có thể bị đổi (vd. IMG_1234.JPG thực ra là HEIC), nên ngoài đuôi và MIME còn đọc vài chục byte đầu file để tìm hộp ftyp.
export async function isHeicFile(file: File): Promise<boolean> {
    if (looksLikeHeic(file.name, file.type)) return true;
    if (file.type && !file.type.startsWith("image/")) return false;
    try {
        const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
        const text = (from: number) => String.fromCharCode(...head.slice(from, from + 4));
        if (head.length < 16 || text(4) !== "ftyp") return false;
        // ftyp: 4 byte kích thước hộp, "ftyp", brand chính, 4 byte phiên bản, rồi các brand tương thích (chỉ đọc trong hộp này)
        const end = Math.min(head.length, new DataView(head.buffer).getUint32(0));
        for (let at = 8; at + 4 <= end; at += at === 8 ? 8 : 4) {
            if (HEIC_BRANDS.has(text(at))) return true;
        }
        return false;
    } catch {
        return false;
    }
}

export class HeicError extends Error {
    constructor() {
        super("HEIC conversion failed");
        this.name = "HeicError";
    }
}

// Đổi HEIC sang JPEG chất lượng cao (giữ nguyên độ phân giải; hướng xoay đã được áp dụng). Thư viện WASM nặng vài MB nên chỉ
// tải khi thật sự có file HEIC.
export async function heicToJpeg(file: File): Promise<File> {
    let blob: Blob;
    try {
        // bản "csp" của heic-to không dùng eval/new Function nên chạy được dưới Content-Security-Policy không có 'unsafe-eval'
        // (bản mặc định thì bị chặn); cùng API, chỉ khác cách dựng.
        const {heicTo} = await import("heic-to/csp");
        blob = await heicTo({blob: file, type: "image/jpeg", quality: 0.92});
    } catch {
        // chỗ gọi (media-uploader) tự hiện thông báo theo ngôn ngữ giao diện; ở đây chỉ cần một lỗi có tên để bắt
        throw new HeicError();
    }
    const base = file.name.replace(/\.[^./\\]+$/, "") || "anh";
    return new File([blob], `${base}.jpg`, {type: "image/jpeg", lastModified: file.lastModified});
}
