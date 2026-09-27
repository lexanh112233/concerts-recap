import type {vi} from "@/i18n/dictionaries/vi";

// Mọi chuỗi thành string, mảng thành string[]: bản en phải có ĐÚNG các khoá của bản vi (thiếu hay thừa khoá là lỗi typecheck).
// Độ dài các mảng (tháng, thứ, mood) và các {tham số} do i18n-dict.test.ts kiểm.
type Widen<T> = T extends string ? string : T extends readonly unknown[] ? string[] : { [K in keyof T]: Widen<T[K]> };

export type Dict = Widen<typeof vi>;
