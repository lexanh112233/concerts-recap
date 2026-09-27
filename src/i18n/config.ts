// Ngôn ngữ của giao diện công khai: tiếng Việt là mặc định và nằm ở "/", tiếng Anh nằm dưới "/en".
// Ngôn ngữ do CẤU TRÚC ROUTE quyết định (mỗi ngôn ngữ một root layout, xem app/(vi) và app/en/(site)), không đọc cookie/header,
// nên các trang công khai vẫn tĩnh (SSG/ISR). Trang quản trị theo đúng quy tắc đó: /admin (vi) và /en/admin (en, app/en/(admin)).
// Module thuần, dùng được cả ở server lẫn client.
export type Lang = "vi" | "en";

export const LANGS: readonly Lang[] = ["vi", "en"];
export const DEFAULT_LANG: Lang = "vi";

export const isLang = (value: unknown): value is Lang => value === "vi" || value === "en";

const TAGS: Record<Lang, string> = {vi: "vi-VN", en: "en-US"};

// Thẻ locale cho Intl / toLocaleString / localeCompare
export const localeTag = (lang: Lang) => TAGS[lang];

// "/concerts/x" → "/en/concerts/x" (tiếng Anh), giữ nguyên với tiếng Việt. Nhận cả "/" và "/#archive".
export function pathFor(lang: Lang, path: string): string {
    if (lang === DEFAULT_LANG) return path;
    if (path === "/") return "/en";
    return path.startsWith("/#") || path.startsWith("/?") ? `/en${path.slice(1)}` : `/en${path}`;
}

// Đường dẫn hiện tại thuộc ngôn ngữ nào ("/en" và "/en/..." là tiếng Anh, còn lại là tiếng Việt)
export function langOfPath(pathname: string): Lang {
    return pathname === "/en" || pathname.startsWith("/en/") ? "en" : DEFAULT_LANG;
}

// Cùng một trang ở ngôn ngữ khác: "/en/concerts/x" → "/concerts/x" và ngược lại
export function switchPath(pathname: string, to: Lang): string {
    const base = langOfPath(pathname) === "en" ? pathname.slice("/en".length) || "/" : pathname;
    return pathFor(to, base);
}
