import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {pathFor, type Lang} from "@/i18n/config";
import {getDict} from "@/i18n/server";

// Khung chờ của trang chi tiết đêm diễn (mỗi ngôn ngữ có một loading.tsx mỏng gọi component này): Next hiện nó ngay khi bấm vào vé
// (loading.tsx tự thành fallback Suspense của cả trang),
// nên bấm là thấy phản hồi tức thì thay vì đứng yên chờ server dựng. Hình "vé đang in": hai khung polaroid trống, ba dải giấy thay tiêu đề
// và một tấm vé bạc trống có đầu in chạy qua mã vạch. Khung ngoài dùng đúng lưới của DetailHero (bề rộng, padding, cỡ cỗ bài)
// để lúc trang thật thay vào ít nhảy nhất. Thuần server, không JS.

// Ba dải giấy thay cho tiêu đề bậc thang: mỗi dải một độ rộng, thụt vào một chút và lệch một góc như trang thật.
const TITLE_STRIPS = [
    {width: "74%", indent: "0%", tilt: -0.8},
    {width: "90%", indent: "3%", tilt: 0.6},
    {width: "58%", indent: "7%", tilt: -0.4},
];

const DOT_DELAYS = ["0s", "0.2s", "0.4s"];

// Một tờ polaroid trống; hai tờ chồng lệch như cỗ bài ở hero.
function BlankPolaroid({className = "", style, front = false}: { className?: string, style?: React.CSSProperties, front?: boolean }) {
    return (
        <div
            aria-hidden='true'
            style={style}
            className={`absolute inset-0 rounded-[6px] p-2.5 pb-14 shadow-[0_40px_70px_-25px_rgba(0,0,0,0.9)] ${front ? "bg-paper" : "bg-[#d6d1c6]"} ${className}`}>
            {front && (
                <>
                    <span className='tape absolute -top-3 left-8 z-10 h-6 w-20 -rotate-[8deg] opacity-70'/>
                    <span className='tape absolute -top-2 right-8 z-10 h-6 w-16 rotate-[6deg] opacity-70'/>
                    <div className='window-shimmer size-full rounded-[2px]'/>
                    <span className='absolute inset-x-3 bottom-4 h-3 w-2/5 rounded-full bg-charcoal/15'/>
                </>
            )}
        </div>
    );
}

// Vé bạc trống: dải đỏ mờ, các dòng chữ là vạch xám, mã vạch được "in" dần từ trái sang phải.
function PrintingTicket({label}: { label: string }) {
    return (
        <div className='foil relative w-full max-w-[440px] rotate-2 text-charcoal shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] lg:ml-[2%]'>
            <div className='h-4 bg-accent/55'/>
            <span className='absolute left-[38%] top-1.5 size-6 rounded-full bg-stage'/>

            <div className='flex'>
                <div className='flex w-1/4 shrink-0 flex-col items-center gap-3 border-r-2 border-dashed border-charcoal/25 px-2 pb-4 pt-6'>
                    <span className='h-2.5 w-8 rounded-full bg-charcoal/15'/>
                    <span className='h-14 w-10 rounded-[3px] bg-charcoal/15'/>
                    <span className='h-2.5 w-7 rounded-full bg-charcoal/10'/>
                </div>
                <div className='flex min-w-0 flex-1 flex-col gap-3 px-4 pb-4 pt-6'>
                    <span className='h-2.5 w-24 rounded-full bg-accent/35'/>
                    <span className='h-6 w-[85%] rounded-[3px] bg-charcoal/15'/>
                    <span className='h-6 w-[55%] rounded-[3px] bg-charcoal/15'/>
                    <span className='h-3 w-[70%] rounded-full bg-charcoal/10'/>
                </div>
            </div>

            <div className='mx-4 border-t-2 border-dashed border-charcoal/25 pb-4 pt-4'>
                <div className='relative h-10 overflow-hidden'>
                    <div className='print-bars absolute inset-0'/>
                    <span className='print-head absolute inset-y-0 w-0.5 bg-accent shadow-[0_0_8px_2px_rgba(193,72,29,0.55)]'/>
                </div>
                <p className='mt-3 flex items-center justify-center font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent'>
                    {label}
                    {DOT_DELAYS.map((delay) => (
                        <span key={delay} className='dot-blink' style={{animationDelay: delay}}>.</span>
                    ))}
                </p>
            </div>
        </div>
    );
}

export function ConcertLoading({lang}: { lang: Lang }) {
    const t = getDict(lang);
    return (
        <div aria-busy='true' className='relative isolate min-h-svh overflow-x-clip pb-4'>
            <p role='status' className='sr-only'>{t.loading.sr}</p>

            <div className='relative mx-auto w-full max-w-[1440px] px-4 pb-16 pt-20 sm:px-6 md:px-10 lg:pb-20 lg:pt-24'>
                {/* nút quay lại giống hệt ở trang thật: vẫn bấm được trong lúc chờ và không nhảy khi trang thật thay vào */}
                <div className='mb-7 flex items-center justify-between gap-4 lg:mb-8'>
                    <Link
                        href={pathFor(lang, "/#archive")}
                        className='group flex -rotate-3 items-center gap-2 rounded-[4px] bg-paper px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-charcoal shadow-[0_10px_16px_-8px_rgba(0,0,0,0.8)] transition-[rotate,translate] duration-200 hover:-translate-y-0.5 hover:rotate-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'>
                        <ArrowLeft className='size-4 transition-transform duration-200 group-hover:-translate-x-1'/>
                        {t.detail.back}
                    </Link>
                </div>

                <div aria-hidden='true' className='relative lg:grid lg:grid-cols-[minmax(0,34%)_minmax(0,1fr)]'>
                    {/* cột trái: cùng bề rộng và cùng chiều cao sân khấu 4:5 với cỗ bài thật (xem PosterCard) */}
                    <div className='@container relative z-10 mx-auto w-[78%] max-w-[400px] lg:mx-0 lg:ml-[6%] lg:w-[min(91%,calc((100svh-240px)*0.8))] lg:max-w-none lg:self-start'>
                        <div className='relative h-[calc(1.25*(100cqw-20px)+66px)]'>
                            <BlankPolaroid style={{transform: "translate(2%, 1.5%) rotate(5deg)"}}/>
                            <BlankPolaroid front style={{transform: "rotate(-4deg)"}}/>
                        </div>
                    </div>

                    {/* cột phải: ba dải giấy thay tiêu đề, tấm vé đang in bám đáy */}
                    <div className='relative z-20 mt-10 flex flex-col gap-8 lg:mt-0 lg:justify-between lg:gap-6'>
                        <div className='flex flex-col gap-3 lg:-ml-[3%] lg:gap-4'>
                            {TITLE_STRIPS.map((strip, i) => (
                                <span
                                    key={i}
                                    style={{width: strip.width, marginLeft: strip.indent, rotate: `${strip.tilt}deg`}}
                                    className='paper-shimmer block h-[clamp(2.5rem,9vw,4.5rem)] rounded-[3px] lg:h-[clamp(3.5rem,6.5vw,6.5rem)]'
                                />
                            ))}
                        </div>
                        <PrintingTicket label={t.loading.printing}/>
                    </div>
                </div>
            </div>
        </div>
    );
}
