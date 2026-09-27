import {localeTag, type Lang} from "@/i18n/config";
import type {Dict} from "@/i18n/dictionaries/types";
import {plural} from "@/i18n/format";
import type {CostItem} from "@/lib/costs";
import {formatPrice} from "@/lib/price";
import {bodyToText} from "@/lib/rich-text";
import {normalizeText} from "@/lib/text";

export interface IConcert {
    slug: string
    kind: string,
    // Dữ liệu cũ lưu dạng chuỗi "DD.MM.YYYY", dữ liệu mới lưu kiểu Date
    date: Date | string
    title: string
    body: string
    images: string[],
    city: string | null
    venue: string | null
    artistName: string
    concertVenue: string
    zone: string | null
    row: string | null
    seat: string | null
    companion: string
    // VND. null hoặc không có: chưa biết giá; 0: vé mời/miễn phí
    ticketPrice?: number | null
    // Chỉ dùng ở trang quản trị (xem lib/costs.ts) — không ra ICard/trang công khai
    extraCosts?: CostItem[]
    merchResale?: CostItem[]
    rating: number
    // CHỈ là hiển thị: có hiện ra trang công khai hay không. "Sắp diễn ra" là chuyện khác, suy ra từ `date` (xem isUpcoming), không lưu ở đâu cả.
    active: boolean
    createdAt: Date,
    updatedAt: Date
}

const DMY_DATE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;

// Dữ liệu cũ lưu ngày dạng chuỗi "31.01.2026" nên phải tự parse thay vì dùng new Date(string).
export function parseConcertDate(date: Date | string | null | undefined): Date | null {
    if (!date) return null;
    if (date instanceof Date) return Number.isNaN(date.getTime()) ? null : date;
    const dmy = DMY_DATE.exec(date.trim());
    const d = dmy ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) : new Date(date);
    return Number.isNaN(d.getTime()) ? null : d;
}

// vi: "31 tháng 1, 2026"; en: "January 31, 2026"
export function formatLongDate(date: Date | string | null | undefined, lang: Lang) {
    const d = parseConcertDate(date);
    if (!d) return "";
    return d.toLocaleDateString(localeTag(lang), {day: "numeric", month: "long", year: "numeric"});
}

// Sắp theo ngày đã parse (mới nhất trước). Không dùng sort của Mongo vì ngày cũ là chuỗi DD.MM.YYYY.
export function sortNewestFirst<T extends { date: Date | string }>(list: T[]): T[] {
    const time = (e: T) => parseConcertDate(e.date)?.getTime() ?? 0;
    return [...list].sort((a, b) => time(b) - time(a));
}

// `weekdays` là dict.date.weekdays (bắt đầu từ Chủ nhật, khớp Date.getDay())
export function weekdayName(date: Date | string | null | undefined, weekdays: readonly string[]) {
    const d = parseConcertDate(date);
    return d ? weekdays[d.getDay()] : "";
}

// "Sắp diễn ra": ngày của đêm diễn còn ở phía sau "bây giờ". Suy ra từ ngày chứ không có công tắc nào; đêm không có ngày hợp lệ thì không phải.
// Trang công khai (nhãn của timeAgo) và sổ quản trị (badge, bộ lọc) đều dùng đúng quy tắc này nên không thể lệch nhau.
// Ngày lưu là 12:00 UTC nên đêm diễn hôm nay chuyển sang "đã diễn ra" lúc 19:00 giờ Việt Nam.
export function isUpcoming(date: Date | string | null | undefined, now = new Date()): boolean {
    const d = parseConcertDate(date);
    return d !== null && d.getTime() > now.getTime();
}

// "Hôm nay", "3 tuần trước"... theo từ điển `ago` của ngôn ngữ (số nhiều theo Intl.PluralRules)
export function timeAgo(date: Date | string | null | undefined, lang: Lang, ago: Dict["ago"], now = new Date()) {
    const d = parseConcertDate(date);
    if (!d) return "";
    if (isUpcoming(d, now)) return ago.upcoming;
    const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (days === 0) return ago.today;
    if (days === 1) return ago.yesterday;
    if (days < 7) return plural(lang, ago.days, days);
    if (days < 30) return plural(lang, ago.weeks, Math.floor(days / 7));
    if (days < 365) return plural(lang, ago.months, Math.floor(days / 30));
    return plural(lang, ago.years, Math.floor(days / 365));
}

// Đoạn trích ngắn từ nhật ký (HTML hoặc văn bản cũ): bỏ gạch đầu dòng, lấy đoạn đầu tiên.
export function excerpt(body: string, max = 240) {
    const first = bodyToText(body).split("\n").map((l) => l.replace(/^\s*[-•]\s*/, "").trim()).find(Boolean) ?? "";
    return first.length > max ? `${first.slice(0, max).trimEnd()}…` : first;
}

// Hash ổn định theo chuỗi: cùng slug luôn cho cùng kết quả nên độ nghiêng/màu giấy của mỗi vé không đổi giữa các lần tải
export function hashString(s: string) {
    let h = 2166136261;
    for (const c of s) {
        h ^= c.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// Tách tiêu đề thành 2-4 dòng theo từ sao cho dòng dài nhất ngắn nhất có thể (dùng cho tiêu đề áp phích).
export function splitTitle(title: string): string[] {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return words;
    const total = words.join(" ").length;
    // tiêu đề ngắn giữ một dòng; càng dài càng chia nhiều dòng
    const k = Math.min(words.length, total <= 10 ? 1 : total <= 20 ? 2 : total <= 44 ? 3 : 4);

    const prefix = [0];
    words.forEach((w, i) => prefix.push(prefix[i] + w.length));
    const width = (a: number, b: number) => prefix[b] - prefix[a] + (b - a - 1);

    // best[j][i]: dòng dài nhất nhỏ nhất khi chia i từ đầu thành j dòng
    const best = Array.from({length: k + 1}, () => Array<number>(words.length + 1).fill(Infinity));
    const cut = Array.from({length: k + 1}, () => Array<number>(words.length + 1).fill(0));
    best[0][0] = 0;
    for (let j = 1; j <= k; j++) {
        for (let i = j; i <= words.length; i++) {
            for (let m = j - 1; m < i; m++) {
                const cost = Math.max(best[j - 1][m], width(m, i));
                if (cost < best[j][i]) {
                    best[j][i] = cost;
                    cut[j][i] = m;
                }
            }
        }
    }
    const lines: string[] = [];
    for (let j = k, i = words.length; j > 0; j--) {
        const m = cut[j][i];
        lines.unshift(words.slice(m, i).join(" "));
        i = m;
    }
    return lines;
}

export function artistKey(name: string) {
    return name.trim().toLowerCase();
}

// "Một mình" là giá trị mặc định khi để trống ô Đi cùng, nên đi một mình thì vé không hiện "Đi cùng" (đọc thành "Đi cùng Một mình" rất kỳ).
// Nhận cả cách gõ khác: "một mình", "1 mình", "Đi một mình", và các cách nói tiếng Anh (solo, alone, by myself...).
// Chuỗi có người thật ("@leminhthu", "Một mình bạn") vẫn hiện.
const SOLO = /^((di )?(mot|1) minh|solo|alone|by myself|on my own|just me|myself)$/;

export function hasCompanion(companion: string | null | undefined) {
    const text = normalizeText((companion ?? "").trim()).replace(/\s+/g, " ");
    return text !== "" && !SOLO.test(text);
}

export function ticketNumber(date: Date | string | null | undefined, order: number) {
    const d = parseConcertDate(date);
    if (!d || !order) return null;
    return `${d.getFullYear()}-${String(order).padStart(4, "0")}`;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

export interface IMedia {
    src: string
    isVideo: boolean
    // rộng/cao khi hiển thị, do server đo (lib/media-dims.ts); thiếu hoặc null nghĩa là chưa biết
    ratio?: number | null
}

// Giới hạn tỉ lệ để ảnh panorama hay video quá dọc không tạo ra khung dị dạng (chỉ ảnh cực đoan mới bị crop)
export function clampRatio(ratio: number | null | undefined, fallback = 0.8) {
    return Math.min(2.4, Math.max(0.5, ratio && Number.isFinite(ratio) ? ratio : fallback));
}

export function isMediaUrl(src: string) {
    return IMAGE_EXT.test(src) || VIDEO_EXT.test(src);
}

export function getMediaList(images: string[] | undefined): IMedia[] {
    return (images ?? [])
        .filter(isMediaUrl)
        .map((src) => ({src, isVideo: VIDEO_EXT.test(src)}));
}

export function getCoverMedia(images: string[] | undefined) {
    return getMediaList(images)[0];
}

// Tông giấy vé tính từ màu chủ đạo của ảnh bìa (xem lib/tone.ts): ba tầng giấy sáng → đậm và màu vầng sáng, đều là mã hex.
export interface ITone {
    f1: string
    f2: string
    f3: string
    glow: string
}

// Dữ liệu gọn, thuần JSON để truyền xuống client component (không có ObjectId/Date).
export interface ICard {
    slug: string
    title: string
    artistName: string
    longDate: string
    year: number | null
    city: string | null
    day: number | null
    month: number | null
    // số vé theo thứ tự thời gian, vd. 2026-0021
    no: string
    place: string | null
    // đoạn trích ngắn, không gửi cả nhật ký (HTML) xuống client
    quote: string
    companion: string
    // giá vé đã định dạng sẵn ở server theo ngôn ngữ ("1.500.000đ", "Miễn phí" / "1,500,000đ", "Free"); null: chưa có giá
    priceLabel: string | null
    rating: number
    zone: string | null
    row: string | null
    seat: string | null
    cover: IMedia | null
    mediaCount: number
    // null: chưa có tông theo ảnh (không có ảnh, ảnh xám...) nên vé dùng tông platinum trung tính
    tone: ITone | null
}

export function toCard(c: IConcert, order: number, tone: ITone | null, lang: Lang): ICard {
    const media = getMediaList(c.images);
    const date = parseConcertDate(c.date);
    return {
        slug: c.slug,
        title: c.title,
        artistName: c.artistName,
        longDate: formatLongDate(c.date, lang),
        year: date?.getFullYear() ?? null,
        day: date?.getDate() ?? null,
        month: date ? date.getMonth() + 1 : null,
        no: ticketNumber(c.date, order) ?? "",
        city: c.city ?? null,
        place: c.venue ?? c.concertVenue ?? null,
        quote: excerpt(c.body),
        companion: c.companion,
        priceLabel: formatPrice(c.ticketPrice, lang),
        rating: c.rating,
        zone: c.zone ?? null,
        row: c.row ?? null,
        seat: c.seat ?? null,
        cover: media[0] ?? null,
        mediaCount: media.length,
        tone,
    };
}
