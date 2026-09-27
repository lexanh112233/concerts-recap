"use client";

import {useCallback, useRef, useState, type PointerEvent, type RefObject} from "react";
import {Play, Shuffle} from "lucide-react";
import {useGallery} from "@/components/gallery-provider";
import {SmartMedia} from "@/components/smart-media";
import {format, plural} from "@/i18n/format";
import {useI18n} from "@/i18n/provider";
import {clampRatio, hashString, type IMedia} from "@/lib/concerts";

const DRAG_THRESHOLD = 5;
const ZERO = {x: 0, y: 0};

// Góc xoay/độ lệch suy ra từ hash nên ổn định giữa các lần tải; `seed` đổi khi bấm "Xếp lại".
function poseOf(slug: string, i: number, seed: number) {
    const h = hashString(`${slug}:${i}:${seed}`);
    const sign = h & 1 ? 1 : -1;
    return {
        rot: sign * (1.5 + ((h >>> 1) % 750) / 100),
        dx: ((h >>> 9) % 33) - 16,
        dy: ((h >>> 15) % 25) - 12,
    };
}

interface DragState {
    x: number
    y: number
    ox: number
    oy: number
    // biên cho phép của độ dịch, để tấm ảnh không bị kéo ra khỏi mặt bàn
    minX: number
    maxX: number
    minY: number
    maxY: number
    moved: boolean
}

function Polaroid({slug, index, media, alt, seed, deskRef, nextZ, onOpen}: {
    slug: string
    index: number
    media: IMedia
    alt: string
    seed: number
    deskRef: RefObject<HTMLDivElement | null>
    nextZ: () => number
    onOpen: (index: number, el: HTMLElement) => void
}) {
    const {t} = useI18n();
    const baseZ = 1 + (index % 3);
    const [offset, setOffset] = useState(ZERO);
    const [z, setZ] = useState(baseZ);
    const [dragging, setDragging] = useState(false);
    const [seenSeed, setSeenSeed] = useState(seed);
    const drag = useRef<DragState | null>(null);
    const suppressClick = useRef(false);

    // "Xếp lại": trả tấm ảnh về vị trí gốc theo bộ góc xoay mới (điều chỉnh state ngay lúc render theo prop)
    if (seenSeed !== seed) {
        setSeenSeed(seed);
        setOffset(ZERO);
        setZ(baseZ);
    }

    const pose = poseOf(slug, index, seed);
    const decor = hashString(`${slug}:${index}`) % 3;
    const tapeTilt = -6 + (hashString(`${slug}:t${index}`) % 13);
    // Ảnh giữ NGUYÊN tỉ lệ thật (không crop). Tỉ lệ do server đo sẵn nên khung có hình dạng đúng ngay từ đầu, không giật khi ảnh tải xong;
    // chưa đo được (vd. video webm) thì tạm 4:5 rồi tự chỉnh khi trình duyệt đọc xong. Bề rộng tỉ lệ với căn bậc hai của tỉ lệ để
    // ảnh ngang và ảnh dọc có diện tích na ná nhau thay vì ảnh ngang to hơn hẳn.
    const [measured, setMeasured] = useState<number | null>(null);
    const ratio = clampRatio(media.ratio ?? measured);
    const widthFactor = Math.min(1.4, Math.max(0.85, Math.sqrt(ratio / 0.8)));

    const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
        // chỉ chuột trái mới kéo; cảm ứng/bút để trình duyệt xử lý cuộn và bấm như bình thường
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        const el = e.currentTarget;
        const deskBox = deskRef.current?.getBoundingClientRect();
        if (!deskBox) return;
        el.setPointerCapture(e.pointerId);
        const box = el.getBoundingClientRect();
        const slack = 24;
        drag.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
            minX: offset.x - (box.left - deskBox.left) - slack,
            maxX: offset.x + (deskBox.right - box.right) + slack,
            minY: offset.y - (box.top - deskBox.top) - slack,
            maxY: offset.y + (deskBox.bottom - box.bottom) + slack,
            moved: false,
        };
        suppressClick.current = false;
        setZ(nextZ());
        setDragging(true);
    };

    const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        d.moved = true;
        setOffset({
            x: Math.min(d.maxX, Math.max(d.minX, d.ox + dx)),
            y: Math.min(d.maxY, Math.max(d.minY, d.oy + dy)),
        });
    };

    const endDrag = (e: PointerEvent<HTMLButtonElement>, released: boolean) => {
        // thả sau khi đã kéo: sự kiện click ngay sau đó không được mở lightbox
        if (released && drag.current?.moved) {
            suppressClick.current = true;
            setTimeout(() => {
                suppressClick.current = false;
            }, 0);
        }
        drag.current = null;
        setDragging(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Tấm đang cầm thẳng lại và nổi lên; còn lại nằm nghiêng trên bàn
    const transform = `translate(${pose.dx + offset.x}px, ${pose.dy + offset.y}px) rotate(${dragging ? 0 : pose.rot}deg) scale(${dragging ? 1.05 : 1})`;

    return (
        <div
            style={{"--f": widthFactor} as React.CSSProperties}
            className='w-[calc((50%-0.5rem)*var(--f))] md:w-[calc((33.333%-1.4rem)*var(--f))] md:even:mt-10'>
            <button
                type='button'
                aria-label={format(t.desk.openPhoto, {n: index + 1, alt})}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => endDrag(e, true)}
                onPointerCancel={(e) => endDrag(e, false)}
                onDragStart={(e) => e.preventDefault()}
                onClick={(e) => {
                    if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                    }
                    onOpen(index, e.currentTarget);
                }}
                style={{transform, zIndex: z}}
                className={`group relative block w-full select-none rounded-[4px] bg-paper p-2 pb-9 text-left hover:cursor-grab focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-2.5 sm:pb-11 [&_img]:pointer-events-none [&_video]:pointer-events-none ${dragging
                    ? "cursor-grabbing shadow-[0_36px_50px_-14px_rgba(0,0,0,0.95)] transition-none"
                    : "shadow-[0_20px_32px_-14px_rgba(0,0,0,0.85)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"}`}>
                {decor === 0 && <span aria-hidden='true' style={{rotate: `${tapeTilt}deg`}} className='tape absolute -top-3 left-1/2 z-10 h-6 w-16 -translate-x-1/2'/>}
                {decor === 1 && (
                    <span aria-hidden='true' className='absolute -top-2 left-1/2 z-10 size-4 -translate-x-1/2 rounded-full bg-accent shadow-[inset_-2px_-2px_3px_rgba(0,0,0,0.35),inset_2px_2px_2px_rgba(255,255,255,0.35),0_4px_5px_rgba(0,0,0,0.5)]'/>
                )}
                {decor === 2 && <span aria-hidden='true' style={{rotate: `${-45 + tapeTilt}deg`}} className='tape absolute -left-4 top-2 z-10 h-5 w-14'/>}
                <SmartMedia
                    media={media}
                    alt={format(t.desk.momentAlt, {alt, n: index + 1})}
                    ratio={String(ratio)}
                    sizes='(min-width: 768px) 40vw, 70vw'
                    onRatio={setMeasured}
                />
                {media.isVideo && (
                    <span aria-hidden='true' className='absolute right-3.5 top-3.5 flex size-7 items-center justify-center rounded-full bg-black/65 sm:right-4 sm:top-4'>
                        <Play className='size-3.5 fill-white text-white'/>
                    </span>
                )}
                <span className='absolute inset-x-3 bottom-2.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-charcoal/60 sm:bottom-3.5'>
                    <span>№ {String(index + 1).padStart(2, "0")}</span>
                    {media.isVideo && <span>{t.desk.video}</span>}
                </span>
            </button>
        </div>
    );
}

// Bàn ảnh: mọi ảnh của đêm nhạc vương vãi như polaroid. Trên máy có chuột kéo được từng tấm (tấm đang cầm nổi lên
// trên cùng), bấm không kéo thì mở lightbox; có nút "Xếp lại". Cảm ứng chỉ bấm, vẫn cuộn trang bình thường.
export function PolaroidDesk({slug, sectionNo}: { slug: string, sectionNo: string }) {
    const {lang, t} = useI18n();
    const {media, alt, open} = useGallery();
    // bàn ảnh có đủ mọi ảnh (kể cả ảnh bìa đang là lá trên cùng của cỗ bài ở hero)
    const items = media;
    const [seed, setSeed] = useState(0);
    const desk = useRef<HTMLDivElement>(null);
    const zCounter = useRef(10);

    const nextZ = useCallback(() => ++zCounter.current, []);
    const onOpen = useCallback((index: number, el: HTMLElement) => open(index, el), [open]);

    if (items.length === 0) return null;

    return (
        <section aria-label={t.desk.label} className='mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 md:px-10 md:py-20'>
            <div className='mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4'>
                <div className='flex flex-col gap-3'>
                    <h2 className='font-playfair-display text-3xl font-bold text-white md:text-5xl'>
                        {plural(lang, t.desk.count, items.length)} <span className='italic text-accent'>{t.desk.onTheDesk}</span>
                    </h2>
                </div>
                <div className='flex items-center gap-4'>
                    <p className='hidden text-xs text-paper/50 [@media(hover:hover)]:block'>{t.desk.hint}</p>
                    <button
                        type='button'
                        onClick={() => setSeed((s) => s + 1)}
                        className='flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-paper/85 transition-colors hover:border-white/40 hover:text-white'>
                        <Shuffle className='size-4'/>
                        {t.desk.shuffle}
                    </button>
                </div>
            </div>

            {/* isolate: z-index của các tấm ảnh chỉ có nghĩa trong mặt bàn, không đè lên thanh header cố định */}
            <div
                ref={desk}
                className='board relative isolate flex flex-wrap items-start justify-center gap-x-4 gap-y-10 rounded-2xl border border-dashed border-white/15 bg-[#0d0d0d] px-4 pb-14 pt-12 md:gap-x-8 md:px-10 md:pb-20 md:pt-16'>
                {items.map((m, i) => (
                    <Polaroid
                        key={m.src}
                        slug={slug}
                        index={i}
                        media={m}
                        alt={alt}
                        seed={seed}
                        deskRef={desk}
                        nextZ={nextZ}
                        onOpen={onOpen}
                    />
                ))}
            </div>
        </section>
    );
}
