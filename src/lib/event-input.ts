import type {Lang} from "@/i18n/config";
import {groupedNumber, validationMessages} from "@/i18n/admin/validation";
import {format} from "@/i18n/format";
import {isMediaUrl, parseConcertDate, type IConcert} from "@/lib/concerts";
import {parseCostRows, toCostDocs, type CostRowInput} from "@/lib/costs";
import {allowedMediaHosts, isAllowedMediaUrl} from "@/lib/media-hosts";
import {MAX_TICKET_PRICE, normalizePrice} from "@/lib/price";
import {bodyToText} from "@/lib/rich-text";
import {bodyToHtml} from "@/lib/sanitize";

// Toàn bộ giá trị form là chuỗi để dễ giữ lại khi có lỗi và hiển thị lại.
export interface EventFormValues {
    title: string
    artistName: string
    date: string        // YYYY-MM-DD
    venue: string
    city: string
    zone: string
    row: string
    seat: string
    companion: string
    ticketPrice: string // VND, chuỗi số ("" = chưa có giá)
    extraCosts: CostRowInput[]  // chi phí phát sinh (vận chuyển, taxi, Grab, công camp vé, membership...)
    merchResale: CostRowInput[] // khoản thu hồi (bán lại merch, pass vé, voucher...) để giảm chi thực tế; tên field là tên cũ trong DB
    rating: string      // "0".."5"
    body: string
    active: boolean
    images: string[]
}

export type FieldErrors = Partial<Record<keyof EventFormValues | "form", string>>;

export const EMPTY_VALUES: EventFormValues = {
    title: "", artistName: "", date: "", venue: "", city: "", zone: "", row: "", seat: "",
    companion: "", ticketPrice: "", extraCosts: [], merchResale: [], rating: "5", body: "", active: true, images: [],
};

const MAX_IMAGES = 80;

const pad = (n: number) => String(n).padStart(2, "0");

// Ngày trong DB có thể là chuỗi cũ "DD.MM.YYYY" hoặc Date; input type=date cần YYYY-MM-DD.
export function dateToInput(date: Date | string | null | undefined) {
    const d = parseConcertDate(date);
    return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
}

export function valuesFromDoc(doc: IConcert): EventFormValues {
    return {
        title: doc.title,
        artistName: doc.artistName,
        date: dateToInput(doc.date),
        venue: doc.venue ?? doc.concertVenue ?? "",
        city: doc.city ?? "",
        zone: doc.zone ?? "",
        row: doc.row ?? "",
        seat: doc.seat ?? "",
        companion: doc.companion ?? "",
        ticketPrice: typeof doc.ticketPrice === "number" ? String(doc.ticketPrice) : "",
        extraCosts: (doc.extraCosts ?? []).map((c) => ({label: c.label, amount: String(c.amount)})),
        merchResale: (doc.merchResale ?? []).map((c) => ({label: c.label, amount: String(c.amount)})),
        rating: String(Math.min(5, Math.max(0, Math.round(doc.rating ?? 0)))),
        // nhật ký cũ (văn bản thường) được đổi sang HTML để trình soạn thảo mở được
        body: bodyToHtml(doc.body),
        active: doc.active,
        images: doc.images ?? [],
    };
}

const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

// `lang`: ngôn ngữ của thông báo lỗi (theo ngôn ngữ trang quản trị đang dùng)
export function parseEventForm(fd: FormData, lang: Lang = "vi"): { values: EventFormValues, errors: FieldErrors } {
    const m = validationMessages(lang);
    let images: string[] = [];
    try {
        const parsed = JSON.parse(String(fd.get("images") ?? "[]"));
        if (Array.isArray(parsed)) images = parsed.filter((v): v is string => typeof v === "string");
    } catch {
        // để trống, báo lỗi bên dưới nếu cần
    }

    // dòng trống bị bỏ ở parseCostRows nên chưa cần try/catch riêng ở đây (JSON hỏng thì hàm đó tự coi là không có dòng nào)
    const extraCosts = parseCostRows(String(fd.get("extraCosts") ?? "[]"), m.labels.extraCosts, lang);
    const merchResale = parseCostRows(String(fd.get("merchResale") ?? "[]"), m.labels.recoup, lang);

    const values: EventFormValues = {
        title: text(fd, "title"),
        artistName: text(fd, "artistName"),
        date: text(fd, "date"),
        venue: text(fd, "venue"),
        city: text(fd, "city"),
        zone: text(fd, "zone"),
        row: text(fd, "row"),
        seat: text(fd, "seat"),
        companion: text(fd, "companion"),
        ticketPrice: text(fd, "ticketPrice"),
        extraCosts: extraCosts.rows,
        merchResale: merchResale.rows,
        rating: text(fd, "rating") || "0",
        body: String(fd.get("body") ?? "").replace(/\r\n/g, "\n").trim(),
        active: fd.get("active") === "on",
        images,
    };

    const errors: FieldErrors = {};
    const required = (key: keyof EventFormValues, label: string, max: number) => {
        const v = String(values[key]);
        if (!v) errors[key] = format(m.required, {label});
        else if (v.length > max) errors[key] = format(m.tooLong, {label, max});
    };
    const optional = (key: keyof EventFormValues, label: string, max: number) => {
        if (String(values[key]).length > max) errors[key] = format(m.tooLong, {label, max});
    };

    required("title", m.labels.title, 200);
    required("artistName", m.labels.artistName, 120);
    required("venue", m.labels.venue, 200);
    if (!bodyToText(values.body)) errors.body = format(m.required, {label: m.labels.body});
    else if (values.body.length > 60000) errors.body = m.bodyTooLong;
    optional("city", m.labels.city, 100);
    optional("zone", m.labels.zone, 50);
    optional("row", m.labels.row, 50);
    optional("seat", m.labels.seat, 50);
    optional("companion", m.labels.companion, 200);

    // ngày phải có thật: nếu chỉ kiểm tra Date hợp lệ thì "2026-02-31" lặng lẽ tràn sang 03/03
    const day = storedDate(values.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== values.date) {
        errors.date = m.pickDate;
    }
    if (!/^[0-5]$/.test(values.rating)) errors.rating = m.rating;

    // chuẩn hóa "1.500.000đ" → "1500000" để lưu; sai thì giữ nguyên chữ đã gõ để form hiện lại đúng
    const price = normalizePrice(values.ticketPrice);
    if (price === null) errors.ticketPrice = format(m.price, {max: groupedNumber(MAX_TICKET_PRICE, lang)});
    else values.ticketPrice = price;

    if (extraCosts.error) errors.extraCosts = extraCosts.error;
    if (merchResale.error) errors.merchResale = merchResale.error;

    if (images.length > MAX_IMAGES) {
        errors.images = format(m.maxImages, {max: MAX_IMAGES});
    } else {
        const bad = images.find((url) => !isMediaUrl(url) || !isAllowedMediaUrl(url));
        if (bad) {
            // chưa đặt R2_PUBLIC_URL thì chưa có host nào được phép: nêu tên biến cần đặt thay vì để trống
            errors.images = format(m.badImage, {url: bad, hosts: allowedMediaHosts().join(", ") || "R2_PUBLIC_URL"});
        }
    }

    return {values, errors};
}

// Chuyển giá trị form thành document Mongo.
// Ngày lưu vào DB từ giá trị YYYY-MM-DD của ô chọn ngày: 12:00 UTC để không lệch sang ngày khác ở các múi giờ khác nhau.
// Form dùng đúng hàm này để đoán "sắp diễn ra" giống hệt danh sách quản trị (isUpcoming trên ngày đã lưu).
export const storedDate = (value: string) => new Date(`${value}T12:00:00.000Z`);

export function toDoc(values: EventFormValues) {
    return {
        kind: "attended",
        title: values.title,
        artistName: values.artistName,
        date: storedDate(values.date),
        venue: values.venue,
        concertVenue: values.venue,
        city: values.city || null,
        zone: values.zone || null,
        row: values.row || null,
        seat: values.seat || null,
        // schema bắt buộc companion nên để trống thì ghi giá trị mặc định
        companion: values.companion || "Một mình",
        // để trống thì ghi null (bỏ giá); "0" là vé mời
        ticketPrice: values.ticketPrice === "" ? null : Number(values.ticketPrice),
        extraCosts: toCostDocs(values.extraCosts),
        merchResale: toCostDocs(values.merchResale),
        rating: Number(values.rating),
        // lọc HTML theo danh sách cho phép trước khi lưu (chặn script, on*, javascript:…)
        body: bodyToHtml(values.body),
        images: values.images,
        active: values.active,
    };
}
