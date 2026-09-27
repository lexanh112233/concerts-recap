import Image from "next/image";
import Link from "next/link";
import {ArrowUpRight, MapPin} from "lucide-react";
import {Counter} from "@/components/counter";
import {ParallaxLayer} from "@/components/parallax-layer";
import {Rating} from "@/components/rating";
import {SmartMedia} from "@/components/smart-media";
import {SpinningBadge} from "@/components/spinning-badge";
import {Spotlight} from "@/components/spotlight";
import {Ticket} from "@/components/ticket";
import {TiltCard} from "@/components/tilt-card";
import {pathFor, type Lang} from "@/i18n/config";
import {format} from "@/i18n/format";
import {getDict} from "@/i18n/server";
import {splitTitle, type ICard} from "@/lib/concerts";
import {foilStyle} from "@/lib/foil";

export interface IStats {
    shows: number
    artists: number
    venues: number
    moments: number
}

// "Áp phích": ảnh in, số ngày khổng lồ, tiêu đề bậc thang, vé ghim, ghi chú và nút tròn xếp chồng,
// lệch trục và xoay. Trên màn hình lớn các lớp được đặt tuyệt đối trong một khung cao cố định
// (không phụ thuộc ảnh tải xong); trên điện thoại chúng xếp dọc nhưng vẫn chồng mép và nghiêng.
export function FeaturedEvent({card, ticketNo, ago, stats, lang}: {
    card: ICard
    ticketNo: string | null
    ago: string
    stats: IStats
    lang: Lang
}) {
    const t = getDict(lang);
    const lines = splitTitle(card.title);
    const longest = Math.max(...lines.map((l) => l.length), 1);
    const ambient = card.cover && !card.cover.isVideo ? card.cover.src : null;
    const facts: Array<[string, number]> = [
        [t.featured.shows, stats.shows],
        [t.featured.artists, stats.artists],
        [t.featured.venues, stats.venues],
        [t.featured.moments, stats.moments],
    ];

    return (
        <section className='relative isolate overflow-x-clip'>
            {ambient && (
                <div aria-hidden='true' className='absolute inset-x-0 top-0 -z-20 h-[105%] overflow-hidden'>
                    <Image src={ambient} alt='' fill sizes='128px' priority className='scale-125 object-cover opacity-30 blur-3xl saturate-150'/>
                    <div className='absolute inset-0 bg-gradient-to-b from-stage/40 via-stage/80 to-stage'/>
                </div>
            )}
            <Spotlight className='-z-10'/>

            <div className='relative mx-auto w-full max-w-[1440px] px-4 pb-12 pt-24 sm:px-6 md:px-10'>
                <div className='relative lg:aspect-[1360/820]'>
                    {/* số ngày khổng lồ nằm sau mọi thứ */}
                    {card.day && (
                        <ParallaxLayer speed={0.03} className='pointer-events-none absolute -right-4 -top-2 z-0 select-none lg:-right-16 lg:-top-10'>
                            <span className='land block font-display text-[clamp(10rem,38vw,30rem)] font-bold leading-[0.8] tracking-tighter text-stroke'
                                  style={{"--from": "0deg"} as React.CSSProperties} aria-hidden='true'>
                                {String(card.day).padStart(2, "0")}
                            </span>
                        </ParallaxLayer>
                    )}
                    {card.month && (
                        <p className='absolute right-0 top-[52%] z-0 hidden origin-top-right rotate-90 whitespace-nowrap font-mono text-xs uppercase tracking-[0.5em] text-paper/55 lg:block'>
                            {t.date.months[card.month - 1]} · {card.year}
                        </p>
                    )}

                    {/* tem tròn xoay: đặt ở góc trống phía trên bên phải, không đè lên chữ */}
                    <ParallaxLayer speed={0.06} className='absolute right-1 top-14 z-30 lg:right-[10%] lg:top-[3%]'>
                        <div className='land' style={{"--from": "40deg", "--delay": "500ms"} as React.CSSProperties}>
                            <SpinningBadge label={t.featured.badge} sub={ago || t.featured.badgeFallback} className='lg:size-[150px]'/>
                        </div>
                    </ParallaxLayer>

                    {/* ảnh in, xoay nghiêng, băng dính */}
                    <ParallaxLayer speed={0.09} className='relative z-10 mx-auto mt-6 w-[80%] max-w-[420px] lg:absolute lg:left-[5%] lg:top-[4%] lg:mx-0 lg:mt-0 lg:w-[31%] lg:max-w-none'>
                        <div className='land' style={{"--from": "-14deg", "--delay": "150ms"} as React.CSSProperties}>
                            <TiltCard max={4}>
                                <div className='relative -rotate-[4deg] rounded-[6px] bg-paper p-2.5 pb-12 shadow-[0_40px_70px_-25px_rgba(0,0,0,0.9)]'>
                                    <span className='tape absolute -top-3 left-10 z-10 h-6 w-20 -rotate-[8deg]'/>
                                    <span className='tape absolute -top-2 right-8 z-10 h-6 w-16 rotate-[6deg]'/>
                                    {card.cover ? (
                                        <SmartMedia
                                            media={card.cover}
                                            alt={card.artistName}
                                            ratio='4/5'
                                            sizes='(min-width: 1024px) 32vw, 80vw'
                                            priority
                                            autoplayInView
                                            position='50% 30%'
                                        />
                                    ) : (
                                        <div style={{aspectRatio: "4/5"}} className='bg-gradient-to-br from-accent/40 to-stage-2'/>
                                    )}
                                    <p className='absolute inset-x-3 bottom-3 truncate font-playfair-display text-lg italic text-charcoal'>{card.artistName}</p>
                                </div>
                            </TiltCard>
                        </div>
                    </ParallaxLayer>

                    {/* tiêu đề bậc thang, đè lên mép ảnh */}
                    <div className='relative z-20 mt-2 lg:absolute lg:left-[30%] lg:top-[5%] lg:mt-0 lg:w-[68%]'>
                        <h1 className='poster-title font-display font-bold uppercase leading-[1.06] tracking-tight text-white'
                            style={{"--chars": longest, "--lines": lines.length} as React.CSSProperties}>
                            {lines.map((line, i) => (
                                <span
                                    key={i}
                                    className={`land block ${i % 2 === 1 ? "text-stroke-lg" : ""}`}
                                    style={{marginLeft: `calc(${i} * var(--step))`, "--from": "0deg", "--delay": `${300 + i * 130}ms`} as React.CSSProperties}>
                                    {line}
                                </span>
                            ))}
                        </h1>
                    </div>

                    {/* ghi chú dán: trích dẫn */}
                    {(card.quote || card.place) && (
                        <div className='relative z-20 mx-auto mt-8 w-[86%] max-w-[380px] lg:absolute lg:left-[35%] lg:top-[66%] lg:mx-0 lg:mt-0 lg:w-[25%] lg:max-w-none'>
                            <div className='land' style={{"--from": "6deg", "--delay": "750ms"} as React.CSSProperties}>
                                <div style={foilStyle(card.slug, card.tone)} className='foil relative -rotate-2 p-4 pt-5 text-charcoal shadow-[0_18px_30px_-12px_rgba(0,0,0,0.8)]'>
                                    <span className='tape absolute -top-3 left-1/2 h-6 w-16 -translate-x-1/2 rotate-[3deg]'/>
                                    {card.quote && (
                                        <p className='line-clamp-4 font-playpen-sans text-[15px] italic leading-snug'>“{card.quote}”</p>
                                    )}
                                    <div className='mt-3 flex items-center justify-between gap-3 border-t border-dashed border-charcoal/30 pt-2'>
                                        {card.place && (
                                            <p className='flex min-w-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-charcoal/70'>
                                                <MapPin className='size-3 shrink-0 text-accent'/>
                                                <span className='truncate'>{card.place}</span>
                                            </p>
                                        )}
                                        <Rating value={card.rating} label={format(t.rating.stars, {n: Math.round(card.rating)})} tone='light' className='size-3'/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* vé ghim, xoay ngược chiều với ảnh */}
                    <ParallaxLayer speed={0.15} className='relative z-30 mx-auto mb-8 mt-8 w-[94%] max-w-[430px] lg:absolute lg:-bottom-[11%] lg:right-[-0.5%] xl:-bottom-[7%] lg:mx-0 lg:mb-0 lg:mt-0 lg:w-[29%] lg:max-w-none'>
                        <div className='land' style={{"--from": "18deg", "--delay": "600ms"} as React.CSSProperties}>
                            <TiltCard max={5}>
                                <Ticket card={card} ticketNo={ticketNo} lang={lang} className='rotate-[6deg]'/>
                            </TiltCard>
                        </div>
                    </ParallaxLayer>

                    {/* nút xem: vòng tròn đè lên góc ảnh */}
                    <div className='relative z-40 ml-auto mr-2 mt-10 w-fit lg:absolute lg:bottom-[9%] lg:left-[1%] lg:ml-0 lg:mr-0 lg:mt-0'>
                        <div className='land' style={{"--from": "-30deg", "--delay": "900ms"} as React.CSSProperties}>
                            <Link
                                href={pathFor(lang, `/concerts/${card.slug}`)}
                                aria-label={format(t.featured.view, {title: card.title})}
                                className='group relative grid size-[60px] place-items-center rounded-full bg-accent text-paper shadow-[0_18px_30px_-10px_rgba(193,72,29,0.7)] transition-transform duration-300 hover:scale-110 hover:-rotate-12 lg:size-20'>
                                <span className='flex flex-col items-center gap-0.5 font-playpen-sans text-xl font-bold leading-none tracking-[0.2em]'>
                                    <ArrowUpRight className='size-10 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1'/>
                                </span>
                            </Link>
                        </div>
                    </div>
                </div>

                <dl className='mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.25em] text-paper/60'>
                    {facts.map(([label, value], i) => (
                        <div key={label} className='flex items-center gap-2'>
                            {i > 0 && <span aria-hidden='true' className='text-accent'>✦</span>}
                            <dd className='text-paper'><Counter value={value}/></dd>
                            <dt>{label}</dt>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
}
