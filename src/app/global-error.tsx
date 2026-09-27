"use client";

import "@/app/globals.css";
import {FONT_CLASSES} from "@/app/fonts";
import {EmptyStage, STAGE_CHIP} from "@/components/empty-stage";
import {vi} from "@/i18n/dictionaries/vi";

// Lỗi ở chính root layout (hiếm): thay thế cả layout nên phải tự có <html>/<body>, font và CSS. Dùng tiếng Việt cho mọi trường hợp.
export default function GlobalError({error, retry}: { error: Error & { digest?: string }, retry: () => void }) {
    return (
        <html lang="vi" className={`dark ${FONT_CLASSES} h-full antialiased`}>
        <body className="flex min-h-full flex-col bg-background text-foreground">
        <EmptyStage alert code={vi.error.code} title={vi.error.title} quip={vi.error.quip} note={vi.error.note} detail={error.digest}>
            <button type='button' onClick={() => retry()} className={STAGE_CHIP}>{vi.error.retry}</button>
        </EmptyStage>
        </body>
        </html>
    );
}
