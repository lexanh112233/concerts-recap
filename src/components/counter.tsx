"use client";

import { useEffect, useState } from "react";

export function Counter({className, value, duration = 1200}: {
    className?: string;
    value: number;
    duration?: number;
}) {
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        let frame: number;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const start = performance.now();

        const tick = (now: number) => {
            const progress = reduceMotion ? 1 : Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(value * eased));
            if (progress < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value, duration]);

    // tabular-nums + độ rộng tối thiểu để số đếm không làm rung layout xung quanh
    return (
        <span
            className={`inline-block tabular-nums ${className ?? ""}`}
            style={{minWidth: `${String(value).length}ch`}}>
            {display}
        </span>
    );
}
