"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {PenRing} from "@/components/pen-ring";
import {pathFor} from "@/i18n/config";
import {useAdminI18n} from "@/i18n/admin/provider";
import {plural} from "@/i18n/format";

const VISIBLE_MS = 4200;
// có dòng cảnh báo về file R2 thì để lâu hơn cho kịp đọc
const WARNING_MS = 9000;

// Toast báo "đã lưu" (kèm link xem trang) hoặc "đã xoá" (kèm dòng phụ khi còn file R2 chưa xoá được): một tờ giấy nhớ viết tay dán lên góc bàn, không phải hộp thông báo. Rơi xuống nghiêng nghiêng,
// bấm vào tờ giấy (hoặc chờ vài giây) thì được bóc đi. Đang rê chuột/focus vào thì chưa bóc để kịp bấm "xem trang".
// Dọn ?saved= / ?deleted= / ?leftover= khỏi URL bằng history.replaceState (không dùng router: trang server dựng lại sẽ làm tờ giấy biến mất ngay).
export function SavedNote(props: { kind?: "saved", slug: string } | { kind: "deleted", leftover?: number }) {
    const {t, lang} = useAdminI18n();
    const deleted = props.kind === "deleted";
    const leftover = props.kind === "deleted" ? props.leftover ?? 0 : 0;
    const [gone, setGone] = useState(false);
    const [held, setHeld] = useState(false);

    useEffect(() => {
        window.history.replaceState(null, "", pathFor(lang, "/admin"));
    }, [lang]);

    useEffect(() => {
        if (gone || held) return;
        const timer = setTimeout(() => setGone(true), leftover > 0 ? WARNING_MS : VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [gone, held, leftover]);

    return (
        <div
            role='status'
            aria-live='polite'
            onPointerEnter={() => setHeld(true)}
            onPointerLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
            // .land đặt ở lớp ngoài: animation fill "both" giữ rotate: 0 nên sẽ đè mất độ nghiêng nếu đặt cùng chỗ với lớp trong
            style={{"--from": "14deg", "--delay": "120ms"} as React.CSSProperties}
            className={`land fixed bottom-6 right-4 z-[600] w-[236px] sm:bottom-9 sm:right-9 ${gone ? "pointer-events-none" : ""}`}>
            <div
                className={`relative rotate-[3deg] bg-[#efe7d8] px-5 pb-4 pt-7 text-ink shadow-[0_22px_26px_-10px_rgba(0,0,0,0.85)] transition-[opacity,translate,rotate] duration-500 ease-out motion-reduce:transition-none ${gone ? "translate-x-8 -translate-y-3 rotate-[13deg] opacity-0" : ""}`}>
                {/* bấm vào tờ giấy để bóc; nằm dưới liên kết nên "xem trang" vẫn bấm được */}
                <button
                    type='button'
                    aria-label={t.saved.peel}
                    tabIndex={gone ? -1 : 0}
                    onClick={() => setGone(true)}
                    className='absolute inset-0 cursor-pointer outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
                />
                <span aria-hidden='true' className='tape pointer-events-none absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-[4deg]'/>

                <p className='pointer-events-none font-playpen-sans text-[1.65rem] font-bold leading-none'>{deleted ? t.deleted.title : t.saved.title}</p>
                <p className='pointer-events-none mt-1.5 font-playpen-sans text-[13px] leading-snug text-ink/60'>{deleted ? t.deleted.sub : t.saved.sub}</p>

                {props.kind === "deleted" ? (
                    // còn file R2 chưa xoá được thì nói thẳng (thường là token R2 chưa có quyền xoá), không để file mồ côi mà không ai biết
                    leftover > 0 && (
                        <p className='pointer-events-none mt-2.5 border-t border-dashed border-ink/25 pt-2 font-playpen-sans text-[12.5px] font-semibold leading-snug text-[#8a1f16]'>
                            {plural(lang, t.deleted.leftover, leftover)}
                        </p>
                    )
                ) : (
                    <Link
                        href={pathFor(lang, `/concerts/${props.slug}`)}
                        tabIndex={gone ? -1 : 0}
                        className='group relative mt-3.5 inline-block px-3 py-1 font-playpen-sans text-[14px] font-semibold outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'>
                        {t.saved.view}
                        <PenRing redraw className='-left-0.5 -top-1 h-[calc(100%+8px)] w-[calc(100%+4px)] -rotate-[3deg]'/>
                    </Link>
                )}
            </div>
        </div>
    );
}
