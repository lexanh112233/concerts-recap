"use client";

import Link from "next/link";
import {useState, type CSSProperties} from "react";
import {MicVocal, Play, Scissors} from "lucide-react";
import {Rating} from "@/components/rating";
import {SmartMedia} from "@/components/smart-media";
import {Barcode} from "@/components/barcode";
import {pathFor} from "@/i18n/config";
import {format} from "@/i18n/format";
import {useI18n} from "@/i18n/provider";
import {hasCompanion, hashString, type ICard} from "@/lib/concerts";
import {foilStyle} from "@/lib/foil";

const GRID_TILTS = [-3, 1.5, -1.5, 2.5, -2.5, 2];
const BOARD_TILTS = [-6, 4, -3, 6, -5, 2, 5, -2];

const pad = (n: number) => String(n).padStart(2, "0");

// Tấm vé dọc gồm hai phần: thân (ảnh + tên) và cuống (khu/hàng/ghế + mã vạch) ngăn cách bằng đường đứt.
// Tỉ lệ khung cố định (aspect-[5/9]) và mọi cỡ chữ tính theo bề rộng thẻ (cqw) nên bố cục không đổi khi ảnh tải xong.
export function TicketCard({card, variant = "grid"}: { card: ICard, variant?: "grid" | "board" }) {
    const {lang, t} = useI18n();
    const [active, setActive] = useState(false);
    const board = variant === "board";

    // ngẫu nhiên nhưng ổn định theo slug: cùng một vé luôn nghiêng/đổi màu giống nhau giữa các lần tải
    const h = hashString(card.slug);
    const tilts = board ? BOARD_TILTS : GRID_TILTS;
    // giấy platinum nhiều tông theo slug (xem lib/foil.ts); mực luôn tối nên đủ tương phản
    const style = {
        ...foilStyle(card.slug, card.tone),
        "--tilt": `${tilts[(h >>> 3) % tilts.length]}deg`,
        "--dx": `${((h >>> 5) % 33) - 16}px`,
        "--dy": `${((h >>> 9) % 25) - 12}px`,
        "--s": 0.9 + ((h >>> 13) % 17) / 100,
        "--z": 1 + ((h >>> 17) % 5),
        "--tape": `${((h >>> 22) % 13) - 6}deg`,
    } as CSSProperties;
    const tape = (h >>> 21) % 2 === 0;
    // vé và vầng sáng phía sau phải nghiêng/nhấc y hệt nhau nên dùng chung một chuỗi class
    const tiltClass = board
        ? "[transform:translate(var(--dx),var(--dy))_rotate(var(--tilt))_scale(var(--s))] group-hover:[transform:translate(0,-12px)_rotate(0deg)_scale(1.08)] group-focus-visible:[transform:translate(0,-12px)_rotate(0deg)_scale(1.08)]"
        : "[transform:rotate(var(--tilt))] group-hover:[transform:translateY(-10px)_rotate(0deg)] group-focus-visible:[transform:translateY(-10px)_rotate(0deg)]";

    const seat = [
        {key: "zone", label: t.ticket.zone, value: card.zone},
        {key: "row", label: t.ticket.row, value: card.row},
        {key: "seat", label: t.ticket.seat, value: card.seat},
    ].filter((f) => f.value);

    return (
        <Link
            href={pathFor(lang, `/concerts/${card.slug}`)}
            aria-label={`${card.title} — ${card.artistName}`}
            onPointerEnter={(e) => e.pointerType === "mouse" && setActive(true)}
            onPointerLeave={() => setActive(false)}
            onFocus={() => setActive(true)}
            onBlur={() => setActive(false)}
            style={style}
            className={`group relative z-[var(--z)] block outline-none hover:z-40 focus-visible:z-40 ${board ? "mx-auto w-full max-w-[270px] sm:max-w-none" : "mx-auto w-full max-w-[340px]"}`}>
            {/* vầng sáng nằm NGOÀI wrapper filter/mask bên dưới, không bị cắt và không làm filter phải vẽ lại mỗi khung hình */}
            <div aria-hidden='true' className={`pointer-events-none absolute inset-0 transition-transform duration-300 ease-out motion-reduce:transition-none ${tiltClass}`}>
                {/* hai mảnh khớp với thân vé (76%) và cuống vé (24%); cuống xoay/tách y hệt cuống thật khi rê chuột nên vầng sáng luôn ôm sát vé */}
                <div className='grid h-full grid-rows-[76fr_24fr]'>
                    <div className='relative'>
                        <span className='aura [--aura-r:12px_12px_0_0]'/>
                    </div>
                    <div className='relative origin-top-left transition-transform duration-300 ease-out group-hover:[transform:rotate(3deg)_translate(4px,6px)] group-focus-visible:[transform:rotate(3deg)_translate(4px,6px)] motion-reduce:transition-none'>
                        <span className='aura [--aura-r:0_0_12px_12px]'/>
                    </div>
                </div>
            </div>
            <div style={{filter: "drop-shadow(0 16px 18px rgba(0,0,0,0.55))"}}>
                <div
                    className={`@container relative aspect-[5/9] w-full transition-transform duration-300 ease-out motion-reduce:transition-none ${tiltClass}`}>
                    <div className='grid h-full grid-rows-[76fr_24fr]'>
                        {/* THÂN VÉ */}
                        <div className='cut-bottom relative flex min-h-0 flex-col gap-[2.4cqw] rounded-t-xl px-[4cqw] pb-[3.4cqw] pt-[3cqw] text-charcoal foil foil-body glitter'>
                            <div className='flex border-b border-charcoal/25 pb-[1.6cqw] font-mono text-[clamp(7.5px,2.6cqw,10px)] uppercase tracking-[0.2em] text-charcoal/75'>
                                {card.no && <span className='ml-auto'>NO. {card.no}</span>}
                            </div>

                            <div className='relative min-h-0 flex-1'>
                                <div className='absolute inset-0 overflow-hidden rounded-[3px] bg-charcoal p-[2px]'>
                                    <div className='relative size-full overflow-hidden rounded-[2px] bg-charcoal/20'>
                                        {card.cover ? (
                                            <SmartMedia
                                                media={card.cover}
                                                alt={card.artistName}
                                                sizes='(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 520px) 45vw, 90vw'
                                                className='absolute inset-0'
                                                mediaClassName='transition-transform duration-700 group-hover:scale-105'
                                                position='50% 30%'
                                                active={active}
                                            />
                                        ) : (
                                            <div className='absolute inset-0 flex items-center justify-center'>
                                                <MicVocal className='size-10 text-charcoal/30'/>
                                            </div>
                                        )}
                                        {card.cover?.isVideo && (
                                            <span className='absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/60'>
                                                <Play className='size-3 fill-white text-white'/>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* dấu mộc ngày */}
                                {card.day && card.month && (
                                    <div className='absolute bottom-[3cqw] right-[3cqw] flex size-[17cqw] rotate-[-10deg] flex-col items-center justify-center rounded-full border-2 border-accent bg-[var(--f1)]/95 leading-none text-accent shadow-[0_2px_6px_rgba(0,0,0,0.35)]'>
                                        <span className='font-mono text-[clamp(6px,2cqw,8px)] uppercase tracking-widest'>{t.date.monthsShort[card.month - 1]}</span>
                                        <span className='font-display text-[clamp(16px,6.2cqw,22px)] font-bold'>{pad(card.day)}</span>
                                        <span className='font-mono text-[clamp(6px,2cqw,8px)] tracking-widest'>{card.year}</span>
                                    </div>
                                )}
                            </div>

                            <div className='flex h-fit shrink-0 flex-col gap-[0.8cqw] overflow-hidden'>
                                <p className='line-clamp-2 font-display text-[clamp(15px,7.2cqw,25px)] font-bold uppercase tracking-tight leading-[1.2]'>{card.title}</p>
                                <p className='truncate font-playfair-display text-[clamp(11px,4cqw,14px)] italic text-charcoal/80'>{card.artistName}</p>
                                {card.place && (
                                    <p className='truncate font-mono text-[clamp(10px,2.6cqw,12px)] uppercase tracking-wider text-charcoal/90 font-medium'>{card.place}</p>
                                )}
                            </div>
                        </div>

                        {/* CUỐNG VÉ: đường đứt + khuyết tròn; rê chuột thì cuống xoay nhẹ như bị xé */}
                        <div className='cut-top relative flex min-h-0 origin-top-left flex-col justify-between rounded-b-xl border-t-2 border-dashed border-charcoal/35 foil foil-stub glitter px-[4cqw] pb-[3cqw] pt-[5.6cqw] pr-[8cqw] text-charcoal transition-transform duration-300 ease-out group-hover:[transform:rotate(3deg)_translate(4px,6px)] group-focus-visible:[transform:rotate(3deg)_translate(4px,6px)] motion-reduce:transition-none'>
                            <Scissors className='absolute left-[5cqw] top-[0.6cqw] size-[3.6cqw] min-h-2.5 min-w-2.5 -rotate-90 text-charcoal/45' aria-hidden='true'/>
                            {seat.length > 0 ? (
                                // Zone rộng gấp đôi Hàng/Ghế: tên khu thường dài ("Huyền Thoại"), còn hàng/ghế chỉ vài ký tự
                                <div
                                    style={{gridTemplateColumns: seat.map((f) => f.key === "zone" ? "minmax(0,2fr)" : "minmax(0,1fr)").join(" ")}}
                                    className='grid gap-[2cqw] font-mono uppercase leading-none'>
                                    {seat.map((f) => (
                                        <div key={f.key} className='min-w-0'>
                                            <p className='text-[clamp(7px,2.7cqw,10px)] tracking-[0.15em] text-charcoal/70'>{f.label}</p>
                                            <p className='mt-[0.8cqw] truncate text-[clamp(11px,4.2cqw,15px)] font-bold tracking-wide'>{f.value}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className='font-mono text-[clamp(8px,3cqw,11px)] uppercase tracking-[0.15em] text-charcoal/70'>{t.ticket.standingArea}</p>
                            )}
                            <div className='flex items-end justify-between gap-[3cqw]'>
                                <div className='flex min-w-0 flex-col gap-[1.2cqw]'>
                                    <Rating value={card.rating} label={format(t.rating.stars, {n: Math.round(card.rating)})} tone='light' className='size-[3.6cqw] min-h-2.5 min-w-2.5'/>
                                    {hasCompanion(card.companion) && (
                                        <p className='truncate font-mono text-[clamp(6.5px,2.2cqw,9px)] uppercase tracking-wider text-charcoal/75'>{format(t.ticket.withCompanion, {name: card.companion})}</p>
                                    )}
                                </div>
                                <div className='flex w-[40%] shrink-0 flex-col items-end gap-[0.8cqw] [&_svg]:h-[8cqw]'>
                                    <Barcode seed={card.slug}/>
                                    {/* giá in nhỏ dưới mã vạch như trên cuống vé thật; chưa có giá thì không hiện gì */}
                                    {card.priceLabel && (
                                        <p className='max-w-full truncate font-mono text-[clamp(6.5px,2.6cqw,10px)] font-bold leading-none tracking-wider text-charcoal/80'>
                                            <span className='sr-only'>{t.ticket.priceSr} </span>{card.priceLabel}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {/* số seri chạy dọc theo mép phải cuống vé */}
                            {card.no && (
                                <span className='absolute bottom-[3cqw] right-[2cqw] top-[3cqw] flex items-center font-mono text-[clamp(6px,1.9cqw,8px)] tracking-[0.3em] text-charcoal/55 [writing-mode:vertical-rl]'>
                                    {card.no}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* dải sáng quét chéo qua vé khi rê chuột, như lớp ép kim; soft-light nên gần như vô hình trên nền tối quanh vé */}
                    <span aria-hidden='true' className='pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl mix-blend-soft-light motion-reduce:hidden'>
                        <span className='absolute -inset-y-8 -left-1/3 w-1/3 rotate-[18deg] bg-gradient-to-r from-transparent via-white to-transparent opacity-0 transition-[translate,opacity] duration-[900ms] ease-out group-hover:translate-x-[420%] group-hover:opacity-100 group-focus-visible:translate-x-[420%] group-focus-visible:opacity-100'/>
                    </span>

                    {/* đồ ghim: lỗ đục ở lưới, băng dính hoặc đinh ghim ở bảng ghim */}
                    {board ? (
                        tape ? (
                            <span className='tape absolute -top-3 left-1/2 z-20 h-6 w-16 -translate-x-1/2 [rotate:var(--tape)]'/>
                        ) : (
                            <span className='absolute -top-2 left-1/2 z-20 size-4 -translate-x-1/2 rounded-full bg-accent shadow-[inset_-2px_-2px_3px_rgba(0,0,0,0.35),inset_2px_2px_2px_rgba(255,255,255,0.35),0_4px_5px_rgba(0,0,0,0.5)]'/>
                        )
                    ) : (
                        <span className='absolute left-1/2 top-[2.2cqw] z-20 size-[3.6cqw] min-h-2.5 min-w-2.5 -translate-x-1/2 rounded-full bg-stage shadow-[inset_0_1px_2px_rgba(0,0,0,0.7)]'/>
                    )}
                </div>
            </div>
        </Link>
    );
}
