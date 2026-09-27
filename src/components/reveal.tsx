"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({children, className, delay = 0}: {
    children: ReactNode;
    className?: string;
    // ms, để các phần tử cùng hàng hiện lần lượt
    delay?: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            {threshold: 0.1, rootMargin: "0px 0px -40px 0px"}
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            style={delay ? {transitionDelay: `${delay}ms`} : undefined}
            className={`transition-all duration-700 ease-out motion-reduce:transition-none ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 motion-reduce:opacity-100 motion-reduce:translate-y-0"} ${className ?? ""}`}
        >
            {children}
        </div>
    );
}
