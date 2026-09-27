import type {Lang} from "@/i18n/config";
import {groupedNumber} from "@/i18n/admin/validation";
import {artistKey, formatLongDate, getMediaList, isUpcoming, parseConcertDate, type IConcert, type IMedia} from "@/lib/concerts";
import {netActualCost, netActualCostLabel} from "@/lib/costs";
import {normalizeText} from "@/lib/text";

// Số đêm trên mỗi trang giấy của sổ quản trị.
export const ADMIN_PER_PAGE = 5;

// Một dòng danh sách quản trị: gọn, thuần JSON (không có ObjectId/Date) để truyền xuống client component.
// Ngày và nhãn tiền được dựng sẵn ở server (theo ngôn ngữ của trang quản trị) để hai bên hiển thị y hệt.
export interface AdminRow {
    slug: string
    title: string
    artistName: string
    // "20 tháng 9, 2026" / "September 20, 2026"; rỗng khi chưa có ngày hợp lệ
    dateLabel: string
    year: number | null
    // epoch ms để sắp xếp; 0 khi chưa có ngày
    time: number
    // sắp diễn ra: suy ra từ ngày (isUpcoming), độc lập với `active`
    upcoming: boolean
    // hiển thị: có hiện ra trang công khai không (false = đang ẩn). Độc lập với `upcoming`
    active: boolean
    ticketPrice: number | null
    // thực chi (giá vé + phát sinh − khoản thu hồi); null khi chưa có giá vé
    net: number | null
    // "Thực chi 1.150.000đ" / "Lãi 50.000đ" (en: "Net spent 1,150,000đ" / "Profit 50,000đ"); null khi chưa có giá vé
    netLabel: string | null
    // như netLabel nhưng bỏ chữ "Thực chi" ("1.150.000đ"; lãi vẫn giữ "Lãi ..." vì số đơn thuần sẽ đọc thành chi), cho chỗ hẹp
    netShort: string | null
    cover: IMedia | null
    // tiêu đề + nghệ sĩ + địa điểm + thành phố đã bỏ dấu, dùng cho ô tìm kiếm
    haystack: string
}

// `now` để test cố định được mốc "sắp diễn ra"
export function toAdminRow(c: IConcert, lang: Lang = "vi", now = new Date()): AdminRow {
    const date = parseConcertDate(c.date);
    const net = netActualCost(c.ticketPrice, c.extraCosts, c.merchResale);
    return {
        slug: c.slug,
        title: c.title,
        artistName: c.artistName,
        dateLabel: formatLongDate(c.date, lang),
        year: date?.getFullYear() ?? null,
        time: date?.getTime() ?? 0,
        upcoming: isUpcoming(c.date, now),
        active: c.active,
        ticketPrice: typeof c.ticketPrice === "number" ? c.ticketPrice : null,
        net,
        netLabel: netActualCostLabel(net, lang),
        netShort: net === null ? null : net < 0 ? netActualCostLabel(net, lang) : `${groupedNumber(net, lang)}đ`,
        cover: getMediaList(c.images)[0] ?? null,
        haystack: normalizeText([c.title, c.artistName, c.venue ?? c.concertVenue ?? "", c.city ?? ""].join(" ")),
    };
}

export interface AdminStats {
    nights: number
    artists: number
    // số đêm sắp diễn ra (theo ngày)
    upcoming: number
    // số đêm đang ẩn khỏi trang công khai (theo công tắc, không liên quan ngày)
    hidden: number
    // tổng thực chi của các đêm ĐÃ có giá vé (đêm chưa có giá vé không tính được nên không cộng)
    spent: number
    // số đêm chưa có giá vé, tức chưa được tính vào `spent`
    missingPrice: number
}

export function computeStats(rows: AdminRow[]): AdminStats {
    const artists = new Set<string>();
    let upcoming = 0;
    let hidden = 0;
    let spent = 0;
    let missingPrice = 0;
    for (const row of rows) {
        artists.add(artistKey(row.artistName));
        if (row.upcoming) upcoming++;
        if (!row.active) hidden++;
        if (row.net === null) missingPrice++;
        else spent += row.net;
    }
    return {nights: rows.length, artists: artists.size, upcoming, hidden, spent, missingPrice};
}

// Hai trục độc lập: theo NGÀY ("happened" = đã diễn ra, "upcoming" = sắp diễn ra) và theo CÔNG TẮC HIỂN THỊ ("hidden" = đang ẩn khỏi trang công khai).
// Nên các nhóm có thể chồng nhau: đêm sắp diễn ra mà đang ẩn nằm ở cả "upcoming" lẫn "hidden".
export type AdminFilter = "all" | "happened" | "upcoming" | "hidden";
export type AdminSort = "newest" | "oldest" | "price" | "net";

// Mọi từ trong ô tìm kiếm phải có mặt (không cần đúng thứ tự, không cần gõ dấu).
export function filterRows(rows: AdminRow[], {query = "", filter = "all"}: { query?: string, filter?: AdminFilter } = {}): AdminRow[] {
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
        if (filter === "happened" && row.upcoming) return false;
        if (filter === "upcoming" && !row.upcoming) return false;
        if (filter === "hidden" && row.active) return false;
        return words.every((w) => row.haystack.includes(w));
    });
}

// Không đổi mảng gốc. Với "price"/"net", đêm chưa có số liệu xuống cuối; hoà thì đêm mới hơn lên trước.
export function sortRows(rows: AdminRow[], sort: AdminSort): AdminRow[] {
    const byNewest = (a: AdminRow, b: AdminRow) => b.time - a.time;
    const desc = (pick: (r: AdminRow) => number | null) => (a: AdminRow, b: AdminRow) => {
        const x = pick(a);
        const y = pick(b);
        if (x === null && y === null) return byNewest(a, b);
        if (x === null) return 1;
        if (y === null) return -1;
        return y - x || byNewest(a, b);
    };
    const list = [...rows];
    switch (sort) {
        case "oldest":
            return list.sort((a, b) => a.time - b.time);
        case "price":
            return list.sort(desc((r) => r.ticketPrice));
        case "net":
            return list.sort(desc((r) => r.net));
        default:
            return list.sort(byNewest);
    }
}

// Chia thành các trang; luôn có ít nhất một trang (rỗng) để sổ không bao giờ hết trang.
export function paginate<T>(items: T[], perPage = ADMIN_PER_PAGE): T[][] {
    if (items.length === 0) return [[]];
    const pages: T[][] = [];
    for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
    return pages;
}

// Chỉ số trang (từ 0) chứa đêm `slug`; -1 nếu không có trong danh sách.
export function pageOfSlug(rows: AdminRow[], slug: string, perPage = ADMIN_PER_PAGE): number {
    const index = rows.findIndex((r) => r.slug === slug);
    return index < 0 ? -1 : Math.floor(index / perPage);
}

export interface YearTab {
    year: number
    // chỉ số trang (từ 0) đầu tiên có đêm của năm này
    page: number
}

// Mỗi năm một tab, theo thứ tự xuất hiện trong danh sách đã sắp; trỏ tới trang đầu tiên có năm đó.
// Đêm chưa có ngày không có tab.
export function yearTabs(rows: AdminRow[], perPage = ADMIN_PER_PAGE): YearTab[] {
    const tabs: YearTab[] = [];
    rows.forEach((row, index) => {
        if (row.year !== null && !tabs.some((t) => t.year === row.year)) {
            tabs.push({year: row.year, page: Math.floor(index / perPage)});
        }
    });
    return tabs;
}

// Đơn vị và dấu thập phân của số tiền gọn theo ngôn ngữ (đặt ở đây, không phải từ điển, để module vẫn thuần)
const SHORT_UNITS: Record<Lang, { units: [string, string, string], decimal: string }> = {
    vi: {units: ["k", "tr", " tỷ"], decimal: ","},
    en: {units: ["k", "M", "B"], decimal: "."},
};

// Số tiền VND gọn cho chỗ hẹp: vi "850k", "1,5tr", "24,87tr", "1,2 tỷ"; en "850k", "1.5M", "24.87M", "1.2B"; số âm có dấu trừ.
export function formatVndShort(amount: number, lang: Lang = "vi"): string {
    const sign = amount < 0 ? "−" : "";
    const n = Math.abs(amount);
    if (n < 1_000) return `${sign}${n}đ`;

    const {units: names, decimal} = SHORT_UNITS[lang];
    const units = [{size: 1_000, unit: names[0]}, {size: 1_000_000, unit: names[1]}, {size: 1_000_000_000, unit: names[2]}];
    let i = n >= 1_000_000_000 ? 2 : n >= 1_000_000 ? 1 : 0;
    let value = Math.round((n / units[i].size) * 100) / 100;
    // 999.999 làm tròn thành "1000k": nhảy lên đơn vị kế tiếp cho đúng ("1tr")
    if (value >= 1_000 && i < units.length - 1) {
        i++;
        value = Math.round((n / units[i].size) * 100) / 100;
    }
    return `${sign}${String(value).replace(".", decimal)}${units[i].unit}`;
}
