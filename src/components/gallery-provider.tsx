"use client";

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode} from "react";
import type {Lightbox as LightboxComponent} from "@/components/lightbox";
import type {IMedia} from "@/lib/concerts";

// Lightbox (~400 dòng, có xử lý cử chỉ/bàn phím) chỉ cần khi bấm mở ảnh nên tách khỏi bundle đầu của trang.
// Tự giữ component trong state thay vì dùng lazy()/next/dynamic: hai cách đó bọc trong Suspense, mà React chỉ cho nội dung hiện ra sau
// ~300ms kể từ lúc hiện fallback dù chunk đã có sẵn; đo trên bản build thì bấm mở luôn trễ ~300ms. Với state, chunk tải trước lúc rảnh
// nên lúc bấm mở là render ngay, không có fallback và không có khung tối nháy lên trước lightbox thật.
type LightboxView = ComponentType<Parameters<typeof LightboxComponent>[0]>;

// Poster ở hero và dải phim cùng mở một lightbox, nên state nằm ở provider chung.
interface GalleryContext {
    media: IMedia[]
    alt: string
    open: (index: number, trigger?: HTMLElement | null) => void
}

const Context = createContext<GalleryContext | null>(null);

export function useGallery() {
    const ctx = useContext(Context);
    if (!ctx) throw new Error("useGallery phải nằm trong <GalleryProvider>");
    return ctx;
}

export function GalleryProvider({media, alt, children}: {
    media: IMedia[]
    alt: string
    children: ReactNode
}) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [View, setView] = useState<LightboxView | null>(null);
    const trigger = useRef<HTMLElement | null>(null);

    // import() nhiều lần vẫn chỉ tải một lần; chưa tải xong thì lightbox hiện ngay khi chunk về tới
    const load = useCallback(() => {
        import("@/components/lightbox").then((m) => setView(() => m.Lightbox)).catch(() => undefined);
    }, []);

    // tải sẵn lúc trình duyệt rảnh (Safari chưa có requestIdleCallback nên dùng setTimeout) để không tranh băng thông với ảnh đầu trang
    useEffect(() => {
        if (typeof window.requestIdleCallback === "function") {
            const id = window.requestIdleCallback(load, {timeout: 3000});
            return () => window.cancelIdleCallback(id);
        }
        const id = window.setTimeout(load, 2000);
        return () => window.clearTimeout(id);
    }, [load]);

    const open = useCallback((index: number, el?: HTMLElement | null) => {
        trigger.current = el ?? null;
        setOpenIndex(index);
        load();
    }, [load]);

    const close = () => {
        setOpenIndex(null);
        // trả focus về phần tử đã mở lightbox, không cuộn trang
        const el = trigger.current;
        requestAnimationFrame(() => {
            if (el?.isConnected) el.focus({preventScroll: true});
        });
    };

    const value = useMemo(() => ({media, alt, open}), [media, alt, open]);

    return (
        <Context.Provider value={value}>
            {children}
            {openIndex !== null && View && (
                <View media={media} index={openIndex} alt={alt} onIndexChange={setOpenIndex} onClose={close}/>
            )}
        </Context.Provider>
    );
}
