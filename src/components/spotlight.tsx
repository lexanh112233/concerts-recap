"use client";

import {useEffect, useRef} from "react";

// Ánh đèn sân khấu chạy theo con trỏ. Phần tử cha phải có position (relative/absolute...).
export function Spotlight({className = ""}: { className?: string }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        const parent = el?.parentElement;
        if (!el || !parent) return;
        let raf = 0;

        const onMove = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            const {clientX, clientY} = e;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const r = parent.getBoundingClientRect();
                el.style.setProperty("--mx", `${clientX - r.left}px`);
                el.style.setProperty("--my", `${clientY - r.top}px`);
            });
        };

        parent.addEventListener("pointermove", onMove, {passive: true});
        return () => {
            cancelAnimationFrame(raf);
            parent.removeEventListener("pointermove", onMove);
        };
    }, []);

    return <div ref={ref} aria-hidden='true' className={`spotlight pointer-events-none absolute inset-0 ${className}`}/>;
}
