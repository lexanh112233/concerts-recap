import type {Lang} from "@/i18n/config";
import {getDict} from "@/i18n/server";

export function SiteFooter({lang}: { lang: Lang }) {
    const t = getDict(lang);
    return (
        <footer className='mt-16 border-t border-white/10'>
            <div className='mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-8 text-sm text-paper/60 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-10'>
                <nav className='flex items-center gap-5'>
                    <span className='font-jetbrains-mono'>© {new Date().getFullYear()} NVDK</span>
                </nav>
            </div>
        </footer>
    );
}
