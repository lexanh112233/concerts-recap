"use client";

import type {ReactNode} from "react";
import {PenRing} from "@/components/pen-ring";
import {useAdminI18n} from "@/i18n/admin/provider";
import {BRAND_SUFFIX, OWNER_NAME} from "@/lib/brand";

// Bìa sổ: da đen nhám (nền do .bk-cover), dây thun đỏ dọc, và một nhãn giấy dán băng dính ghi tên.
// Dùng cho cả cuốn sổ quản trị (book.tsx) lẫn trang đăng nhập; `children` là phần đặt thêm trên nhãn (vd. ô mật khẩu).
export function BookCover({children}: { children?: ReactNode }) {
    const {t} = useAdminI18n();
    return (
        <div className='relative size-full'>
            {/* dây thun */}
            <span
                aria-hidden='true'
                className='absolute inset-y-0 right-[15%] w-4 bg-[linear-gradient(90deg,#7a2510,#c1481d_40%,#a93a15_65%,#6e210d)] shadow-[-3px_0_6px_rgba(0,0,0,0.45),3px_0_6px_rgba(0,0,0,0.35)]'
            />
            <span aria-hidden='true' className='absolute inset-y-0 right-[calc(15%+7px)] w-px bg-white/15'/>

            <div className='absolute left-1/2 top-1/2 w-[72%] max-w-[380px] -translate-x-[56%] -translate-y-1/2'>
                <div className='relative -rotate-[2deg] bg-ticket-stock px-5 pb-6 pt-8 text-ink shadow-[0_18px_28px_-10px_rgba(0,0,0,0.85)]'>
                    <span className='tape absolute -top-3 left-[10%] h-6 w-20 -rotate-[7deg]'/>
                    <span className='tape absolute -top-2.5 right-[8%] h-6 w-16 rotate-[5deg]'/>

                    <p className='font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-ink/55'>{t.cover.kicker}</p>
                    <p className='mt-3 font-playfair-display text-[1.9rem] font-semibold leading-none tracking-wide'>
                        {OWNER_NAME}{" "}
                        <span className='relative inline-block px-2 italic text-accent'>
                            {BRAND_SUFFIX}
                            <PenRing className='-left-1 -top-1.5 h-[calc(100%+12px)] w-[calc(100%+8px)] -rotate-[4deg]'/>
                        </span>
                    </p>
                    <p className='mt-5 inline-block bg-[#1a1a1a] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_6px_-3px_rgba(0,0,0,0.7)]'>
                        {t.cover.label}
                    </p>
                    <p className='mt-3 font-playpen-sans text-[13px] leading-snug text-ink/60'>{t.cover.private}</p>

                    {children}
                </div>
            </div>
        </div>
    );
}
