import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {EmptyStage, STAGE_CHIP} from "@/components/empty-stage";
import {pathFor, type Lang} from "@/i18n/config";
import {getAdminDict} from "@/i18n/admin/server";

// notFound() trong admin (vd. sửa một đêm không tồn tại): quay về sổ quản trị (cùng ngôn ngữ) chứ không về trang chủ công khai
export function AdminNotFoundView({lang}: { lang: Lang }) {
    const t = getAdminDict(lang).notFound;
    return (
        <EmptyStage code='404' title={t.title} quip={t.quip} note={t.note}>
            <Link href={pathFor(lang, "/admin")} className={STAGE_CHIP}>
                <ArrowLeft className='size-4 transition-transform duration-200 group-hover:-translate-x-1'/>
                {t.back}
            </Link>
        </EmptyStage>
    );
}
