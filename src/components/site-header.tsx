"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {SettingsMenu} from "@/components/settings-menu";
import {PenRing} from "@/components/pen-ring";
import {pathFor} from "@/i18n/config";
import {BRAND_SUFFIX, OWNER_NAME} from "@/lib/brand";
import {useI18n} from "@/i18n/provider";

// langSwitch=false: trang không có bản tiếng Anh (admin) thì không hiện nút chuyển ngôn ngữ
export function SiteHeader({langSwitch = true}: { langSwitch?: boolean }) {
    const {lang, t} = useI18n();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24);
        const raf = requestAnimationFrame(onScroll);
        window.addEventListener("scroll", onScroll, {passive: true});
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("scroll", onScroll);
        };
    }, []);

    return (
        <header
            className={`fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300 ${scrolled ? "border-white/10 bg-stage/70 backdrop-blur-xl" : "border-transparent bg-transparent"}`}>
            <div className='mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6 md:px-10'>
                {/* chỉ là chữ: "đi show" được khoanh bút đỏ như vòng số ghế trên vé, rê chuột hoặc focus thì vòng vẽ lại */}
                <Link
                    href={pathFor(lang, "/")}
                    className='group whitespace-nowrap rounded-sm font-playfair-display text-lg font-semibold tracking-wide text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:text-xl'>
                    {OWNER_NAME}{" "}
                    <span className='relative inline-block px-2 italic text-accent'>
                        {BRAND_SUFFIX}
                        <PenRing redraw className='-left-1 -top-1.5 h-[calc(100%+12px)] w-[calc(100%+8px)] -rotate-[4deg]'/>
                    </span>
                </Link>
                <nav aria-label={t.header.settings} className='flex items-center'>
                    <SettingsMenu variant='site' admin languages={langSwitch}/>
                </nav>
            </div>
        </header>
    );
}
