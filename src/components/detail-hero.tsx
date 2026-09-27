import Image from "next/image";
import Link from "next/link";
import {ArrowLeft, Building2, CalendarDays, MapPin, Star, Users, type LucideIcon} from "lucide-react";
import {ParallaxLayer} from "@/components/parallax-layer";
import {PosterCard} from "@/components/poster-card";
import {ShareButton} from "@/components/share-button";
import {SpinningBadge} from "@/components/spinning-badge";
import {Spotlight} from "@/components/spotlight";
import {pathFor, type Lang} from "@/i18n/config";
import {format} from "@/i18n/format";
import {getDict} from "@/i18n/server";
import {hasCompanion, splitTitle, type ICard} from "@/lib/concerts";

const pad = (n: number) => String(n).padStart(2, "0");

const land = (from: string, delay: number) => ({"--from": from, "--delay": `${delay}ms`}) as React.CSSProperties;

// Tờ lịch xé: dải đỏ tháng, hai lỗ đóng gáy, ngày khổng lồ, góc dưới bị gập. Cỡ chữ tính theo bề rộng tờ (cqw).
function CalendarLeaf({day, monthName, year, weekday, label}: {
    day: number
    monthName: string
    year: number | null
    weekday: string
    label: string
}) {
    return (
        <div role='img' aria-label={label} className='[filter:drop-shadow(0_18px_16px_rgba(0,0,0,0.55))]'>
            <div className='@container relative overflow-hidden bg-paper text-charcoal [clip-path:polygon(0_0,100%_0,100%_calc(100%-16px),calc(100%-16px)_100%,0_100%)]'>
                <div className='relative bg-accent pb-[2.6cqw] pt-[6.5cqw] text-center font-display text-[clamp(11px,8cqw,15px)] font-bold uppercase tracking-[0.3em] text-paper'>
                    {monthName}
                    <span className='absolute left-[20%] top-[2.6cqw] size-[4.4cqw] min-h-2 min-w-2 rounded-full bg-stage shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]'/>
                    <span className='absolute right-[20%] top-[2.6cqw] size-[4.4cqw] min-h-2 min-w-2 rounded-full bg-stage shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]'/>
                </div>
                <div className='px-[4cqw] pb-[6cqw] pt-[2cqw] text-center'>
                    <p className='font-display text-[clamp(3rem,44cqw,7.5rem)] font-bold leading-[0.95]'>{pad(day)}</p>
                    <p className='mt-[1cqw] font-mono text-[clamp(8.5px,5.6cqw,12px)] uppercase tracking-[0.22em] text-charcoal/70'>
                        {weekday}{year ? ` · ${year}` : ""}
                    </p>
                </div>
                <span aria-hidden='true' className='absolute bottom-0 right-0 size-4 bg-gradient-to-br from-white to-[#bcb6a9] [clip-path:polygon(0_0,100%_0,0_100%)]'/>
            </div>
        </div>
    );
}

// Băng nhãn dập Dymo: đen (hoặc đỏ), chữ nổi, mỗi dải xoay lệch một góc.
function DymoStrip({icon: Icon, tone = "dark", tilt, children}: {
    icon: LucideIcon
    tone?: "dark" | "red"
    tilt: number
    children: React.ReactNode
}) {
    return (
        <p
            style={{rotate: `${tilt}deg`}}
            className={`dymo flex w-fit max-w-full items-center gap-2 rounded-[3px] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white sm:text-xs ${tone === "red" ? "[--dymo:var(--brand)]" : ""}`}>
            <Icon className='size-3.5 shrink-0'/>
            <span className='min-w-0 line-clamp-2 break-words'>{children}</span>
        </p>
    );
}

// Thẻ tên nghệ sĩ kèm thẻ tích điểm: mỗi lần đi xem lại một nghệ sĩ là một ô được bấm lỗ.
function NameTag({name, index, total, title}: { name: string, index: number, total: number, title: string }) {
    const slots = Math.min(10, Math.max(5, total));
    return (
        <div className='relative overflow-hidden rounded-[10px] bg-paper text-charcoal shadow-[0_18px_28px_-12px_rgba(0,0,0,0.85)]'>
            <div className='relative bg-accent pt-3 pb-1.5 text-center font-display text-xs font-bold uppercase tracking-[0.4em] text-paper'>
                {title}
                <span aria-hidden='true' className='absolute left-1/2 top-1 h-1.5 w-8 -translate-x-1/2 rounded-full bg-stage shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]'/>
            </div>
            <p className='line-clamp-2 text-balance px-4 py-3 text-center font-playfair-display text-[clamp(1.15rem,1.9vw,1.75rem)] font-bold italic leading-tight'>
                {name}
            </p>
            <div className='flex items-center justify-between gap-3 border-t border-dashed border-charcoal/35 bg-charcoal/[0.05] px-3 py-3'>
            </div>
        </div>
    );
}

// Con dấu cao su chấm điểm: mép nhám và mất mực từng chỗ nhờ bộ lọc SVG (feTurbulence + feDisplacementMap).
function RubberStamp({value, title, label}: { value: number, title: string, label: string }) {
    const filled = Math.round(value);
    return (
        <>
            <svg aria-hidden='true' focusable='false' width='0' height='0' className='absolute'>
                <filter id='stamp-rough' x='-8%' y='-8%' width='116%' height='116%'>
                    <feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' seed='7' result='noise'/>
                    <feDisplacementMap in='SourceGraphic' in2='noise' scale='3.5' xChannelSelector='R' yChannelSelector='G' result='rough'/>
                    <feColorMatrix in='noise' type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 0 0 0 -1.7' result='ink'/>
                    <feComposite in='rough' in2='ink' operator='in'/>
                </filter>
            </svg>
            <div
                role='img'
                aria-label={label}
                style={{filter: "url(#stamp-rough)"}}
                className='@container relative grid aspect-square w-full place-items-center rounded-full border-[3px] border-accent text-accent'>
                <span className='absolute inset-[6%] rounded-full border border-accent'/>
                <div className='relative flex flex-col items-center leading-none'>
                    <span className='font-mono text-[8.5cqw] font-bold uppercase tracking-[0.3em]'>{title}</span>
                    <span className='mt-[2cqw] font-display text-[36cqw] font-bold leading-[0.9]'>
                        {filled}<span className='text-[15cqw]'>/5</span>
                    </span>
                    <span className='mt-[3cqw] flex gap-[1cqw]'>
                        {Array.from({length: 5}, (_, i) => (
                            <Star key={i} className={`size-[9.5cqw] ${i < filled ? "fill-current" : "opacity-30"}`}/>
                        ))}
                    </span>
                </div>
            </div>
        </>
    );
}

// "Áp phích" của một đêm diễn. Từ lg là lưới hai cột: cột trái là cỗ bài polaroid (kèm tem xoay), cột phải là tiêu đề bậc thang
// và một cụm đồ dán (nhãn Dymo, lịch xé, thẻ tên, con dấu) đặt tuyệt đối theo % trong khung tỉ lệ cố định. Chiều cao khung do nội dung quyết
// định (tiêu đề 1 dòng thì gọn, 4 dòng thì cao) và cụm đồ dán luôn bám đáy cột nên không bao giờ có khoảng trống giữa tiêu đề và cụm đó.
// Dưới lg mọi thứ xếp theo dòng nhưng vẫn chồng mép và nghiêng.
export function DetailHero({card, number, ago, weekday, artistIndex, artistTotal, ambient, lang}: {
    card: ICard
    number: number
    ago: string
    weekday: string
    artistIndex: number
    artistTotal: number
    ambient: string | null
    lang: Lang
}) {
    const t = getDict(lang);
    const lines = splitTitle(card.title);
    const longest = Math.max(...lines.map((l) => l.length), 1);
    const total = Math.max(1, artistTotal);
    const index = Math.min(Math.max(1, artistIndex), total);

    const strips: Array<{ icon: LucideIcon, text: string, tone?: "dark" | "red", tilt: number }> = [
        card.longDate ? {icon: CalendarDays, text: card.longDate, tone: "red" as const, tilt: -1.5} : null,
        card.place ? {icon: MapPin, text: card.place, tilt: 1} : null,
        card.city ? {icon: Building2, text: card.city, tilt: -0.8} : null,
        hasCompanion(card.companion) ? {icon: Users, text: format(t.detail.withCompanion, {name: card.companion}), tilt: 1.4} : null,
    ].filter((s): s is NonNullable<typeof s> => s !== null);

    return (
        <section className='relative isolate overflow-x-clip'>
            {ambient && (
                <div aria-hidden='true' className='absolute inset-x-0 top-0 -z-20 h-[105%] overflow-hidden'>
                    {/* bản nhỏ ~128px, chỉ để làm nền mờ nên rất nhẹ */}
                    <Image src={ambient} alt='' fill sizes='128px' className='scale-125 object-cover opacity-30 blur-3xl saturate-150'/>
                    <div className='absolute inset-0 bg-gradient-to-b from-stage/40 via-stage/80 to-stage'/>
                </div>
            )}
            <Spotlight className='-z-10'/>

            <div className='relative mx-auto w-full max-w-[1440px] px-4 pb-16 pt-20 sm:px-6 md:px-10 lg:pb-20 lg:pt-24'>
                <div className='mb-7 flex items-center justify-between gap-4 lg:mb-8'>
                    <Link
                        href={pathFor(lang, "/#archive")}
                        className='group flex -rotate-3 items-center gap-2 rounded-[4px] bg-paper px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-charcoal shadow-[0_10px_16px_-8px_rgba(0,0,0,0.8)] transition-[rotate,translate] duration-200 hover:-translate-y-0.5 hover:rotate-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'>
                        <ArrowLeft className='size-4 transition-transform duration-200 group-hover:-translate-x-1'/>
                        {t.detail.back}
                    </Link>
                    <ShareButton title={card.title}/>
                </div>

                <div className='relative lg:grid lg:grid-cols-[minmax(0,34%)_minmax(0,1fr)]'>
                    {/* cột trái: cỗ bài polaroid + tem xoay. Trên màn hình thấp thì thu nhỏ để cả tấm ảnh nằm trong khung nhìn đầu tiên */}
                    <ParallaxLayer speed={0.05} className='relative z-10 mx-auto w-[78%] max-w-[400px] lg:mx-0 lg:ml-[6%] lg:w-[min(91%,calc((100svh-240px)*0.8))] lg:max-w-none lg:self-start'>
                        <div className='land' style={land("-12deg", 100)}>
                            <PosterCard/>
                        </div>
                        {/* tem: mobile đè góc trên phải, desktop đè góc dưới phải của cỗ bài */}
                        <ParallaxLayer speed={0.05} className='absolute -right-3 -top-6 z-30 lg:-bottom-9 lg:-right-8 lg:top-auto'>
                            <div className='land' style={land("40deg", 600)}>
                                <SpinningBadge label={number > 0 ? format(t.detail.nightNo, {n: number}) : t.detail.oneNight} sub={ago || t.detail.passed} className='lg:size-[140px]'/>
                            </div>
                        </ParallaxLayer>
                    </ParallaxLayer>

                    {/* cột phải: tiêu đề bậc thang ở đầu, cụm đồ dán bám đáy */}
                    <div className='relative z-20 mt-10 flex flex-col gap-8 lg:mt-0 lg:justify-between lg:gap-6'>
                        <div className='lg:-ml-[3%]'>
                            <h1 className='poster-title font-display font-bold uppercase leading-[1.06] tracking-tight text-white'
                                style={{"--chars": longest, "--lines": lines.length} as React.CSSProperties}>
                                {lines.map((line, i) => (
                                    <span
                                        key={i}
                                        className={`land block ${i % 2 === 1 ? "text-stroke-lg" : ""}`}
                                        style={{marginLeft: `calc(${i} * var(--step))`, ...land("0deg", 250 + i * 130)}}>
                                        {line}
                                    </span>
                                ))}
                            </h1>
                        </div>

                        <div className='relative lg:ml-[2%] lg:aspect-[880/280]'>
                            {/* nhãn dập Dymo */}
                            {strips.length > 0 && (
                                <div className='relative z-20 flex flex-col items-start gap-2.5 lg:absolute lg:left-[3%] lg:top-[8%] lg:w-[40%]'>
                                    {strips.map((s, i) => (
                                        <div key={s.text} className='land max-w-full' style={land(`${i % 2 ? 6 : -6}deg`, 700 + i * 120)}>
                                            <DymoStrip icon={s.icon} tone={s.tone} tilt={s.tilt}>{s.text}</DymoStrip>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* lịch xé + thẻ tên + con dấu: hàng ngang trên mobile, tách ra đặt tuyệt đối trong cụm từ lg (contents) */}
                            <div className='relative mb-10 mt-12 flex items-start justify-between gap-4 lg:contents'>
                                {card.day && card.month && (
                                    <ParallaxLayer speed={0.08} className='relative z-20 w-[40%] max-w-[190px] lg:absolute lg:left-[46%] lg:top-0 lg:w-[21%] lg:max-w-none'>
                                        <div className='land' style={land("14deg", 900)}>
                                            <div className='rotate-[5deg]'>
                                                <CalendarLeaf day={card.day} monthName={t.date.months[card.month - 1]} year={card.year} weekday={weekday} label={card.longDate}/>
                                            </div>
                                        </div>
                                    </ParallaxLayer>
                                )}

                                <div className='relative z-20 w-[54%] max-w-[280px] lg:absolute lg:right-0 lg:top-[4%] lg:w-[30%] lg:max-w-none'>
                                    <div className='land' style={land("-10deg", 1000)}>
                                        <div className='rotate-[3deg]'>
                                            <NameTag name={card.artistName} index={index} total={total} title={t.detail.artist}/>
                                        </div>
                                    </div>
                                </div>

                                <ParallaxLayer speed={0.1} className='absolute -bottom-12 left-1/2 z-30 w-[112px] -translate-x-1/2 lg:bottom-auto lg:left-[76%] lg:top-[62%] lg:w-[15%] lg:translate-x-0'>
                                    <div className='stamp-in' style={{"--delay": "1250ms"} as React.CSSProperties}>
                                        <div className='-rotate-12'>
                                            <RubberStamp value={card.rating} title={t.detail.stampRating} label={format(t.detail.ratingLabel, {n: Math.round(card.rating)})}/>
                                        </div>
                                    </div>
                                </ParallaxLayer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
