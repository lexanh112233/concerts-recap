import {MapPin, Ticket as TicketIcon, Users} from "lucide-react";
import {Barcode} from "@/components/barcode";
import {MoodSticker} from "@/components/mood-sticker";
import {PenRing} from "@/components/pen-ring";
import type {Lang} from "@/i18n/config";
import {format} from "@/i18n/format";
import {getDict} from "@/i18n/server";
import {hasCompanion, type ICard} from "@/lib/concerts";
import {foilStyle} from "@/lib/foil";
import {moodFor} from "@/lib/mood";

// Vé "rạp": cột trái là cuống có số ngày khổng lồ và số vé xoay dọc, cột phải là tên nghệ sĩ, địa điểm, chỗ ngồi (số ghế khoanh bút đỏ),
// nhãn "Đi cùng" dán lệch (chỉ khi có người đi cùng), sticker mặt cười theo điểm và tem mực "Đã xem"; dưới cùng là mã vạch. Co giãn theo bề rộng vé (container query) vì vé
// xuất hiện ở hero trang chủ (~400px) lẫn trang chi tiết (343–520px).
export function Ticket({card, ticketNo, lang, className = ""}: {
    card: Pick<ICard, "slug" | "artistName" | "place" | "city" | "longDate" | "day" | "month" | "year" | "zone" | "row" | "seat" | "companion" | "priceLabel" | "rating" | "tone">
    ticketNo: string | null
    lang: Lang
    className?: string
}) {
    const t = getDict(lang);
    const seat = [card.row, card.seat].filter(Boolean).join(" ");
    const where = [card.place, card.city].filter(Boolean).join(" · ");
    const mood = moodFor(card.rating);
    const moodWord = t.mood[mood.stars];

    return (
        // vầng sáng (.aura) nằm sau lưng vé, cùng độ nghiêng với vé nên className (xoay) đặt ở phần tử bọc này
        <div style={foilStyle(card.slug, card.tone)} className={`relative isolate ${className}`}>
            <span aria-hidden='true' className='aura [--aura-r:2px]'/>
            <div className='foil glitter @container relative overflow-visible text-charcoal shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]'>
                {/* bộ lọc mực cho tem: mép nhám, mất mực từng chỗ (id riêng, không dùng chung với con dấu ở hero trang chi tiết) */}
                <svg aria-hidden='true' focusable='false' width='0' height='0' className='absolute'>
                    <filter id='ticket-ink' x='-6%' y='-12%' width='112%' height='124%'>
                        <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='11' result='noise'/>
                        <feDisplacementMap in='SourceGraphic' in2='noise' scale='1.8' xChannelSelector='R' yChannelSelector='G' result='rough'/>
                        <feColorMatrix in='noise' type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 0 0 0 -1.5' result='ink'/>
                        <feComposite in='rough' in2='ink' operator='in'/>
                    </filter>
                </svg>

                <div className='h-4 bg-accent'/>
                <span className='absolute left-[38%] top-1.5 size-6 rounded-full bg-stage'/>

                <div className='flex'>
                    {/* CUỐNG TRÁI: ngày khổng lồ + số vé xoay dọc */}
                    <div className='flex w-1/4 shrink-0 flex-col items-center border-r-2 border-dashed border-charcoal/35 px-1 pb-4 pt-5 text-center @sm:w-[27%] @sm:pt-6'>
                        {card.day && card.month ? (
                            <div role='img' aria-label={card.longDate} className='flex flex-col items-center leading-none'>
                                <span className='font-mono text-[9px] uppercase tracking-[0.2em] text-charcoal/70 @sm:text-[10px]'>{t.date.monthsShort[card.month - 1]}</span>
                                <span className='mt-1 font-display text-[clamp(2.75rem,17cqw,5rem)] font-bold leading-[0.95] tracking-tight'>{card.day}</span>
                                {card.year && <span className='mt-1 font-mono text-[10px] tracking-[0.15em] text-charcoal/70'>{card.year}</span>}
                            </div>
                        ) : (
                            <TicketIcon className='mt-2 size-8 text-accent' aria-hidden='true'/>
                        )}
                        {ticketNo && (
                            <span aria-hidden='true' className='mt-3 rotate-180 font-mono text-[9px] tracking-[0.25em] text-charcoal/55 [writing-mode:vertical-rl] @sm:text-[10px]'>
                                {ticketNo}
                            </span>
                        )}
                    </div>

                    {/* CỘT PHẢI */}
                    <div className='relative flex min-w-0 flex-1 flex-col gap-2 px-3 pb-4 pt-5 @sm:gap-3 @sm:px-5 @sm:pb-5 @sm:pt-6'>
                        <div className='flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent @sm:text-xs'>
                            <p className='flex shrink-0 items-center gap-1.5'>
                                {/* vé hẹp (< 300px): bỏ biểu tượng nhường chỗ cho giá dài kiểu "100.000.000đ" */}
                                <TicketIcon className='size-3.5 @max-[300px]:hidden' aria-hidden='true'/>
                                {t.ticket.admit}
                            </p>
                            {/* dòng giá như trên vé rạp/hóa đơn: đường chấm dẫn tới giá in mực ở mép phải; chưa có giá thì không hiện gì */}
                            {card.priceLabel && (
                                <>
                                    <span aria-hidden='true' className='mb-[3px] h-0 min-w-2 flex-1 self-end border-b border-dotted border-charcoal/55'/>
                                    <p className='shrink-0 whitespace-nowrap tracking-[0.04em] text-charcoal'>
                                        <span className='sr-only'>{t.ticket.priceSr} </span>{card.priceLabel}
                                    </p>
                                </>
                            )}
                        </div>

                        <p title={card.artistName} className='line-clamp-2 text-balance font-playfair-display text-2xl font-bold italic leading-[1.05] @sm:text-3xl @lg:text-4xl'>
                            {card.artistName}
                        </p>

                        {where && (
                            <p className='flex items-start gap-1.5 text-xs text-charcoal/80 @sm:text-sm'>
                                <MapPin className='mt-0.5 size-3.5 shrink-0 text-accent' aria-hidden='true'/>
                                <span className='min-w-0 text-pretty font-playpen-sans'>{where}</span>
                            </p>
                        )}

                        {card.zone || seat ? (
                            <div className='flex flex-wrap items-center gap-x-4 gap-y-2.5'>
                                {card.zone && (
                                    <div className='min-w-0 max-w-full border border-charcoal/45 px-2 py-1'>
                                        <p className='font-mono text-[9px] uppercase tracking-[0.2em] text-charcoal/65'>{t.ticket.zone}</p>
                                        <p title={card.zone} className='truncate text-sm font-bold uppercase @sm:text-base'>{card.zone}</p>
                                    </div>
                                )}
                                {seat && (
                                    <div className='relative px-3 py-1.5'>
                                        <p className='font-mono text-[9px] uppercase tracking-[0.2em] text-charcoal/65'>{t.ticket.seat}</p>
                                        <p className='font-playfair-display text-lg font-bold leading-tight @sm:text-xl'>{seat}</p>
                                        <PenRing className='left-[-6px] top-[-3px] h-[calc(100%+6px)] w-[calc(100%+12px)] -rotate-[5deg]'/>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // chưa có dữ liệu chỗ ngồi: khoanh "Đứng tự do" để bố cục không trống
                            <div className='relative w-fit px-3 py-1.5'>
                                <p className='font-playfair-display text-lg font-bold italic leading-tight @sm:text-xl'>{t.ticket.standing}</p>
                                <PenRing className='left-[-6px] top-[-3px] h-[calc(100%+6px)] w-[calc(100%+12px)] -rotate-[5deg]'/>
                            </div>
                        )}

                        {hasCompanion(card.companion) && (
                            // nhãn và giá trị tách riêng vì giá trị có thể là cả cụm ("Bạn thân và anh trai") nên nhãn không được ghép vào giá trị
                            <p className='flex w-fit max-w-full -rotate-2 items-center gap-1.5 border border-dashed border-charcoal/50 px-2.5 py-0.5 text-xs @sm:text-sm font-playpen-sans'>
                                <Users className='size-3.5 shrink-0 text-accent' aria-hidden='true'/>
                                <span className='shrink-0 font-playpen-sans font-semibold text-[9px] tracking-[0.15em] text-charcoal/65'>{t.ticket.withLabel}</span>
                                <span title={card.companion} className='truncate font-semibold opacity-80'>{card.companion}</span>
                            </p>
                        )}

                        {/* sticker mặt cười: biểu cảm và dòng chữ viết tay đổi theo điểm (xem lib/mood.ts); dòng chữ chỉ để nhìn, tên đầy đủ nằm ở aria-label của sticker */}
                        <div className='flex items-center gap-2'>
                            <MoodSticker rating={card.rating} label={format(t.ticket.moodAria, {stars: mood.stars, word: moodWord})} className='size-12 @sm:size-14'/>
                            <p aria-hidden='true' className='-rotate-3 font-playpen-sans leading-tight'>
                                <span className='block text-[9px] uppercase tracking-[0.2em] text-charcoal/60'>{t.ticket.mood}</span>
                                <span className='text-sm font-semibold @sm:text-[15px]'>{moodWord}</span>
                            </p>
                        </div>

                        {/* tem mực đóng lệch ở góc dưới phải; multiply để mực ăn vào giấy, không che chữ bên dưới */}
                        <span
                            aria-hidden='true'
                            style={{filter: "url(#ticket-ink)"}}
                            className='pointer-events-none absolute bottom-3.5 right-2.5 -rotate-[10deg] border-2 border-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent mix-blend-multiply @sm:bottom-4 @sm:right-4 @sm:px-2.5 @sm:text-[11px]'>
                            {t.ticket.seen}
                        </span>
                    </div>
                </div>

                <div className='border-t-2 border-dashed border-charcoal/35 px-4 pb-3 pt-2.5 @sm:px-5 @sm:pb-4 @sm:pt-3'>
                    <Barcode seed={card.slug}/>
                </div>
            </div>
        </div>
    );
}
