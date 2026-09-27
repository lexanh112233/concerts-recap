import type {Lang} from "@/i18n/config";
import {groupedNumber, validationMessages} from "@/i18n/admin/validation";
import {format} from "@/i18n/format";
import {MAX_TICKET_PRICE, normalizePrice} from "@/lib/price";

// Một dòng chi phí/thu nhập tự do (nhãn tự đặt + số tiền VND), dùng cho "chi phí phát sinh" (vận chuyển, taxi, Grab,
// công camp vé, membership...) và "khoản thu hồi" (bán lại merch lẻ hay cả bộ, pass lại vé lỗ, voucher từ các brand... — nhãn tự do
// chứa luôn ý đó) của một đêm diễn. Field lưu DB của khoản thu hồi vẫn tên cũ `merchResale` (đổi tên cần migrate, và tên không hiện ra ngoài).
// Module thuần như price.ts, dùng được cả ở server (schema, actions) lẫn client (form quản trị).
export interface CostItem {
    label: string
    amount: number
}

export const MAX_COST_ROWS = 30;
export const MAX_LABEL_LENGTH = 80;

// Dạng thô trên form: amount là chuỗi để giữ lại chữ đã gõ khi lỗi (giống ticketPrice ở event-input.ts).
export interface CostRowInput {
    label: string
    amount: string
}

function isBlankRow(row: CostRowInput) {
    return !row.label.trim() && !row.amount.trim();
}

// Parse mảng JSON từ field ẩn của form. Dòng để trống hoàn toàn (nhãn và số tiền đều rỗng) bị bỏ qua êm — đó là dòng
// UI tạo ra rồi admin quên xoá, không phải lỗi. Dòng có nhãn mà thiếu/sai số tiền, hoặc có số tiền mà thiếu nhãn, là lỗi:
// dừng ở dòng sai đầu tiên và giữ nguyên chữ đã gõ để form hiện lại đúng. Số tiền hợp lệ được chuẩn hoá qua normalizePrice.
export function parseCostRows(raw: string, fieldLabel: string, lang: Lang = "vi"): { rows: CostRowInput[], error?: string } {
    const m = validationMessages(lang).costs;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw || "[]");
    } catch {
        parsed = [];
    }
    if (!Array.isArray(parsed)) return {rows: []};

    const all: CostRowInput[] = parsed
        .filter((r): r is { label?: unknown, amount?: unknown } => typeof r === "object" && r !== null)
        .map((r) => ({label: String(r.label ?? "").trim(), amount: String(r.amount ?? "").trim()}));

    const rows = all.filter((r) => !isBlankRow(r));

    if (rows.length > MAX_COST_ROWS) {
        return {rows, error: format(m.tooManyRows, {label: fieldLabel, max: MAX_COST_ROWS})};
    }

    for (const row of rows) {
        if (!row.label || !row.amount) {
            return {rows, error: format(m.needsBoth, {label: fieldLabel, row: row.label || row.amount})};
        }
        if (row.label.length > MAX_LABEL_LENGTH) {
            return {rows, error: format(m.labelTooLong, {label: fieldLabel, row: row.label, max: MAX_LABEL_LENGTH})};
        }
        const price = normalizePrice(row.amount);
        if (price === null || price === "") {
            return {rows, error: format(m.amountInvalid, {label: fieldLabel, row: row.label, max: groupedNumber(MAX_TICKET_PRICE, lang)})};
        }
        row.amount = price;
    }

    return {rows};
}

// Chuyển dòng đã qua parseCostRows (amount đã chuẩn hoá) thành dữ liệu lưu Mongo.
export function toCostDocs(rows: CostRowInput[]): CostItem[] {
    return rows.map(({label, amount}) => ({label, amount: Number(amount)}));
}

export function sumCosts(items: CostItem[] | null | undefined): number {
    return (items ?? []).reduce((sum, item) => sum + item.amount, 0);
}

// Thực chi = giá vé + chi phí phát sinh − khoản thu hồi. Chưa có giá vé (null/undefined) thì chưa tính được, trả null.
// Có thể âm (thu hồi nhiều hơn tổng chi ra) — nghĩa là lãi, phía hiển thị tự diễn giải.
export function netActualCost(
    ticketPrice: number | null | undefined,
    extraCosts: CostItem[] | null | undefined,
    merchResale: CostItem[] | null | undefined,
): number | null {
    if (typeof ticketPrice !== "number" || !Number.isFinite(ticketPrice)) return null;
    return ticketPrice + sumCosts(extraCosts) - sumCosts(merchResale);
}

// Chữ ghi ở trước số tiền: đặt ở đây (như FREE ở price.ts) để module vẫn thuần
const NET_WORD: Record<Lang, { spent: string, profit: string }> = {
    vi: {spent: "Thực chi", profit: "Lãi"},
    en: {spent: "Net spent", profit: "Profit"},
};

// "Thực chi 1.750.000đ" hoặc "Lãi 50.000đ" (thu hồi bù hơn cả chi ra); null khi chưa có giá vé để tính.
// Không dùng formatPrice ở đây: formatPrice(0) trả "Miễn phí" (đúng cho GIÁ VÉ) nhưng thực chi bằng 0 nghĩa là hoà vốn, không phải vé mời.
export function netActualCostLabel(net: number | null, lang: Lang = "vi"): string | null {
    if (net === null) return null;
    const vnd = (n: number) => `${groupedNumber(n, lang)}đ`;
    return net < 0 ? `${NET_WORD[lang].profit} ${vnd(-net)}` : `${NET_WORD[lang].spent} ${vnd(net)}`;
}
