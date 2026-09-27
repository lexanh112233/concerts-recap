"use client";

import {useActionState, useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {LoaderCircle, Trash2} from "lucide-react";
import {deleteEventAction, type DeleteState} from "@/app/admin/actions";
import {FOCUS} from "@/components/admin/paper";
import {useAdminI18n} from "@/i18n/admin/provider";
import {format} from "@/i18n/format";

const DANGER = "#8a1f16";

// Hộp thoại xác nhận xoá: một tờ giấy nhớ dán băng dính giữa màn hình, nền tối phía sau. Dùng thẻ <dialog> native với showModal():
// tự có focus trap, phím Esc, phần còn lại của trang bị vô hiệu, và nằm ở "top layer" nên không bị transform/inert của các tờ giấy trong sổ cắt mất.
function ConfirmDialog({slug, title, variant, onClose}: { slug: string, title: string, variant: "icon" | "section", onClose: () => void }) {
    const {t, lang} = useAdminI18n();
    const [state, action, pending] = useActionState(deleteEventAction, {} as DeleteState);
    const dialog = useRef<HTMLDialogElement>(null);
    const id = useId();

    // Không đóng trong cleanup: ở chế độ dev React chạy effect hai lần (mount, cleanup, mount) và một lệnh close() ở đây sẽ bắn sự kiện `close`
    // ngay sau đó, làm hộp thoại vừa mở đã bị đóng. Gỡ thẻ khỏi DOM là đủ để nó rời khỏi lớp trên cùng; đóng bằng nút/Esc thì đã đi qua close() nên trình duyệt tự trả focus.
    useEffect(() => {
        const el = dialog.current;
        if (el && !el.open) el.showModal();
    }, []);

    return (
        <dialog
            ref={dialog}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-body`}
            // Esc: đang xoá dở thì không cho đóng (tránh tưởng đã huỷ trong khi server vẫn chạy)
            onCancel={(e) => {
                if (pending) e.preventDefault();
            }}
            onClose={onClose}
            // bấm ra nền tối (chính thẻ dialog, vì tờ giấy bên trong phủ kín nó) thì đóng
            onClick={(e) => {
                if (e.target === e.currentTarget && !pending) dialog.current?.close();
            }}
            className='note-dialog m-auto w-[min(23rem,calc(100vw-2rem))] max-w-none overflow-visible bg-transparent p-0 text-ink backdrop:bg-[#0d0a07]/70 backdrop:backdrop-blur-[2px]'>
            <div className='relative rotate-[-1.5deg] bg-[#efe7d8] px-6 pb-5 pt-9 shadow-[0_26px_34px_-12px_rgba(0,0,0,0.9)]'>
                <span aria-hidden='true' className='tape pointer-events-none absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-[3deg]'/>

                {/* Sự kiện của portal vẫn nổi bọt theo CÂY REACT (không theo DOM): hộp thoại mở từ trong form sửa thì lệnh submit của form này sẽ chạy nhầm
                    onSubmit của form sửa (tức là LƯU sự kiện thay vì xoá). Chặn ở đây để form xoá tự chạy action của nó. */}
                <form action={action} onSubmit={(e) => e.stopPropagation()} className='flex flex-col'>
                    <input type='hidden' name='slug' value={slug}/>
                    <input type='hidden' name='lang' value={lang}/>

                    <h2 id={`${id}-title`} className='font-playpen-sans text-[1.65rem] font-bold leading-none'>{t.delete.dialogTitle}</h2>
                    <p className='mt-3 font-playfair-display text-[1.1rem] font-semibold italic leading-snug [overflow-wrap:anywhere]'>{title}</p>
                    <p id={`${id}-body`} className='mt-3 font-playpen-sans text-[14px] font-semibold leading-snug' style={{color: DANGER}}>{t.delete.body}</p>
                    <p className='mt-2.5 border-t border-dashed border-ink/25 pt-2.5 font-playpen-sans text-[12.5px] leading-snug text-ink/60'>{variant === "section" ? format(t.delete.hintForm, {visible: t.form.visible}) : t.delete.hint}</p>

                    {state.error && (
                        <p className='mt-3 bg-[#f6dcd6] px-3 py-2 font-playpen-sans text-[13px] font-semibold text-[#8a1f16]' role='alert'>{state.error}</p>
                    )}

                    <div className='mt-5 flex items-center justify-between gap-3'>
                        <button
                            type='button'
                            autoFocus
                            disabled={pending}
                            onClick={() => dialog.current?.close()}
                            className={`inline-flex h-10 cursor-pointer items-center bg-ticket-stock px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink shadow-[0_6px_10px_-5px_rgba(0,0,0,0.8)] transition-[rotate,opacity] duration-200 [rotate:-1deg] hover:[rotate:0deg] focus-visible:[rotate:0deg] disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none ${FOCUS}`}>
                            {t.delete.keep}
                        </button>
                        <button
                            type='submit'
                            disabled={pending}
                            style={{backgroundColor: DANGER}}
                            className={`relative inline-flex h-10 min-w-32 cursor-pointer items-center justify-center gap-2 px-5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-paper shadow-[0_8px_12px_-6px_rgba(90,20,10,0.9)] transition-[rotate,opacity] duration-200 [rotate:0.8deg] hover:[rotate:0deg] focus-visible:[rotate:0deg] disabled:cursor-default disabled:opacity-70 motion-reduce:transition-none ${FOCUS}`}>
                            <span aria-hidden='true' className='pointer-events-none absolute inset-1 border border-dashed border-paper/45'/>
                            {pending && <LoaderCircle className='size-4 animate-spin'/>}
                            {pending ? t.delete.deleting : t.delete.confirm}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}

// Nút xoá một sự kiện; bấm thì hỏi xác nhận (không bao giờ xoá thẳng). `icon`: thùng rác nhỏ ở mỗi dòng danh sách; `section`: nút chữ trong form sửa.
export function DeleteEventButton({slug, title, variant}: { slug: string, title: string, variant: "icon" | "section" }) {
    const {t} = useAdminI18n();
    const [open, setOpen] = useState(false);
    const label = format(t.delete.trigger, {title});

    return (
        <>
            {variant === "icon" ? (
                <button
                    type='button'
                    aria-label={label}
                    title={t.delete.tooltip}
                    onClick={() => setOpen(true)}
                    className={`flex size-6 cursor-pointer items-center justify-center rounded-md text-ink/65 transition-colors hover:bg-[#8a1f16]/10 hover:text-[#8a1f16] @md:size-7 ${FOCUS}`}>
                    <Trash2 className='size-4'/>
                </button>
            ) : (
                <button
                    type='button'
                    onClick={() => setOpen(true)}
                    className={`inline-flex h-10 cursor-pointer items-center gap-2 self-start border border-dashed border-[#8a1f16]/55 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a1f16] transition-colors hover:bg-[#8a1f16]/10 ${FOCUS}`}>
                    <Trash2 className='size-4'/>
                    {t.delete.sectionButton}
                </button>
            )}
            {/* portal ra <body>: tránh cắt bởi trang giấy đang cuộn, và không lồng <form> trong form sửa */}
            {open && createPortal(<ConfirmDialog slug={slug} title={title} variant={variant} onClose={() => setOpen(false)}/>, document.body)}
        </>
    );
}
