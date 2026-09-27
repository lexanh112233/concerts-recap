import Link from "next/link";
import type {ReactNode} from "react";
import {ArrowLeft, LogOut} from "lucide-react";
import {SettingsMenu} from "@/components/settings-menu";
import {RootDocument} from "@/components/root-document";
import {pathFor, type Lang} from "@/i18n/config";
import {AdminI18nProvider} from "@/i18n/admin/provider";
import {getAdminDict} from "@/i18n/admin/server";
import {isAdmin} from "@/lib/admin-auth";
import {logoutAction} from "@/app/admin/actions";

// Chip giấy dán trên mặt bàn (không dùng header/footer công khai: admin có khung riêng)
const CHIP =
    "inline-flex h-9 items-center gap-2 whitespace-nowrap bg-ticket-stock px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink shadow-[0_6px_10px_-5px_rgba(0,0,0,0.8),inset_0_-2px_0_rgba(0,0,0,0.08)] transition-[rotate,translate] duration-200 hover:[rotate:0deg] focus-visible:[rotate:0deg] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none sm:px-3.5 sm:text-[11px] sm:tracking-[0.16em]";

// Khung chung của trang quản trị ở MỌI ngôn ngữ: root layout của app/admin (tiếng Việt) và app/en/(admin) (tiếng Anh) chỉ gọi lại đây với `lang` khác.
// Mọi trang admin là một cuốn sổ đặt trên mặt bàn tối; ngoài sổ chỉ có vài chip giấy. Nút VI | EN chính là nút của trang công khai
// (đổi tiền tố /en trên đường dẫn), nên hai bên đổi ngôn ngữ y hệt nhau.
export async function AdminShell({lang, children}: { lang: Lang, children: ReactNode }) {
    const admin = await isAdmin();
    const dict = getAdminDict(lang);

    return (
        <RootDocument lang={lang} shell={false}>
            <AdminI18nProvider lang={lang} dict={dict}>
                <div className='admin-desk relative flex min-h-dvh flex-col'>
                    <div className='grain-overlay' aria-hidden='true'/>

                    <header className='relative z-20 mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 pb-1 pt-4 sm:px-6 md:px-10'>
                        <Link href={pathFor(lang, "/")} className={`${CHIP} [rotate:-1.5deg]`}>
                            <ArrowLeft className='size-3.5'/>
                            {dict.chrome.home}
                        </Link>
                        <div className='flex items-center gap-2.5 sm:gap-5'>
                            <SettingsMenu variant='desk'/>
                            {admin && (
                                <form action={logoutAction}>
                                    <input type='hidden' name='lang' value={lang}/>
                                    <button type='submit' className={`${CHIP} cursor-pointer [rotate:1.2deg]`}>
                                        <LogOut className='size-3.5'/>
                                        {dict.chrome.logout}
                                    </button>
                                </form>
                            )}
                        </div>
                    </header>

                    <main className='relative z-10 flex flex-1 flex-col items-center px-3 pb-12 pt-5 sm:px-6'>
                        {children}
                    </main>
                </div>
            </AdminI18nProvider>
        </RootDocument>
    );
}
