import type {vi} from "@/i18n/admin/dictionaries/vi";

// Mọi chuỗi thành string, mảng thành string[]: bản en phải có ĐÚNG các khoá của bản vi (thiếu hay thừa khoá là lỗi typecheck).
// Độ dài mảng và các {tham số} do admin-dictionaries.test.ts kiểm.
type Widen<T> = T extends string ? string : T extends readonly unknown[] ? string[] : { [K in keyof T]: Widen<T[K]> };

export type AdminDict = Widen<typeof vi>;
