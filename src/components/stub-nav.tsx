import Link from "next/link";
import {ArrowLeft, ArrowRight, MicVocal, Scissors} from "lucide-react";
import {SmartMedia} from "@/components/smart-media";
import {pathFor, type Lang} from "@/i18n/config";
import {getDict} from "@/i18n/server";
import {getMediaList, type ITone} from "@/lib/concerts";
import {foilStyle} from "@/lib/foil";

export interface INeighbor {
    slug: string
    title: string
    artistName: string
    date: Date | string
    images: string[]
    // tông giấy theo màu chủ đạo của ảnh bìa đêm diễn đó (xem lib/tone.ts); null thì dùng platinum trung tính
    tone?: ITone | null
}

// Cuống vé ngang: khuyết tròn ở mép trên/dưới tại vạch đứt, phần cuống mang mũi tên và chữ TRƯỚC/SAU.
// Vé "trước" đặt cuống bên trái, vé "sau" đặt cuống bên phải; giấy platinum lấy tông theo slug của đêm diễn kia.
// Chiều cao cố định nên không giật khi ảnh nhỏ tải xong.
function Stub({entry, direction, lang}: { entry: INeighbor, direction: "older" | "newer", lang: Lang }) {
    const t = getDict(lang);
    const older = direction === "older";
    const cover = getMediaList(entry.images)[0];
    const Arrow = older ? ArrowLeft : ArrowRight;

    const stub = (
        <div className='flex flex-col items-center justify-center gap-2 px-1'>
            <Arrow className={`size-5 transition-transform duration-200 ${older ? "group-hover:-translate-x-1" : "group-hover:translate-x-1"}`}/>
            <span className='font-mono text-[10px] font-bold uppercase tracking-[0.3em] [writing-mode:vertical-rl]'>{older ? t.stubNav.older : t.stubNav.newer}</span>
        </div>
    );

    const main = (
        <div className='flex min-w-0 items-center gap-4 px-4'>
            <div className='relative size-[68px] shrink-0 rounded-[3px] bg-charcoal'>
                <div className='absolute inset-[2px] overflow-hidden rounded-[2px]'>
                    {cover ? (
                        <SmartMedia media={cover} alt={entry.artistName} sizes='68px' className='absolute inset-0' position='50% 30%'/>
                    ) : (
                        <div className='flex size-full items-center justify-center'>
                            <MicVocal className='size-6 text-paper/40'/>
                        </div>
                    )}
                </div>
            </div>
            <div className='min-w-0'>
                <p className='font-mono text-[10px] uppercase tracking-[0.2em] text-charcoal/65'>{older ? t.stubNav.olderNight : t.stubNav.newerNight}</p>
                <p className='mt-0.5 line-clamp-2 font-display text-lg font-bold uppercase leading-[1.1] tracking-tight sm:text-xl'>{entry.title}</p>
                <p className='mt-0.5 truncate font-playfair-display text-sm italic text-charcoal/80'>{entry.artistName}</p>
            </div>
        </div>
    );

    return (
        // Wrapper lo phần xoay/nhấc và vầng sáng (.aura); Link bên trong giữ filter đổ bóng để bóng ôm theo hình vé khuyết tròn
        <div
            style={foilStyle(entry.slug, entry.tone)}
            className={`group relative isolate transition-[rotate,translate] duration-300 ease-out hover:-translate-y-1.5 hover:rotate-0 focus-within:-translate-y-1.5 focus-within:rotate-0 motion-reduce:transition-none ${older ? "-rotate-[1.5deg]" : "rotate-[1.5deg]"} ${older ? "" : "sm:col-start-2"}`}>
            <span aria-hidden='true' className='aura [--aura-r:10px]'/>
            <Link
                href={pathFor(lang, `/concerts/${entry.slug}`)}
                aria-label={`${older ? t.stubNav.olderNight : t.stubNav.newerNight}: ${entry.title}`}
                className='group block [filter:drop-shadow(0_18px_18px_rgba(0,0,0,0.6))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent'>
                <div
                    style={{"--x": older ? "20%" : "80%", gridTemplateColumns: older ? "20% 1fr" : "1fr 20%"} as React.CSSProperties}
                    className='cut-notch foil glitter relative grid h-[108px] rounded-[10px] text-charcoal sm:h-[116px]'>
                    {older ? <>{stub}{main}</> : <>{main}{stub}</>}
                    <span aria-hidden='true' className='absolute inset-y-[11px] w-0 border-l-2 border-dashed border-charcoal/35 [left:var(--x)]'/>
                </div>
            </Link>
        </div>
    );
}

export function StubNav({older, newer, lang}: { older: INeighbor | null, newer: INeighbor | null, lang: Lang }) {
    if (!older && !newer) return null;
    const t = getDict(lang);
    return (
        <nav aria-label={t.stubNav.nav} className='mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 md:px-10'>
            <p className='mb-8 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-paper/50'>
                <Scissors className='size-4 -rotate-90 text-accent' aria-hidden='true'/>
                <span aria-hidden='true' className='dash-line h-[2px] flex-1 text-paper/25'/>
                {t.stubNav.tear}
            </p>
            <div className='grid gap-8 sm:grid-cols-2 sm:gap-6 lg:gap-10'>
                {older && <Stub entry={older} direction='older' lang={lang}/>}
                {newer && <Stub entry={newer} direction='newer' lang={lang}/>}
            </div>
        </nav>
    );
}
