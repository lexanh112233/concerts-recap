"use client";

import {createContext, useContext, type ReactNode} from "react";
import type {Lang} from "@/i18n/config";
import type {Dict} from "@/i18n/dictionaries/types";

interface I18nValue {
    lang: Lang
    t: Dict
}

const Context = createContext<I18nValue | null>(null);

// Mỗi root layout (app/(vi), app/en/(site), app/admin, app/en/(admin)) bọc một provider với từ điển của mình; client component dùng useI18n().
// Server component không dùng được context nên nhận `lang` qua props rồi gọi getDict(lang) (i18n/server.ts).
export function I18nProvider({lang, dict, children}: { lang: Lang, dict: Dict, children: ReactNode }) {
    return <Context.Provider value={{lang, t: dict}}>{children}</Context.Provider>;
}

export function useI18n(): I18nValue {
    const value = useContext(Context);
    if (!value) throw new Error("useI18n phải nằm trong <I18nProvider> (đặt ở root layout)");
    return value;
}
