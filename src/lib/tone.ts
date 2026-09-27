import sharp from "sharp";
import {isAllowedMediaUrl} from "@/lib/media-hosts";
import {getMediaList, type ITone} from "@/lib/concerts";

// Chỉ dùng ở server. Tính tông giấy vé (sáng / giữa / đậm + màu vầng sáng) từ MÀU CHỦ ĐẠO của ảnh bìa, để vé của mỗi đêm diễn
// có màu ăn với ảnh của nó thay vì màu ngẫu nhiên. Cách làm:
//   1. tải ảnh, thu nhỏ còn 48×48 (sharp) và đổi từng điểm ảnh sang OKLCH (hệ màu cảm nhận đều, dễ chọn "sắc" và "độ đậm");
//   2. bỏ điểm quá tối/quá sáng/xám (poster hay có nền đen, màu điểm nhấn mới là thứ mắt thấy) rồi chấm điểm theo sắc độ (hue)
//      với trọng số chroma², lấy sắc có điểm cao nhất làm màu chủ đạo;
//   3. dựng ba tầng giấy pastel + màu glow cùng sắc đó (độ sáng cố định để chữ mực đen luôn đủ tương phản, chỉ độ đậm màu thay đổi theo ảnh).
// Ảnh xám/đen trắng hoặc không có ảnh thì trả null: vé dùng tông platinum trung tính (xem lib/foil.ts).
// Kết quả được nhớ trong bộ nhớ theo URL (URL media không đổi). Trang chủ chạy lúc ISR nên không ai chờ; trang chi tiết chỉ cần 3 ảnh.

const SIZE = 48;
const MAX_BYTES = 12 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;
const TOTAL_BUDGET_MS = 6000;
const CONCURRENCY = 4;
const FAILURE_TTL_MS = 60_000;
const HUE_BINS = 36;

const cache = new Map<string, { tone: ITone | null, at: number }>();

// ---------- toán màu (sRGB ↔ OKLab/OKLCH, công thức của Björn Ottosson) ----------

const toLinear = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

function rgbToOklch(r: number, g: number, b: number): [L: number, C: number, h: number] {
    const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const h = (Math.atan2(bb, a) * 180) / Math.PI;
    return [L, Math.hypot(a, bb), h < 0 ? h + 360 : h];
}

// Trả null nếu (L, C, h) nằm ngoài gam sRGB
function oklchToRgb(L: number, C: number, hDeg: number): [number, number, number] | null {
    const h = (hDeg * Math.PI) / 180;
    const a = C * Math.cos(h), b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    const eps = 0.001;
    if (rgb.some((v) => v < -eps || v > 1 + eps)) return null;
    return rgb.map((v) => Math.round(255 * fromLinear(Math.min(1, Math.max(0, v))))) as [number, number, number];
}

// Chroma lớn quá thì ra ngoài gam màu: giảm dần chroma cho đến khi vừa sRGB (giữ nguyên sắc và độ sáng)
function hex(L: number, C: number, h: number) {
    let c = C;
    let rgb = oklchToRgb(L, c, h);
    for (let i = 0; i < 40 && !rgb; i++) {
        c *= 0.92;
        rgb = oklchToRgb(L, c, h);
    }
    const [r, g, b] = rgb ?? [255, 255, 255];
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---------- màu chủ đạo ----------

interface Dominant {
    hue: number
    chroma: number
}

async function dominantOf(image: Buffer): Promise<Dominant | null> {
    const {data, info} = await sharp(image, {failOn: "none", limitInputPixels: 100_000_000})
        .resize(SIZE, SIZE, {fit: "inside"})
        // PNG trong suốt: đặt lên nền trắng (trắng bị bỏ qua khi chấm điểm) thay vì để lộ màu đen ẩn dưới
        .flatten({background: {r: 255, g: 255, b: 255}})
        .toColourspace("srgb")
        .raw()
        .toBuffer({resolveWithObject: true});

    const step = info.channels;
    const weight = new Float64Array(HUE_BINS);
    const chromaSum = new Float64Array(HUE_BINS);
    const cosSum = new Float64Array(HUE_BINS);
    const sinSum = new Float64Array(HUE_BINS);
    let pixels = 0;
    let vivid = 0;

    for (let i = 0; i + 2 < data.length; i += step) {
        pixels++;
        const [L, C, h] = rgbToOklch(data[i], data[i + 1], data[i + 2]);
        // quá tối/quá sáng thì không mang màu; chroma thấp là xám
        if (L < 0.2 || L > 0.96 || C < 0.04) continue;
        vivid++;
        const w = C * C;
        const bin = Math.floor(h / (360 / HUE_BINS)) % HUE_BINS;
        weight[bin] += w;
        chromaSum[bin] += C * w;
        cosSum[bin] += Math.cos((h * Math.PI) / 180) * w;
        sinSum[bin] += Math.sin((h * Math.PI) / 180) * w;
    }

    // dưới 3% điểm ảnh có màu thì coi là ảnh xám / đen trắng
    if (pixels === 0 || vivid / pixels < 0.03) return null;

    // điểm của một sắc gồm cả hai ô lân cận (làm mượt) để tránh sắc bị cắt đôi thành hai ô yếu
    let best = 0;
    let bestScore = -1;
    for (let b = 0; b < HUE_BINS; b++) {
        const score = weight[b] + 0.5 * (weight[(b + 1) % HUE_BINS] + weight[(b + HUE_BINS - 1) % HUE_BINS]);
        if (score > bestScore) {
            bestScore = score;
            best = b;
        }
    }
    const around = [(best + HUE_BINS - 1) % HUE_BINS, best, (best + 1) % HUE_BINS];
    const w = around.reduce((s, b) => s + weight[b], 0);
    if (w <= 0) return null;
    const cos = around.reduce((s, b) => s + cosSum[b], 0);
    const sin = around.reduce((s, b) => s + sinSum[b], 0);
    const hue = ((Math.atan2(sin, cos) * 180) / Math.PI + 360) % 360;
    const chroma = around.reduce((s, b) => s + chromaSum[b], 0) / w;
    return {hue, chroma};
}

// Ba tầng giấy + glow cùng sắc với ảnh. Độ sáng cố định (giống các tông thủ công cũ) để chữ mực đen luôn đủ tương phản;
// k (0.35–1) là độ đậm màu của ảnh: ảnh nhạt màu thì giấy chỉ ám sắc nhẹ, ảnh rực thì giấy đậm sắc hơn.
export function toneFromDominant({hue, chroma}: Dominant): ITone {
    const k = Math.min(1, Math.max(0.35, (chroma - 0.03) / 0.11));
    return {
        f1: hex(0.985, 0.014 * k, hue),
        f2: hex(0.915, 0.045 * k, hue),
        f3: hex(0.8, 0.078 * k, hue),
        glow: hex(0.78, 0.09 + 0.08 * k, hue),
    };
}

// ---------- tải ảnh và tính (có nhớ) ----------

async function download(url: string): Promise<Buffer | null> {
    // Không đặt cache: "no-store": tùy chọn đó buộc cả trang gọi hàm này chuyển sang render động (mất SSG/ISR dù đã có revalidate).
    // Mặc định ("auto no cache") không lưu ảnh vào Data Cache mà vẫn cho dựng tĩnh lúc build.
    const res = await fetch(url, {signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
    if (!res.ok) {
        await res.body?.cancel();
        return null;
    }
    const declared = Number(res.headers.get("content-length"));
    if (declared > MAX_BYTES) {
        await res.body?.cancel();
        return null;
    }
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) {
            await reader.cancel().catch(() => undefined);
            return null;
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks);
}

async function toneOfUrl(url: string): Promise<ITone | null> {
    const hit = cache.get(url);
    // thành công (kể cả "ảnh xám" = null có chủ đích) nhớ mãi; lỗi mạng chỉ nhớ ngắn để lần sau thử lại
    if (hit && (hit.tone !== null || Date.now() - hit.at < FAILURE_TTL_MS)) return hit.tone;

    let tone: ITone | null = null;
    if (isAllowedMediaUrl(url)) {
        try {
            const image = await download(url);
            const dominant = image ? await dominantOf(image) : null;
            tone = dominant ? toneFromDominant(dominant) : null;
        } catch {
            tone = null;
        }
    }
    cache.set(url, {tone, at: Date.now()});
    return tone;
}

// Ảnh dùng để lấy màu: ảnh đầu tiên (không phải video) của đêm diễn, tức ảnh bìa nếu bìa là ảnh.
export function toneSourceUrl(images: string[] | undefined): string | null {
    return getMediaList(images).find((m) => !m.isVideo)?.src ?? null;
}

// Trả về Map slug → tông (null nếu chưa tính được: không có ảnh, ảnh xám, lỗi mạng hay quá thời gian chờ).
export async function getCoverTones(entries: Array<{ slug: string, images: string[] }>): Promise<Map<string, ITone | null>> {
    const bySlug = new Map<string, string>();
    for (const e of entries) {
        const url = toneSourceUrl(e.images);
        if (url) bySlug.set(e.slug, url);
    }
    const urls = [...new Set(bySlug.values())];
    const byUrl = new Map<string, ITone | null>();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const budget = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, TOTAL_BUDGET_MS);
    });
    // vài luồng song song thôi để không dồn cả chục ảnh nặng cùng lúc; quá hạn thì bỏ qua phần còn lại
    let next = 0;
    const worker = async () => {
        while (next < urls.length) {
            const url = urls[next++];
            byUrl.set(url, await toneOfUrl(url));
        }
    };
    try {
        await Promise.race([Promise.all(Array.from({length: Math.min(CONCURRENCY, urls.length)}, worker)), budget]);
    } finally {
        clearTimeout(timer);
    }

    const result = new Map<string, ITone | null>();
    for (const e of entries) {
        const url = bySlug.get(e.slug);
        result.set(e.slug, (url && byUrl.get(url)) || null);
    }
    return result;
}
