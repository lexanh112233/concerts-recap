"use client";

import {useEffect, useRef, useState} from "react";
import {Expand, Layers, MicVocal} from "lucide-react";
import {useGallery} from "@/components/gallery-provider";
import {SmartMedia} from "@/components/smart-media";
import {TiltCard} from "@/components/tilt-card";
import {format} from "@/i18n/format";
import {useI18n} from "@/i18n/provider";
import {clampRatio, type IMedia} from "@/lib/concerts";

// Ba vị trí của chồng bài: trên cùng, thứ hai, thứ ba (x/y tính theo % kích thước tấm, r là độ xoay).
const SLOTS = [
    {x: 0, y: 0, r: -4},
    {x: 2, y: 1.5, r: 5},
    {x: -2, y: 2.5, r: -9},
];
// Vị trí tấm vừa được "chia" ra khỏi chồng, trước khi chui xuống đáy
const OUT = {x: 66, y: 2, r: 18};
const DEAL_MS = 320;

const place = (p: { x: number, y: number, r: number }) => `translate(${p.x}%, ${p.y}%) rotate(${p.r}deg)`;
const pad = (n: number) => String(n).padStart(2, "0");

// Một lá bài polaroid. Ảnh giữ NGUYÊN tỉ lệ thật (không crop): lá bài co lại cho vừa "sân khấu" 4:5 của cỗ bài
// (ảnh ngang thì rộng bằng sân khấu nhưng thấp hơn, ảnh quá dọc thì hẹp hơn), nên kích thước sân khấu không đổi khi chia bài.
// Tỉ lệ do server đo sẵn (media.ratio); chưa có thì tạm 4:5 rồi tự chỉnh khi ảnh/video tải xong.
function DeckCard({media, index, count, alt, rank, out, onDeal, onOpen}: {
    media: IMedia
    index: number
    count: number
    alt: string
    rank: number
    out: boolean
    onDeal: (byKeyboard: boolean) => void
    onOpen: (index: number, el: HTMLElement) => void
}) {
    const {t} = useI18n();
    const [measured, setMeasured] = useState<number | null>(null);
    const ratio = clampRatio(media.ratio ?? measured);

    return (
        <div
            // các lá bên dưới không được focus/bấm; chỉ lá trên cùng tương tác
            inert={rank !== 0}
            style={{
                "--r": ratio,
                transform: place(out ? OUT : SLOTS[Math.min(rank, 2)]),
                zIndex: out ? 40 : Math.max(0, 30 - rank * 10),
            } as React.CSSProperties}
            className={`relative place-self-center rounded-[6px] bg-paper p-2.5 pb-14 shadow-[0_40px_70px_-25px_rgba(0,0,0,0.9)] transition-[transform,opacity] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none w-[calc(min(100cqw-20px,(100cqh-66px)*var(--r))+20px)] ${out ? "duration-300" : "duration-[460ms]"} ${rank < 3 ? "opacity-100" : "opacity-0"}`}>
            <span aria-hidden='true' className={`tape absolute -top-3 left-8 z-10 h-6 w-20 -rotate-[8deg] transition-opacity ${rank === 0 ? "" : "opacity-0"}`}/>
            <span aria-hidden='true' className={`tape absolute -top-2 right-8 z-10 h-6 w-16 rotate-[6deg] transition-opacity ${rank === 0 ? "" : "opacity-0"}`}/>

            <div className='relative'>
                <button
                    type='button'
                    onClick={(e) => (count > 1 ? onDeal(e.detail === 0) : onOpen(index, e.currentTarget))}
                    data-deck-top={rank === 0}
                    aria-label={count > 1 ? format(t.poster.deal, {i: index + 1, n: count}) : format(t.poster.openLarge, {alt})}
                    className={`group relative block w-full overflow-hidden rounded-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${count > 1 ? "cursor-pointer" : "cursor-zoom-in"}`}>
                    <SmartMedia
                        media={media}
                        alt={`${alt} — ${index + 1}/${count}`}
                        ratio={String(ratio)}
                        sizes='(min-width: 1024px) 32vw, 80vw'
                        priority={index === 0}
                        autoplayInView={rank === 0}
                        onRatio={setMeasured}
                        mediaClassName='transition-transform duration-700 group-hover:scale-105'
                    />
                </button>
                {count > 1 && (
                    <button
                        type='button'
                        onClick={(e) => onOpen(index, e.currentTarget)}
                        aria-label={format(t.poster.zoom, {n: index + 1})}
                        className='absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/60 text-white opacity-70 backdrop-blur transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'>
                        <Expand className='size-4'/>
                    </button>
                )}
            </div>

            <div className='absolute inset-x-3 bottom-3 flex items-center justify-between gap-3'>
                <p className='truncate font-playfair-display text-lg italic text-charcoal'>{alt}</p>
                {count > 1 && (
                    <span className='flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-charcoal/70'>
                        <Layers className='size-3.5 text-accent'/>
                        {pad(index + 1)}/{pad(count)}
                    </span>
                )}
            </div>
        </div>
    );
}

// Chồng polaroid ở hero là một cỗ bài các ảnh của đêm nhạc: bấm ảnh trên cùng thì lá đó "được chia" bay ra rồi chui xuống đáy chồng,
// ảnh kế tiếp lên trên. Nút góc ảnh mở lightbox ở đúng lá đang xem. Chỉ có một ảnh thì bấm là mở lightbox luôn;
// các tờ giấy trống thò ra phía sau lấp chỗ cho đủ ba lớp.
export function PosterCard({className = ""}: { className?: string }) {
    const {t} = useI18n();
    const {media, alt, open} = useGallery();
    const count = media.length;
    // order[0] là chỉ số ảnh đang nằm trên cùng
    const [order, setOrder] = useState(() => media.map((_, i) => i));
    const [dealing, setDealing] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const root = useRef<HTMLDivElement>(null);
    const refocus = useRef(false);

    useEffect(() => () => clearTimeout(timer.current), []);

    // Lá vừa được chia trở thành inert nên mất focus; nếu người dùng đang dùng bàn phím thì chuyển focus sang lá mới ở trên cùng
    useEffect(() => {
        if (!refocus.current) return;
        refocus.current = false;
        root.current?.querySelector<HTMLElement>("[data-deck-top='true']")?.focus({preventScroll: true});
    }, [order]);

    const deal = (byKeyboard: boolean) => {
        if (dealing) return;
        refocus.current = byKeyboard;
        setDealing(true);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // pha 1: lá trên cùng bay ra; pha 2 (sau DEAL_MS): đưa xuống đáy, mọi lá khác dịch lên một bậc
        timer.current = setTimeout(() => {
            setOrder((o) => [...o.slice(1), o[0]]);
            setDealing(false);
        }, reduce ? 0 : DEAL_MS);
    };

    const sheetStart = Math.max(count, 1);

    return (
        // @container + sân khấu size-container: kích thước sân khấu chỉ phụ thuộc bề rộng nên cố định trước khi ảnh tải
        <div ref={root} className={`@container relative ${className}`}>
            <TiltCard max={4}>
                <div className='grid h-[calc(1.25*(100cqw-20px)+66px)] [container-type:size] [&>*]:col-start-1 [&>*]:row-start-1'>
                    {/* giấy trống lấp các lớp còn thiếu khi có ít hơn ba ảnh */}
                    {SLOTS.slice(sheetStart).map((slot, k) => (
                        <div
                            key={`sheet-${k}`}
                            aria-hidden='true'
                            style={{transform: place(slot), zIndex: 30 - (sheetStart + k) * 10}}
                            className={`rounded-[6px] shadow-[0_24px_36px_-16px_rgba(0,0,0,0.85)] ${sheetStart + k === 1 ? "bg-[#d6d1c6]" : "bg-paper/90"}`}
                        />
                    ))}

                    {count === 0 && (
                        <div style={{transform: place(SLOTS[0]), zIndex: 30}} className='relative rounded-[6px] bg-paper p-2.5 pb-14 shadow-[0_40px_70px_-25px_rgba(0,0,0,0.9)]'>
                            <div className='flex size-full items-center justify-center bg-gradient-to-br from-accent/40 to-stage-2'>
                                <MicVocal className='size-16 text-paper/30'/>
                            </div>
                            <p className='absolute inset-x-3 bottom-3 truncate font-playfair-display text-lg italic text-charcoal'>{alt}</p>
                        </div>
                    )}

                    {media.map((m, i) => {
                        const rank = order.indexOf(i);
                        return (
                            <DeckCard
                                key={i}
                                media={m}
                                index={i}
                                count={count}
                                alt={alt}
                                rank={rank}
                                out={dealing && rank === 0}
                                onDeal={deal}
                                onOpen={open}
                            />
                        );
                    })}
                </div>
            </TiltCard>
            <p className='sr-only' aria-live='polite'>{count > 1 ? format(t.poster.viewing, {i: order[0] + 1, n: count}) : ""}</p>
        </div>
    );
}
