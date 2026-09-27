import type {ReactNode} from "react";

// Nút giấy nghiêng dùng cho hành động trên sân khấu trống (cùng kiểu chip "Tất cả vé" ở hero trang chi tiết, cao ≥40px để dễ bấm).
// Dùng cho cả <Link> lẫn <button>; icon mũi tên/xoay bên trong nên có class `group` sẵn.
export const STAGE_CHIP =
    "group flex -rotate-2 cursor-pointer items-center gap-2 rounded-[4px] bg-paper px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-charcoal shadow-[0_10px_16px_-8px_rgba(0,0,0,0.8)] transition-[rotate,translate] duration-200 hover:-translate-y-0.5 hover:rotate-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Liên kết chữ phụ đi kèm chip.
export const STAGE_LINK =
    "group flex items-center gap-2 rounded-sm text-sm font-semibold tracking-wide text-paper/80 transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

// Cảnh "sân khấu tắt đèn" cho mọi trạng thái rỗng hay lỗi của trang (404, lỗi dựng trang): một chùm đèn rọi xuống hai khung polaroid trống.
// Không hook, không "use client" nên dùng được ở cả server lẫn client component. Header cố định nằm trên cảnh này (pt-28 chừa chỗ).
// Chùm đèn chỉ hiện dần một lần rồi đứng yên, không nhấp nháy.
export function EmptyStage({code, title, quip, note, alert = false, detail, children}: {
    // mã ngắn kiểu "404"; ghép với `quip` thành dòng mono nhỏ dưới tiêu đề
    code: string
    title: string
    quip: string
    note: string
    // trang lỗi cần được đọc lên ngay bằng trình đọc màn hình
    alert?: boolean
    // dòng chi tiết rất nhỏ ở cuối (vd. mã lỗi để đối chiếu log)
    detail?: string
    // các hành động: một chip (className STAGE_CHIP) và có thể thêm liên kết phụ (STAGE_LINK)
    children: ReactNode
}) {
    return (
        <section
            role={alert ? "alert" : undefined}
            className='relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-28 text-center'>
            <div aria-hidden='true' className='spotlight-cone pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[85%] w-[min(120vw,760px)]'/>

            {/* hai khung polaroid trống chồng lệch, rơi xuống như ở hero trang chi tiết */}
            <div
                aria-hidden='true'
                style={{"--from": "-10deg", "--delay": "100ms"} as React.CSSProperties}
                className='land relative mb-10 h-[220px] w-[176px] sm:h-[250px] sm:w-[200px]'>
                <div className='absolute inset-0 translate-x-3 translate-y-1 rotate-[7deg] rounded-[6px] bg-[#d6d1c6] shadow-[0_30px_50px_-20px_rgba(0,0,0,0.9)]'/>
                <div className='absolute inset-0 -rotate-[5deg] rounded-[6px] bg-paper p-2.5 pb-12 shadow-[0_40px_70px_-25px_rgba(0,0,0,0.9)]'>
                    <span className='tape absolute -top-3 left-6 h-6 w-16 -rotate-[8deg]'/>
                    <div className='flex size-full items-center justify-center border-2 border-dashed border-charcoal/25'>
                        <span className='font-display text-6xl font-bold text-charcoal/30'>?</span>
                    </div>
                    <span className='absolute bottom-4 left-3 h-3 w-2/5 rounded-full bg-charcoal/15'/>
                </div>
            </div>

            <h1 className='text-balance font-playfair-display text-4xl font-bold italic text-white md:text-6xl'>{title}</h1>
            <p className='mt-4 font-mono text-xs font-bold uppercase tracking-[0.25em] text-paper/60'>
                <span className='text-accent'>{code}</span> · {quip}
            </p>
            <p className='mt-3 max-w-md text-balance font-playfair-display italic text-paper/70'>{note}</p>

            <div className='mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4'>{children}</div>

            {detail && <p className='mt-8 font-mono text-[11px] tracking-wider text-paper/35'>{detail}</p>}
        </section>
    );
}
