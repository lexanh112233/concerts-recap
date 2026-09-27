import type {CSSProperties} from "react";
import type {Lang} from "@/i18n/config";
import {format, plural} from "@/i18n/format";
import {getDict} from "@/i18n/server";

interface Stub {
    key: string
    label: string
    // khối số ở đầu cuống (×N hoặc số vé); rỗng thì không vẽ
    tag: string
    // phần đọc thêm cho trình đọc màn hình, đi kèm tên ("1 đêm", "vé 2026-0021")
    sr: string
}

// Một chuỗi cuống vé chạy vô hạn (chỉ CSS): mỗi cái tên là một cuống khuyết tròn hai đầu. Lặp danh sách cho đủ dài hơn
// bề rộng dải rồi nhân đôi cả chuỗi để vòng lặp -50% liền mạch. Chuỗi xoay theo biến --tilt của section nên hai chuỗi cắt nhau.
function Ribbon({label, stubs, tone, reverse = false, minSeconds, secondsPerStub, className}: {
    label: string
    stubs: Stub[]
    tone: "silver" | "red"
    reverse?: boolean
    minSeconds: number
    secondsPerStub: number
    className: string
}) {
    // mỗi nửa phải dài hơn dải 128% bề rộng màn hình (tới ~2560px), nên cuống rộng hơn chữ trần cần nhiều lần lặp hơn
    const list = Array.from({length: Math.ceil(16 / stubs.length)}, () => stubs).flat();
    const duration = Math.max(minSeconds, list.length * secondsPerStub);

    const half = (hidden: boolean) => (
        <ul aria-label={hidden ? undefined : label} aria-hidden={hidden || undefined} className='flex shrink-0 items-center'>
            {list.map((stub, i) => (
                // các lần lặp thừa chỉ để đủ dài, không đọc lại cho trình đọc màn hình
                <li key={`${stub.key}-${i}`} aria-hidden={i >= stubs.length || undefined} className='mr-2 shrink-0'>
                    <span className={`cut-side flex h-10 items-center gap-3 px-5 md:h-[46px] md:px-6 ${tone === "silver" ? "foil text-charcoal" : "bg-accent text-paper"}`}>
                        {stub.tag && (
                            <span aria-hidden='true' className='border-r-2 border-dashed border-current pr-3 font-mono text-[10px] font-bold tracking-[0.14em] opacity-55'>
                                {stub.tag}
                            </span>
                        )}
                        <span className='max-w-[30rem] truncate font-display text-base font-semibold uppercase leading-[1.5] tracking-[0.08em] md:text-[21px]'>{stub.label}</span>
                        {stub.sr && <span className='sr-only'>, {stub.sr}</span>}
                    </span>
                </li>
            ))}
        </ul>
    );

    // bóng đổ đặt trên khung chứ không trên từng cuống: mask cắt bóng của phần tử, còn filter thì phải vẽ lại mỗi khung hình
    return (
        <div className={`absolute -inset-x-[14%] top-1/2 h-12 -translate-y-1/2 shadow-[0_14px_16px_-12px_rgba(0,0,0,0.9)] md:h-16 ${className}`}>
            <div
                className='marquee-track h-full items-center'
                // chiều ngược đặt nội tuyến vì .marquee-track là CSS ngoài layer, thắng mọi utility Tailwind
                style={{"--marquee-duration": `${duration}s`, ...(reverse ? {animationDirection: "reverse"} : null)} as CSSProperties}>
                {half(false)}
                {half(true)}
            </div>
        </div>
    );
}

// Hai chuỗi cuống vé chạy ngược chiều nhau, nghiêng cắt nhau thành chữ X: chuỗi bạc là nghệ sĩ (kèm số đêm đã xem),
// chuỗi đỏ là tên concert (kèm số vé thật của đêm đó). Góc nghiêng và chiều cao thu nhỏ theo màn hình để chữ X vẫn rõ.
export function Marquee({artists, concerts, lang}: {
    artists: Array<{ name: string, count: number }>
    concerts: Array<{ title: string, no: string }>
    lang: Lang
}) {
    if (artists.length === 0 && concerts.length === 0) return null;
    const t = getDict(lang);

    return (
        <section
            aria-label={t.marquee.label}
            className='marquee relative isolate h-44 overflow-hidden border-y border-white/10 [--tilt:9deg] md:h-52 md:[--tilt:6deg] xl:h-64 xl:[--tilt:5deg]'>
            {artists.length > 0 && (
                <Ribbon
                    label={t.marquee.artists}
                    tone='silver'
                    minSeconds={70}
                    secondsPerStub={8}
                    className='[rotate:calc(var(--tilt)*-1)]'
                    stubs={artists.map((a) => ({key: a.name, label: a.name, tag: `×${a.count}`, sr: plural(lang, t.marquee.nightsSr, a.count)}))}
                />
            )}
            {concerts.length > 0 && (
                <Ribbon
                    label={t.marquee.nights}
                    tone='red'
                    reverse
                    minSeconds={80}
                    secondsPerStub={12}
                    className='z-10 [rotate:var(--tilt)]'
                    stubs={concerts.map((c) => ({key: c.no || c.title, label: c.title, tag: c.no ? `NO. ${c.no}` : "", sr: c.no ? format(t.marquee.ticketSr, {no: c.no}) : ""}))}
                />
            )}
        </section>
    );
}
