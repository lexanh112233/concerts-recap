"use client";

import {createContext, useContext, type ReactNode} from "react";
import type {Lang} from "@/i18n/config";
import type {AdminDict} from "@/i18n/admin/dictionaries/types";

interface AdminI18nValue {
    lang: Lang
    t: AdminDict
}

const Context = createContext<AdminI18nValue | null>(null);

// Layout admin bọc một provider với từ điển của ngôn ngữ đang chọn (cookie); client component dùng useAdminI18n().
export function AdminI18nProvider({lang, dict, children}: { lang: Lang, dict: AdminDict, children: ReactNode }) {
    return <Context.Provider value={{lang, t: dict}}>{children}</Context.Provider>;
}

export function useAdminI18n(): AdminI18nValue {
    const value = useContext(Context);
    if (!value) throw new Error("useAdminI18n phải nằm trong <AdminI18nProvider> (đặt ở admin/layout.tsx)");
    return value;
}
