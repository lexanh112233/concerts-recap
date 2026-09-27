import {localeTag, type Lang} from "@/i18n/config";

// Số nhiều theo Intl.PluralRules: tiếng Việt luôn rơi vào "other" nên bản vi chỉ cần điền hai nhánh giống nhau.
export interface Plural {
    one: string
    other: string
}

// "Đêm số {n}" + {n: 12} → "Đêm số 12". Biến thiếu thì giữ nguyên {tên} để lỗi lộ ra chứ không lặng lẽ mất chữ.
export function format(template: string, vars: Record<string, string | number> = {}): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function plural(lang: Lang, entry: Plural, n: number, vars: Record<string, string | number> = {}): string {
    const rule = new Intl.PluralRules(localeTag(lang)).select(n);
    return format(rule === "one" ? entry.one : entry.other, {n, ...vars});
}
