"use client";

import {useEffect, useRef, type ReactNode} from "react";

// Lớp nền trượt chậm hơn nội dung khi cuộn. Nên đặt lớn hơn khung chứa (vd. -inset-y-[12%]).
export function ParallaxLayer({children, className = "", speed = 0.15}: {
    children: ReactNode
    className?: string
    speed?: number
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        let raf = 0;

        const update = () => {
            raf = 0;
            const y = window.scrollY;
            // hết khung nhìn thì thôi cập nhật
            if (y > window.innerHeight * 1.5) return;
            el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
        };
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(update);
        };

        update();
        window.addEventListener("scroll", onScroll, {passive: true});
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [speed]);

    return <div ref={ref} className={`will-change-transform ${className}`}>{children}</div>;
}
