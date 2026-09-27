import "server-only";
import type {Metadata} from "next";
import type {Lang} from "@/i18n/config";
import {en} from "@/i18n/admin/dictionaries/en";
import type {AdminDict} from "@/i18n/admin/dictionaries/types";
import {vi} from "@/i18n/admin/dictionaries/vi";
import {format} from "@/i18n/format";
import {BRAND_NAME} from "@/lib/brand";

// Ngôn ngữ trang quản trị đi theo ĐƯỜNG DẪN như trang công khai: /admin là tiếng Việt, /en/admin là tiếng Anh (mỗi bên một root layout
// riêng, xem app/admin và app/en/(admin)). Không có cookie hay bộ nhớ ngôn ngữ riêng nên hai nơi hành xử giống hệt nhau.
// Chỉ import ở phía server: client component lấy chuỗi qua useAdminI18n() (i18n/admin/provider.tsx) nên bundle client không kéo cả hai từ điển.
const DICTS: Record<Lang, AdminDict> = {vi, en};

export const getAdminDict = (lang: Lang): AdminDict => DICTS[lang];

// Metadata dùng chung cho root layout admin của từng ngôn ngữ: tên tab theo ngôn ngữ, không cho công cụ tìm kiếm lập chỉ mục
export const adminMetadata = (lang: Lang): Metadata => ({
    title: format(DICTS[lang].meta.title, {brand: BRAND_NAME}),
    robots: {index: false, follow: false},
});
