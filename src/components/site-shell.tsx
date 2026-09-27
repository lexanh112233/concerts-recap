import type {ReactNode} from "react";
import {SiteFooter} from "@/components/site-footer";
import {SiteHeader} from "@/components/site-header";
import type {Lang} from "@/i18n/config";

// Khung chung của các trang công khai: nhiễu film, header cố định, thân trang, footer.
export function SiteShell({lang, langSwitch = true, children}: { lang: Lang, langSwitch?: boolean, children: ReactNode }) {
    return (
        <>
            <div className="grain-overlay" aria-hidden="true"/>
            <SiteHeader langSwitch={langSwitch}/>
            <main className="flex-1">{children}</main>
            <SiteFooter lang={lang}/>
        </>
    );
}
