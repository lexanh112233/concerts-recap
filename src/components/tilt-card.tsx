"use client";

import {useRef, type PointerEvent, type ReactNode} from "react";

// Nghiêng 3D theo con trỏ chuột + ánh phản chiếu. Chỉ áp dụng với chuột; cảm ứng và
// prefers-reduced-motion giữ nguyên tĩnh.
export function TiltCard({children, className = "", max = 7}: {
    children: ReactNode
    className?: string
    // độ nghiêng tối đa (độ)
    max?: number
}) {
    const ref = useRef<HTMLDivElement>(null);
    const raf = useRef(0);

    const onMove = (e: PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== "mouse") return;
        const el = ref.current;
        if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const {clientX, clientY} = e;
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => {
            const r = el.getBoundingClientRect();
            const px = (clientX - r.left) / r.width;
            const py = (clientY - r.top) / r.height;
            el.style.setProperty("--td", "90ms");
            el.style.setProperty("--rx", `${((0.5 - py) * max * 2).toFixed(2)}deg`);
            el.style.setProperty("--ry", `${((px - 0.5) * max * 2).toFixed(2)}deg`);
            el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
            el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
            el.style.setProperty("--go", "1");
        });
    };

    const onLeave = () => {
        const el = ref.current;
        if (!el) return;
        cancelAnimationFrame(raf.current);
        el.style.setProperty("--td", "600ms");
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--go", "0");
    };

    return (
        <div className={`[perspective:1100px] ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
            <div
                ref={ref}
                className='relative will-change-transform'
                style={{
                    transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
                    transition: "transform var(--td, 600ms) ease-out",
                    transformStyle: "preserve-3d",
                }}>
                {children}
                <span
                    aria-hidden='true'
                    className='pointer-events-none absolute inset-0 mix-blend-soft-light'
                    style={{
                        opacity: "var(--go, 0)",
                        transition: "opacity 300ms ease-out",
                        background: "radial-gradient(circle at var(--gx, 50%) var(--gy, 0%), rgba(255,255,255,0.75), transparent 55%)",
                    }}
                />
            </div>
        </div>
    );
}
