import type {Lang} from "@/i18n/config";
import {getDict} from "@/i18n/server";
import type {ITone} from "@/lib/concerts";
import {foilStyle} from "@/lib/foil";

// Mép dưới răng cưa như xé khỏi sổ: clip-path polygon với `teeth` răng, mỗi răng sâu `depth`.
// (Mép trái bị cắn thành nửa vòng tròn bằng mask của .notebook; hai thứ độc lập nên cùng áp dụng được.)
function tornBottom(teeth: number, depth: string) {
    const points = ["0 0", "100% 0", `100% calc(100% - ${depth})`];
    for (let i = 0; i < teeth; i++) {
        points.push(`${((1 - (i + 0.5) / teeth) * 100).toFixed(2)}% 100%`);
        points.push(`${((1 - (i + 1) / teeth) * 100).toFixed(2)}% calc(100% - ${depth})`);
    }
    return `polygon(${points.join(",")})`;
}

const TORN = tornBottom(44, "7px");

// Trang nhật ký: một tờ giấy platinum (cùng tông với vé của đêm diễn) xé từ sổ lò xo, chữ mực đen trên nền chấm bi.
// `html` đã được lọc ở server (bodyToHtml) trước khi truyền vào.
export function JournalSheet({slug, tone, html, ticketNo, sectionNo, lang}: {
    slug: string
    tone: ITone | null
    html: string
    ticketNo: string
    sectionNo: string
    lang: Lang
}) {
    const t = getDict(lang);
    return (
        // drop-shadow ở phần tử bọc vì mask/clip-path của tờ giấy sẽ cắt mất box-shadow
        <div className='relative [filter:drop-shadow(0_28px_28px_rgba(0,0,0,0.6))] lg:-rotate-[0.5deg]'>
            <span className='tape absolute -top-3 left-[12%] z-20 h-6 w-20 -rotate-[6deg]'/>
            <span className='tape absolute -top-2 right-[10%] z-20 h-6 w-16 rotate-[5deg]'/>

            <div
                style={{...foilStyle(slug, tone), clipPath: TORN}}
                className='notebook foil relative pb-14 pl-14 pr-5 pt-10 text-charcoal sm:pl-20 sm:pr-10 md:pr-14'>
                {/* lỗ đục: nền bàn tối lộ ra phía sau */}
                {[12, 50, 88].map((top) => (
                    <span
                        key={top}
                        aria-hidden='true'
                        style={{top: `${top}%`}}
                        className='absolute left-3 size-4 -translate-y-1/2 rounded-full bg-stage shadow-[inset_0_2px_3px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.55)] sm:left-4 sm:size-5'
                    />
                ))}
                {/* đường lề đỏ của trang vở */}
                <span aria-hidden='true' className='absolute inset-y-0 left-10 w-px bg-accent/45 sm:left-14'/>

                <header className='relative mb-8 flex items-end justify-between gap-4 border-b-2 border-charcoal/80 pb-3'>
                    <h2 className='flex items-baseline gap-3 font-display text-3xl font-bold uppercase tracking-[0.12em] sm:text-4xl'>
                        <span className='font-mono text-sm font-medium tracking-widest text-accent'>{sectionNo}</span>
                        {t.journal.title}
                    </h2>
                    {ticketNo && <span className='pb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-charcoal/60'>NO. {ticketNo}</span>}
                </header>

                <div
                    className='rich rich-ink relative !font-playpen-sans text-pretty text-base md:text-lg'
                    dangerouslySetInnerHTML={{__html: html}}
                />

                <p className='relative mt-10 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-charcoal/50'>
                    <span className='h-px flex-1 border-t border-dashed border-charcoal/35'/>
                    ✦
                </p>
            </div>
        </div>
    );
}
