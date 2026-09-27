import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {EmptyStage, STAGE_CHIP} from "@/components/empty-stage";
import {pathFor, type Lang} from "@/i18n/config";
import {getDict} from "@/i18n/server";

// Trang 404 theo ngôn ngữ. variant "concert": slug đêm diễn không có (quay về lưu trữ); mặc định: đường dẫn không khớp route nào
// hoặc một trang gọi notFound() mà không có not-found riêng (vd. sửa sự kiện ở /admin).
export function NotFoundView({lang, variant = "page"}: { lang: Lang, variant?: "page" | "concert" }) {
    const t = getDict(lang);
    const concert = variant === "concert";
    return (
        <EmptyStage
            code='404'
            title={concert ? t.notFound.concertTitle : t.notFound.title}
            quip={concert ? t.notFound.concertQuip : t.notFound.quip}
            note={concert ? t.notFound.concertNote : t.notFound.note}>
            <Link href={pathFor(lang, concert ? "/#archive" : "/")} className={STAGE_CHIP}>
                <ArrowLeft className='size-4 transition-transform duration-200 group-hover:-translate-x-1'/>
                {concert ? t.detail.back : t.notFound.home}
            </Link>
        </EmptyStage>
    );
}
