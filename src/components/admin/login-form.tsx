"use client";

import {useActionState} from "react";
import {LoaderCircle, Lock} from "lucide-react";
import {loginAction, type LoginState} from "@/app/admin/actions";
import {ERROR, FOCUS, INPUT, LABEL} from "@/components/admin/paper";
import {useAdminI18n} from "@/i18n/admin/provider";

// Phần đặt trên nhãn bìa của sổ đang khoá: ô mật khẩu, hoặc lời nhắc cấu hình khi server chưa đặt ADMIN_PASSWORD
export function LoginCover({configured}: { configured: boolean }) {
    const {t} = useAdminI18n();
    if (configured) return <LoginForm/>;
    return (
        <div className='mt-4 border-t border-dashed border-ink/30 pt-3 font-playpen-sans text-[13px] leading-6 text-ink'>
            <p className='font-bold'>{t.login.lockedTitle}</p>
            <p className='text-ink/75'>
                {t.login.lockedAdd} <code className='font-mono font-semibold'>{t.login.lockedExample}</code> {t.login.lockedInto}{" "}
                <code className='font-mono font-semibold'>.env.local</code> {t.login.lockedRest}
            </p>
        </div>
    );
}

// Mật khẩu điền trên nhãn bìa sổ. Sai mật khẩu thì nhãn rung nhẹ (key theo lần thử để rung lại mỗi lần sai).
// Đúng thì action ghi cookie phiên; Next dựng lại trang /admin ngay trong phản hồi của action (giờ đã có danh sách thật) nên sổ tự mở ra, form không phải làm gì thêm.
function LoginForm() {
    const [state, action, pending] = useActionState(loginAction, {} as LoginState);
    const {t, lang} = useAdminI18n();
    // đúng mật khẩu rồi thì khoá form trong lúc bìa đang mở, tránh bấm thêm lần nữa
    const busy = pending || !!state.ok;

    return (
        <form action={action} className='mt-4 flex flex-col gap-2.5 border-t border-dashed border-ink/30 pt-3'>
            {/* action không biết mình được gọi từ /admin hay /en/admin: ngôn ngữ đi kèm form */}
            <input type='hidden' name='lang' value={lang}/>
            <label htmlFor='password' className={LABEL}>{t.login.password}</label>
            <div className='relative'>
                <Lock className='pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink/45'/>
                <input
                    id='password'
                    name='password'
                    type='password'
                    autoComplete='current-password'
                    required
                    autoFocus
                    aria-invalid={!!state.error}
                    readOnly={busy}
                    className={`${INPUT} pl-7`}
                />
            </div>
            {state.error && <p key={state.error + pending} className={`${ERROR} bk-shake`} role='alert'>{state.error}</p>}
            <button
                type='submit'
                disabled={busy}
                className={`relative mt-1 inline-flex h-11 cursor-pointer items-center justify-center gap-2 bg-accent px-6 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper shadow-[0_8px_12px_-6px_rgba(120,40,10,0.85)] transition-[rotate,opacity] duration-200 [rotate:-0.6deg] hover:[rotate:0deg] focus-visible:[rotate:0deg] disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`}>
                <span aria-hidden='true' className='pointer-events-none absolute inset-1 border border-dashed border-paper/45'/>
                {busy && <LoaderCircle className='size-4 animate-spin'/>}
                {t.login.submit}
            </button>
        </form>
    );
}
