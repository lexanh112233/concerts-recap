import type {EventFormValues, FieldErrors} from "@/lib/event-input";

// Form sự kiện là một cuốn sổ nhiều trang; mỗi ô nhập nằm ở một trang. Bảng này cho biết lỗi của ô nào thì phải lật tới trang nào.
// Dùng Record<keyof EventFormValues, ...> để thêm một ô mới vào EventFormValues mà quên xếp trang sẽ báo lỗi lúc typecheck.
// Nhãn tab của các trang nằm ở từ điển (form.pageTabs, cùng thứ tự); dưới đây chỉ có số trang.
export const EVENT_PAGE_COUNT = 4;

const PAGE_OF_FIELD: Record<keyof EventFormValues, number> = {
    title: 0,
    artistName: 0,
    date: 0,
    venue: 0,
    city: 0,
    zone: 0,
    row: 0,
    seat: 0,
    companion: 0,
    ticketPrice: 0,
    extraCosts: 1,
    merchResale: 1,
    body: 2,
    images: 3,
    rating: 3,
    active: 3,
};

// Các trang (chỉ số từ 0) có ít nhất một lỗi. Lỗi chung của form (key "form", vd. không ghi được vào DB) không thuộc trang nào.
export function errorPages(errors: FieldErrors | undefined): Set<number> {
    const pages = new Set<number>();
    for (const [field, message] of Object.entries(errors ?? {})) {
        if (!message || field === "form") continue;
        const page = PAGE_OF_FIELD[field as keyof EventFormValues];
        if (page !== undefined) pages.add(page);
    }
    return pages;
}

// Trang đầu tiên có lỗi (để tự lật tới), null nếu không trang nào có lỗi.
export function firstErrorPage(errors: FieldErrors | undefined): number | null {
    const pages = errorPages(errors);
    return pages.size === 0 ? null : Math.min(...pages);
}
