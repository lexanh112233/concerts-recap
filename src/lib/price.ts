// Giá vé tính bằng VND (số nguyên). Module thuần (chỉ import cấu hình ngôn ngữ) nên dùng được cả ở server lẫn client.
import {localeTag, type Lang} from "@/i18n/config";

export const MAX_TICKET_PRICE = 100_000_000;

// Chữ ghi cho vé mời (giá 0). Đặt ở đây thay vì từ điển để module này vẫn thuần, không kéo cả từ điển vào bundle client (form admin cũng dùng).
const FREE: Record<Lang, string> = {vi: "Miễn phí", en: "Free"};

// vi: "1.500.000đ"; en: "1,500,000đ". 0 là vé mời nên ghi "Miễn phí"/"Free"; chưa có giá thì trả null (vé không hiện dòng giá)
export function formatPrice(price: number | null | undefined, lang: Lang) {
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return null;
    return price === 0 ? FREE[lang] : `${price.toLocaleString(localeTag(lang))}đ`;
}

const PRICE_INPUT = /^(?:\d{1,9}|\d{1,3}(?:[.,\s]\d{3})+)$/;

// Giá nhập tay: "1500000", "1.500.000", "1,500,000", "1.500.000đ", "350000 vnd" đều được.
// Trả chuỗi số chuẩn hóa ("" nếu để trống) hoặc null nếu không hợp lệ. Dấu chấm/phẩy chỉ được là dấu ngăn nghìn:
// "1.5" bị từ chối thay vì lặng lẽ thành 15đ.
export function normalizePrice(raw: string): string | null {
    const text = raw.trim();
    if (!text) return "";
    const digits = text.replace(/\s*(?:đ|₫|vnđ|vnd)$/i, "").trim();
    if (!PRICE_INPUT.test(digits)) return null;
    const price = Number(digits.replace(/[.,\s]/g, ""));
    return price <= MAX_TICKET_PRICE ? String(price) : null;
}
