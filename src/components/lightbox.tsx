"use client";

import {
    useEffect,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type WheelEvent as ReactWheelEvent,
} from "react";
import {createPortal} from "react-dom";
import {ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, Play, RotateCcw, X, ZoomIn, ZoomOut} from "lucide-react";
import {format} from "@/i18n/format";
import {useI18n} from "@/i18n/provider";
import type {IMedia} from "@/lib/concerts";

const MAX_SCALE = 5;
const TAP_SCALE = 2.5;
const BUTTON_STEP = 1.5;
const SWIPE_DISTANCE = 60;
const TAP_SLOP = 6;

interface View {
    s: number
    x: number
    y: number
    smooth: boolean
}

const INITIAL_VIEW: View = {s: 1, x: 0, y: 0, smooth: true};

type Gesture =
    | { type: "none" }
    | { type: "pan", sx: number, sy: number, vx: number, vy: number, moved: boolean }
    | { type: "pinch", dist0: number, s0: number, mid0: Point, t0: Point };

interface Point {
    x: number
    y: number
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Giữ ảnh không trôi khỏi khung: chỉ cho kéo khi ảnh phóng ra lớn hơn khung.
function clampView(v: View, stage: HTMLElement | null, img: HTMLElement | null): View {
    const s = clamp(v.s, 1, MAX_SCALE);
    if (!stage || !img || s === 1) return {...v, s, x: 0, y: 0};
    const maxX = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2);
    return {...v, s, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY)};
}

const FOCUSABLE = "button:not([disabled]), a[href], video[controls]";

function ToolbarButton({label, onClick, disabled, children, ...rest}: {
    label: string
    onClick?: () => void
    disabled?: boolean
    children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type='button'
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled}
            className='flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent'
            {...rest}>
            {children}
        </button>
    );
}

export function Lightbox({media, index, alt, onIndexChange, onClose}: {
    media: IMedia[]
    index: number
    alt: string
    onIndexChange: (index: number) => void
    onClose: () => void
}) {
    const {t} = useI18n();
    const item = media[index];
    const isVideo = item.isVideo;
    const total = media.length;

    const [view, setView] = useState<View>(INITIAL_VIEW);
    // ảnh chưa tải xong thì ẩn + hiện spinner, tránh khung trống rồi bật ra đột ngột
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
    const imgLoading = !isVideo && loadedSrc !== item.src;
    const dialogRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const pointers = useRef(new Map<number, Point>());
    const gesture = useRef<Gesture>({type: "none"});

    const goTo = (next: number) => {
        if (total < 2) return;
        setView(INITIAL_VIEW);
        pointers.current.clear();
        gesture.current = {type: "none"};
        onIndexChange((next + total) % total);
    };

    // toạ độ so với tâm khung, để zoom quanh đúng điểm bấm/con trỏ
    const relativeToStage = (clientX: number, clientY: number): Point => {
        const rect = stageRef.current!.getBoundingClientRect();
        return {x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + rect.height / 2)};
    };

    const zoomAt = (nextScale: number, p: Point, smooth: boolean) => {
        setView((v) => {
            const s = clamp(nextScale, 1, MAX_SCALE);
            const ratio = s / v.s;
            return clampView(
                {s, x: p.x - (p.x - v.x) * ratio, y: p.y - (p.y - v.y) * ratio, smooth},
                stageRef.current,
                imgRef.current,
            );
        });
    };

    const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
        const p = relativeToStage(e.clientX, e.clientY);
        zoomAt(view.s * Math.exp(-e.deltaY * 0.002), p, false);
    };

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});

        if (pointers.current.size === 1) {
            gesture.current = {type: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false};
        } else if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            gesture.current = {
                type: "pinch",
                dist0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
                s0: view.s,
                mid0: relativeToStage((a.x + b.x) / 2, (a.y + b.y) / 2),
                t0: {x: view.x, y: view.y},
            };
        }
        setView((v) => ({...v, smooth: false}));
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
        const g = gesture.current;

        if (g.type === "pinch" && pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()];
            const s = clamp(g.s0 * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist0), 1, MAX_SCALE);
            const mid = relativeToStage((a.x + b.x) / 2, (a.y + b.y) / 2);
            const ratio = s / g.s0;
            setView(clampView(
                {s, x: mid.x - (g.mid0.x - g.t0.x) * ratio, y: mid.y - (g.mid0.y - g.t0.y) * ratio, smooth: false},
                stageRef.current,
                imgRef.current,
            ));
        } else if (g.type === "pan") {
            const dx = e.clientX - g.sx;
            const dy = e.clientY - g.sy;
            if (Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
            if (view.s > 1) {
                setView(clampView({...view, x: g.vx + dx, y: g.vy + dy, smooth: false}, stageRef.current, imgRef.current));
            }
        }
    };

    const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.delete(e.pointerId);
        const g = gesture.current;

        if (g.type === "pan" && pointers.current.size === 0 && e.type === "pointerup") {
            const dx = e.clientX - g.sx;
            const dy = e.clientY - g.sy;
            if (!g.moved) {
                const rect = imgRef.current?.getBoundingClientRect();
                const onImage = !!rect
                    && e.clientX >= rect.left && e.clientX <= rect.right
                    && e.clientY >= rect.top && e.clientY <= rect.bottom;
                if (onImage) {
                    zoomAt(view.s > 1.05 ? 1 : TAP_SCALE, relativeToStage(e.clientX, e.clientY), true);
                } else {
                    onClose();
                }
            } else if (view.s === 1 && Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
                goTo(dx < 0 ? index + 1 : index - 1);
            }
        }

        if (pointers.current.size === 1) {
            // nhấc một ngón sau khi pinch: tiếp tục kéo bằng ngón còn lại
            const [rest] = [...pointers.current.values()];
            gesture.current = {type: "pan", sx: rest.x, sy: rest.y, vx: view.x, vy: view.y, moved: true};
        } else if (pointers.current.size === 0) {
            gesture.current = {type: "none"};
        }
        setView((v) => ({...v, smooth: true}));
    };

    // Phím tắt: dùng ref "mới nhất" để chỉ đăng ký listener một lần.
    const keyHandler = useRef<(e: KeyboardEvent) => void>(null);
    useEffect(() => {
        keyHandler.current = (e) => {
            switch (e.key) {
                case "Escape":
                    onClose();
                    break;
                case "ArrowLeft":
                    goTo(index - 1);
                    break;
                case "ArrowRight":
                    goTo(index + 1);
                    break;
                case "+":
                case "=":
                    if (!isVideo) zoomAt(view.s * BUTTON_STEP, {x: 0, y: 0}, true);
                    break;
                case "-":
                    if (!isVideo) zoomAt(view.s / BUTTON_STEP, {x: 0, y: 0}, true);
                    break;
                case "0":
                    setView(INITIAL_VIEW);
                    break;
                case "Tab": {
                    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
                    if (!nodes?.length) break;
                    const first = nodes[0];
                    const last = nodes[nodes.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                    return;
                }
                default:
                    return;
            }
            e.preventDefault();
        };
    });
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => keyHandler.current?.(e);
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    // Khóa cuộn trang phía sau và đưa focus vào hộp thoại.
    useEffect(() => {
        const {overflow, paddingRight} = document.body.style;
        const scrollbar = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
        closeRef.current?.focus();
        return () => {
            document.body.style.overflow = overflow;
            document.body.style.paddingRight = paddingRight;
        };
    }, []);

    // Tải trước ảnh kề bên để chuyển ảnh mượt hơn.
    useEffect(() => {
        for (const offset of [-1, 1]) {
            const neighbor = media[(index + offset + total) % total];
            if (neighbor && !neighbor.isVideo) new Image().src = neighbor.src;
        }
    }, [index, media, total]);

    const zoomPercent = Math.round(view.s * 100);

    return createPortal(
        <div
            ref={dialogRef}
            role='dialog'
            aria-modal='true'
            aria-label={format(t.lightbox.dialog, {alt})}
            className='fixed inset-0 z-50 flex flex-col bg-black/95 text-white animate-in fade-in duration-200'>
            <div className='flex items-center justify-between gap-3 px-3 py-2 sm:px-5'>
                <p className='text-sm font-medium tracking-[0.2em] text-white/70'>
                    {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                </p>
                <div className='flex items-center gap-1'>
                    {!isVideo && (
                        <>
                            <ToolbarButton label={t.lightbox.zoomOut} onClick={() => zoomAt(view.s / BUTTON_STEP, {x: 0, y: 0}, true)} disabled={view.s <= 1}>
                                <ZoomOut className='size-5'/>
                            </ToolbarButton>
                            <span className='w-12 text-center text-xs tabular-nums text-white/60' aria-live='polite'>{zoomPercent}%</span>
                            <ToolbarButton label={t.lightbox.zoomIn} onClick={() => zoomAt(view.s * BUTTON_STEP, {x: 0, y: 0}, true)} disabled={view.s >= MAX_SCALE}>
                                <ZoomIn className='size-5'/>
                            </ToolbarButton>
                            <ToolbarButton label={t.lightbox.reset} onClick={() => setView(INITIAL_VIEW)} disabled={view.s === 1}>
                                <RotateCcw className='size-5'/>
                            </ToolbarButton>
                        </>
                    )}
                    <a
                        href={item.src}
                        target='_blank'
                        rel='noreferrer'
                        aria-label={t.lightbox.openOriginal}
                        title={t.lightbox.openOriginal}
                        className='flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white'>
                        <ExternalLink className='size-5'/>
                    </a>
                    <button
                        ref={closeRef}
                        type='button'
                        aria-label={t.lightbox.close}
                        title={t.lightbox.close}
                        onClick={onClose}
                        className='flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white'>
                        <X className='size-5'/>
                    </button>
                </div>
            </div>

            <div className='relative min-h-0 flex-1'>
                {isVideo ? (
                    <div
                        ref={stageRef}
                        className='absolute inset-0 flex items-center justify-center p-2 sm:p-8'
                        onClick={(e) => e.target === e.currentTarget && onClose()}>
                        <video
                            key={item.src}
                            src={item.src}
                            controls
                            autoPlay
                            playsInline
                            className='max-h-full max-w-full'
                        />
                    </div>
                ) : (
                    <div
                        ref={stageRef}
                        className={`absolute inset-0 flex touch-none select-none items-center justify-center overflow-hidden ${view.s > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
                        onWheel={onWheel}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerEnd}
                        onPointerCancel={onPointerEnd}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            ref={imgRef}
                            key={item.src}
                            src={item.src}
                            alt={format(t.lightbox.imageAlt, {alt, n: index + 1})}
                            draggable={false}
                            onLoad={() => setLoadedSrc(item.src)}
                            onError={() => setLoadedSrc(item.src)}
                            className='max-h-full max-w-full select-none object-contain'
                            style={{
                                transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
                                opacity: imgLoading ? 0 : 1,
                                transition: `${view.smooth ? "transform 200ms ease-out, " : ""}opacity 300ms ease-out`,
                            }}
                        />
                        {imgLoading && (
                            <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
                                <LoaderCircle className='size-9 animate-spin text-white/60'/>
                            </div>
                        )}
                    </div>
                )}

                {total > 1 && (
                    <>
                        <button
                            type='button'
                            aria-label={t.lightbox.prev}
                            onClick={() => goTo(index - 1)}
                            className='absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur transition-colors hover:bg-black/80 sm:left-4'>
                            <ChevronLeft className='size-6'/>
                        </button>
                        <button
                            type='button'
                            aria-label={t.lightbox.next}
                            onClick={() => goTo(index + 1)}
                            className='absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur transition-colors hover:bg-black/80 sm:right-4'>
                            <ChevronRight className='size-6'/>
                        </button>
                    </>
                )}
            </div>

            {total > 1 && (
                <div className='flex justify-center gap-2 overflow-x-auto px-3 py-3'>
                    {media.map((m, i) => (
                        <button
                            key={m.src}
                            type='button'
                            aria-label={format(t.lightbox.view, {n: i + 1})}
                            aria-current={i === index}
                            ref={i === index ? (el) => el?.scrollIntoView({inline: "center", block: "nearest"}) : undefined}
                            onClick={() => goTo(i)}
                            className={`relative h-14 w-20 shrink-0 overflow-hidden bg-[#141414] transition-opacity ${i === index ? "opacity-100 outline outline-2 outline-accent" : "opacity-50 hover:opacity-80"}`}>
                            {m.isVideo ? (
                                <span className='flex h-full w-full items-center justify-center'>
                                    <Play className='size-5 text-white/80'/>
                                </span>
                            ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.src} alt='' loading='lazy' decoding='async' className='h-full w-full object-cover'/>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>,
        document.body,
    );
}
