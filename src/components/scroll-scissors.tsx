"use client";

import {useEffect, useRef} from "react";
import {Scissors} from "lucide-react";

// Thanh tiến độ đọc: đường đứt chạy ngang mép trên màn hình, chiếc kéo đi theo tiến độ cuộn
// và phần đã "cắt" đổi sang màu accent. Chỉ đụng transform/clip-path của phần tử nhỏ cố định nên không gây reflow.
export function ScrollScissors() {
    const cut = useRef<HTMLDivElement>(null);
    const blade = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const cutEl = cut.current;
        const bladeEl = blade.current;
        if (!cutEl || !bladeEl) return;
        let raf = 0;

        const update = () => {
            raf = 0;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
            cutEl.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`;
            bladeEl.style.transform = `translate3d(${(p * (window.innerWidth - 18)).toFixed(1)}px, 0, 0)`;
        };
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(update);
        };

        update();
        window.addEventListener("scroll", onScroll, {passive: true});
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <div aria-hidden='true' className='pointer-events-none fixed inset-x-0 top-0 z-50 h-[18px]'>
            <div className='dash-line absolute inset-x-0 top-2 h-[2px] text-white/25'/>
            <div ref={cut} className='dash-line absolute inset-x-0 top-2 h-[2px] text-accent [clip-path:inset(0_100%_0_0)]'/>
            <div ref={blade} className='absolute left-0 top-0 text-accent will-change-transform'>
                <Scissors className='size-[18px] -rotate-90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'/>
            </div>
        </div>
    );
}
