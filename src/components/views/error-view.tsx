"use client";

import Link from "next/link";
import {useEffect} from "react";
import {ArrowLeft, RotateCw} from "lucide-react";
import {EmptyStage, STAGE_CHIP, STAGE_LINK} from "@/components/empty-stage";
import {pathFor} from "@/i18n/config";
import {format} from "@/i18n/format";
import {useI18n} from "@/i18n/provider";

// Fallback lỗi chung khi một trang không dựng được (thường là DB hay mạng chập chờn), cùng họ giao diện với trang 404.
// Next 16.3: retry() dựng lại đoạn bị lỗi từ server; reset() chỉ xóa trạng thái lỗi mà không tải lại nội dung nên không dùng ở đây.
// Ngôn ngữ lấy từ I18nProvider của root layout (error.tsx là client boundary, không nhận params).
export function ErrorView({error, retry}: {
    error: Error & { digest?: string }
    retry: () => void
}) {
    const {lang, t} = useI18n();

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <EmptyStage
            alert
            code={t.error.code}
            title={t.error.title}
            quip={t.error.quip}
            note={t.error.note}
            detail={error.digest ? format(t.error.digest, {digest: error.digest}) : undefined}>
            <button type='button' onClick={() => retry()} className={STAGE_CHIP}>
                <RotateCw className='size-4 transition-transform duration-300 group-hover:rotate-180'/>
                {t.error.retry}
            </button>
            <Link href={pathFor(lang, "/")} className={STAGE_LINK}>
                <ArrowLeft className='size-4 transition-transform duration-200 group-hover:-translate-x-1'/>
                {t.notFound.home}
            </Link>
        </EmptyStage>
    );
}
