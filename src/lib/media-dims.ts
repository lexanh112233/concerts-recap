import {imageSize} from "image-size";
import {isAllowedMediaUrl} from "@/lib/media-hosts";
import type {IMedia} from "@/lib/concerts";

// Chỉ dùng ở server. Đo tỉ lệ (rộng/cao khi hiển thị) của ảnh/video để khung được dựng đúng hình dạng ngay từ đầu:
// không phải crop về một tỉ lệ chung và không giật khi ảnh tải xong. Chỉ đọc vài KB đầu mỗi file bằng Range request.
// Kết quả được nhớ trong bộ nhớ vì URL media không đổi (khóa là uuid); lỗi chỉ nhớ ngắn để lần sau thử lại.

const IMAGE_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 4000;
// tổng thời gian chờ cho cả trang: quá hạn thì trang vẫn hiển thị với tỉ lệ mặc định, không bị R2 chậm kéo theo
const TOTAL_BUDGET_MS = 3000;
const FAILURE_TTL_MS = 60_000;

const cache = new Map<string, { ratio: number | null, at: number }>();

async function fetchRange(url: string, start: number, length: number): Promise<Uint8Array | null> {
    // Không đặt cache: "no-store": tùy chọn đó buộc cả trang gọi hàm này chuyển sang render động (mất SSG/ISR dù đã có revalidate).
    // Mặc định ("auto no cache") không lưu gì vào Data Cache mà vẫn cho dựng tĩnh lúc build.
    const res = await fetch(url, {
        headers: {Range: `bytes=${start}-${start + length - 1}`},
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // 200 nghĩa là server bỏ qua Range; chỉ dùng được khi cần đúng phần đầu file
    if (res.status !== 206 && !(res.status === 200 && start === 0)) {
        await res.body?.cancel();
        return null;
    }
    const reader = res.body?.getReader();
    if (!reader) return null;

    const out = new Uint8Array(length);
    let got = 0;
    while (got < length) {
        const {done, value} = await reader.read();
        if (done) break;
        const take = Math.min(value.length, length - got);
        out.set(value.subarray(0, take), got);
        got += take;
    }
    // không tải nốt phần còn lại của file
    await reader.cancel().catch(() => undefined);
    return out.subarray(0, got);
}

async function probeImage(url: string): Promise<number | null> {
    const head = await fetchRange(url, 0, IMAGE_BYTES);
    if (!head) return null;
    const {width, height, orientation} = imageSize(head);
    if (!width || !height) return null;
    // EXIF 5–8 là ảnh chụp xoay ngang: trình duyệt hiển thị đã xoay nên đổi chiều
    return orientation && orientation >= 5 ? height / width : width / height;
}

// Đọc kích thước hiển thị từ hộp "tkhd" (track header) nằm ở đầu buffer. Trả null với track không phải hình (kích thước 0).
function tkhdRatio(buf: Uint8Array): number | null {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    for (let i = 4; i + 4 <= buf.length; i++) {
        if (buf[i] !== 0x74 || buf[i + 1] !== 0x6b || buf[i + 2] !== 0x68 || buf[i + 3] !== 0x64) continue;
        const base = i + 4; // version + flags
        const matrix = base + (buf[base] === 1 ? 52 : 40);
        const widthAt = matrix + 36;
        if (widthAt + 8 > buf.length) continue;
        const w = view.getUint32(widthAt) / 65536;
        const h = view.getUint32(widthAt + 4) / 65536;
        if (!w || !h) continue;
        // ma trận xoay 90°/270° (video quay dọc bằng điện thoại): trình duyệt hiển thị đã xoay nên đổi chiều
        const a = view.getInt32(matrix);
        const d = view.getInt32(matrix + 16);
        return a === 0 && d === 0 ? h / w : w / h;
    }
    return null;
}

// mp4/mov: đi qua các hộp cấp cao nhất (ftyp, mdat…) đến moov, rồi qua các hộp con của moov tìm trak có tkhd với kích thước khác 0
// (track âm thanh thì bằng 0). Video quay từ điện thoại thường để moov ở cuối file nên không thể chỉ đọc phần đầu, và moov có thể
// dài hàng chục KB (track âm thanh đứng trước) nên chỉ đọc đúng phần đầu của từng trak thay vì cả moov.
// Mọi lần đọc đi qua một "cửa sổ" 16KB để gộp các hộp nằm gần nhau vào một request; thường chỉ cần 2 request mỗi video.
const WINDOW = 16 * 1024;
const TKHD_BYTES = 112;

function windowedReader(url: string) {
    let buf: Uint8Array | null = null;
    let start = 0;
    return async (offset: number, length: number): Promise<Uint8Array | null> => {
        if (!buf || offset < start || offset + length > start + buf.length) {
            buf = await fetchRange(url, offset, Math.max(length, WINDOW));
            start = offset;
            if (!buf) return null;
        }
        const at = offset - start;
        return buf.subarray(at, Math.min(buf.length, at + length));
    };
}

function boxHeader(head: Uint8Array) {
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let size = view.getUint32(0);
    let headerSize = 8;
    if (size === 1 && head.length >= 16) {
        size = Number(view.getBigUint64(8));
        headerSize = 16;
    }
    // size 0 là "hộp kéo dài đến hết file" nên không có gì phía sau; size < 8 là dữ liệu hỏng: cả hai đều dừng
    return {size, headerSize, type: String.fromCharCode(head[4], head[5], head[6], head[7])};
}

async function probeMp4(url: string): Promise<number | null> {
    const read = windowedReader(url);
    let offset = 0;
    for (let hop = 0; hop < 10; hop++) {
        const head = await read(offset, 16);
        if (!head || head.length < 8) return null;
        const box = boxHeader(head);
        if (box.size < 8) return null;
        if (box.type === "moov") {
            let pos = offset + box.headerSize;
            const end = offset + box.size;
            for (let child = 0; child < 16 && pos + 8 <= end; child++) {
                const childHead = await read(pos, 16);
                if (!childHead || childHead.length < 8) return null;
                const c = boxHeader(childHead);
                if (c.size < 8) return null;
                if (c.type === "trak") {
                    // tkhd là hộp con đầu tiên của trak
                    const tkhd = await read(pos + c.headerSize, TKHD_BYTES);
                    const ratio = tkhd ? tkhdRatio(tkhd) : null;
                    if (ratio !== null) return ratio;
                }
                pos += c.size;
            }
            return null;
        }
        offset += box.size;
    }
    return null;
}

async function probe(media: IMedia): Promise<number | null> {
    // chỉ đọc từ host media đã được phép (chặn SSRF nếu dữ liệu có URL lạ)
    if (!isAllowedMediaUrl(media.src)) return null;
    try {
        if (!media.isVideo) return await probeImage(media.src);
        // webm không đo được ở server: khung dùng tỉ lệ mặc định rồi tự chỉnh khi trình duyệt đọc xong metadata
        return /\.(mp4|mov|m4v)$/i.test(media.src) ? await probeMp4(media.src) : null;
    } catch {
        return null;
    }
}

async function ratioOf(media: IMedia): Promise<number | null> {
    const hit = cache.get(media.src);
    if (hit && (hit.ratio !== null || Date.now() - hit.at < FAILURE_TTL_MS)) return hit.ratio;
    const found = await probe(media);
    const ratio = found !== null && Number.isFinite(found) && found > 0 ? found : null;
    cache.set(media.src, {ratio, at: Date.now()});
    return ratio;
}

// Trả về danh sách media kèm `ratio` (null nếu không đo được).
export async function withRatios(list: IMedia[]): Promise<IMedia[]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const budget = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), TOTAL_BUDGET_MS);
    });
    try {
        return await Promise.all(list.map(async (m) => ({...m, ratio: await Promise.race([ratioOf(m), budget])})));
    } finally {
        clearTimeout(timer);
    }
}
