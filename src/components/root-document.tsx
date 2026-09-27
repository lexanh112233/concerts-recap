import type {ReactNode} from "react";
import "@/app/globals.css";
import {FONT_CLASSES} from "@/app/fonts";
import {SiteShell} from "@/components/site-shell";
import type {Lang} from "@/i18n/config";
import {I18nProvider} from "@/i18n/provider";
import {getDict} from "@/i18n/server";

// <html>/<body> dùng chung cho mọi root layout: công khai tiếng Việt (app/(vi)), tiếng Anh (app/en), admin và global-error.
// Ngôn ngữ do root layout truyền vào (cố định theo cấu trúc route) nên không đọc cookie/header và trang vẫn tĩnh.
// shell=false: không có header/footer công khai (admin có khung riêng). langSwitch=false: ẩn nút VI | EN (trang không có bản tiếng Anh).
export function RootDocument({lang, shell = true, langSwitch = true, children}: { lang: Lang, shell?: boolean, langSwitch?: boolean, children: ReactNode }) {
    return (
        <html lang={lang} className={`dark ${FONT_CLASSES} h-full antialiased`}>
        <body className="flex min-h-full flex-col bg-background text-foreground">
        <I18nProvider lang={lang} dict={getDict(lang)}>
            {shell ? <SiteShell lang={lang} langSwitch={langSwitch}>{children}</SiteShell> : children}
        </I18nProvider>
        </body>
        </html>
    );
}
