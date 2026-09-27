"use client";

import Link from "next/link";
import {useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode} from "react";
import {ArrowLeft, LoaderCircle, Star} from "lucide-react";
import {saveEventAction, type SaveState} from "@/app/admin/actions";
import {Book, type BookHandle} from "@/components/admin/book/book";
import {BookCover} from "@/components/admin/book/cover";
import {CostRows} from "@/components/admin/cost-rows";
import {DatePicker} from "@/components/admin/date-picker";
import {DeleteEventButton} from "@/components/admin/delete-event-button";
import {MediaUploader, type MediaUploaderHandle} from "@/components/admin/media-uploader";
import {ERROR, FOCUS, HINT, INPUT, LABEL} from "@/components/admin/paper";
import {RichTextEditor} from "@/components/admin/rich-text-editor";
import {storedDate, type EventFormValues} from "@/lib/event-input";
import {pathFor} from "@/i18n/config";
import {useAdminI18n} from "@/i18n/admin/provider";
import {groupedNumber} from "@/i18n/admin/validation";
import {format} from "@/i18n/format";
import {isUpcoming} from "@/lib/concerts";
import {EVENT_PAGE_COUNT, errorPages, firstErrorPage} from "@/lib/event-pages";
import {MAX_TICKET_PRICE, formatPrice, normalizePrice} from "@/lib/price";

function Field({label, htmlFor, error, hint, className = "", children}: {
    label: string
    htmlFor: string
    error?: string
    hint?: string
    className?: string
    children: ReactNode
}) {
    return (
        <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
            <label htmlFor={htmlFor} className={LABEL}>{label}</label>
            {children}
            {error ? (
                <p className={ERROR} role='alert'>{error}</p>
            ) : hint ? (
                <p className={HINT}>{hint}</p>
            ) : null}
        </div>
    );
}

// Đầu mỗi trang giấy: nhãn Dymo đỏ ghi tên trang, đường đứt, số trang
function PageHead({label, no, level = 2}: { label: string, no: number, level?: 1 | 2 }) {
    const Heading = level === 1 ? "h1" : "h2";
    return (
        <header className='mb-4 flex items-center gap-3'>
            <Heading className='dymo shrink-0 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white [--dymo:var(--brand)]'>{label}</Heading>
            <span aria-hidden='true' className='h-px flex-1 border-t border-dashed border-ink/30'/>
            <span className='font-mono text-[11px] tracking-[0.12em] text-ink/45'>{no}/{EVENT_PAGE_COUNT}</span>
        </header>
    );
}

// Tiêu đề một mục trong trang: băng Dymo đen nhỏ
function Section({title, className = "", children}: { title: string, className?: string, children: ReactNode }) {
    return (
        <fieldset className={`min-w-0 ${className}`}>
            <legend className='dymo mb-3 inline-block px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white'>{title}</legend>
            {children}
        </fieldset>
    );
}

// Giá vé: gõ số cho thoải mái ("1500000", "1.500.000đ"), bên dưới hiện luôn số tiền đã hiểu được để khỏi nhầm số 0
function PriceField({defaultValue, error}: { defaultValue: string, error?: string }) {
    const {t, lang} = useAdminI18n();
    const [raw, setRaw] = useState(defaultValue);
    const price = normalizePrice(raw);
    const hint = price === null
        ? format(t.form.priceHintInvalid, {max: groupedNumber(MAX_TICKET_PRICE, lang)})
        : price === ""
            ? t.form.priceHintEmpty
            : price === "0" ? t.form.priceHintFree : format(t.form.priceHintParsed, {price: formatPrice(Number(price), lang) ?? ""});

    return (
        <Field label={t.form.price} htmlFor='ticketPrice' error={error} hint={hint}>
            <div className='relative'>
                <input
                    id='ticketPrice'
                    name='ticketPrice'
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    inputMode='numeric'
                    autoComplete='off'
                    aria-invalid={!!error}
                    placeholder={t.form.pricePlaceholder}
                    className={`${INPUT} pr-6`}
                />
                <span aria-hidden='true' className='pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 font-playpen-sans text-sm text-ink/50'>đ</span>
            </div>
        </Field>
    );
}

function RatingPicker({defaultValue}: { defaultValue: number }) {
    const {t} = useAdminI18n();
    const [value, setValue] = useState(defaultValue);
    return (
        <div className='flex items-center gap-1' role='radiogroup' aria-label={t.form.rating}>
            <input type='hidden' name='rating' value={value}/>
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type='button'
                    role='radio'
                    aria-checked={value === n}
                    aria-label={format(t.form.ratingStar, {n})}
                    onClick={() => setValue(value === n ? 0 : n)}
                    className={`cursor-pointer rounded p-1 transition-transform hover:scale-110 ${FOCUS}`}>
                    <Star className={`size-7 ${n <= value ? "fill-accent text-accent" : "text-ink/30"}`}/>
                </button>
            ))}
            <span className='ml-2 font-mono text-sm text-ink/60'>{value}/5</span>
        </div>
    );
}

export function EventForm({initial, originalSlug, r2Enabled, savedNet}: {
    initial: EventFormValues
    originalSlug?: string
    r2Enabled: boolean
    // "Thực chi 1.750.000đ" của lần lưu gần nhất (chưa phản ánh chỗ đang sửa dở); null khi chưa có giá vé
    savedNet?: string | null
}) {
    const {t, lang} = useAdminI18n();
    const [state, formAction, pending] = useActionState(saveEventAction, {} as SaveState);
    const [, startTransition] = useTransition();
    const media = useRef<MediaUploaderHandle>(null);
    const book = useRef<BookHandle>(null);
    // còn ảnh HEIC đang được đổi sang JPEG trên trình duyệt
    const [converting, setConverting] = useState(false);
    // đang tải ảnh/video mới lên R2 (chỉ xảy ra sau khi bấm Lưu)
    const [upload, setUpload] = useState<{ done: number, total: number } | null>(null);
    // ngày đang chọn, để gợi ý khi đêm này còn ở tương lai (chỉ là gợi ý: ô "hiện trên trang chủ" không tự đổi)
    const [date, setDate] = useState(initial.date);
    const [now] = useState(() => new Date());
    const upcoming = isUpcoming(storedDate(date), now);
    const errors = state.errors ?? {};
    const flagged = errorPages(state.errors);

    // Còn thay đổi chưa lưu. Đổi ngôn ngữ (VI ↔ EN) là chuyển sang root layout khác nên tải lại cả trang và sẽ mất chữ đang gõ dở:
    // trình duyệt được hỏi lại trước khi rời trang (cũng chặn luôn việc lỡ tay đóng tab). So ảnh chụp các trường lúc mở form với lúc rời
    // (gồm cả trường ẩn của ô ngày, sao, chi phí, nhật ký) nên không sót ô nào; file mới chọn (chưa nằm trong trường nào) đánh dấu riêng.
    const formEl = useRef<HTMLFormElement>(null);
    const opened = useRef<string | null>(null);
    const picked = useRef(false);
    const saving = useRef(false);
    useEffect(() => {
        const snapshot = () => JSON.stringify([...new FormData(formEl.current as HTMLFormElement)].filter(([, v]) => typeof v === "string"));
        // sau một nhịp để các ô tự chuẩn hoá giá trị ban đầu (vd. trình soạn thảo) xong đã
        const timer = setTimeout(() => {
            opened.current = snapshot();
        }, 300);
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (saving.current || opened.current === null) return;
            if (picked.current || snapshot() !== opened.current) e.preventDefault();
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("beforeunload", onBeforeUnload);
        };
    }, []);

    // Server báo lỗi ở ô nào thì sổ tự lật tới trang có lỗi đầu tiên (mọi ô luôn nằm trong DOM nên form vẫn nộp đủ dữ liệu)
    useEffect(() => {
        // lưu xong mà server trả lỗi (không chuyển hướng): vẫn còn dữ liệu chưa lưu nên bật lại chốt chặn rời trang
        saving.current = false;
        const page = firstErrorPage(state.errors);
        if (page !== null) book.current?.goTo(page);
    }, [state]);

    // Không truyền hàm vào prop action của <form>: React sẽ reset toàn bộ ô nhập khi có lỗi.
    // Ảnh/video mới chỉ lên R2 ở đây, sau khi bấm Lưu (hủy form thì không để lại file mồ côi trên R2); có file tải lỗi thì không lưu.
    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (upload || pending || !media.current) return;

        setUpload({done: 0, total: 0});
        let urls: string[] | null;
        try {
            urls = await media.current.commit((done, total) => setUpload({done, total}));
        } finally {
            setUpload(null);
        }
        if (!urls) {
            // có file tải lỗi: ô báo lỗi nằm ở trang ảnh nên lật tới đó cho thấy
            book.current?.goTo(3);
            return;
        }

        const data = new FormData(form);
        data.set("images", JSON.stringify(urls));
        // đang lưu: lưu xong server chuyển hướng về danh sách nên không được hỏi "rời trang?" nữa
        saving.current = true;
        startTransition(() => formAction(data));
    };

    const busy = pending || converting || !!upload;

    const pages = [
        // ---- Trang 1: thông tin chính + tấm vé ----
        <section key='info' aria-label={t.form.pageTabs[0]}>
            <PageHead level={1} label={originalSlug ? t.form.editEvent : t.form.newEvent} no={1}/>
            <div className='flex flex-col gap-3.5'>
                <Field label={t.form.title} htmlFor='title' error={errors.title}>
                    <input id='title' name='title' defaultValue={initial.title} aria-invalid={!!errors.title} className={INPUT} placeholder={t.form.titlePlaceholder}/>
                </Field>
                <div className='grid gap-3.5 @[320px]:grid-cols-2'>
                    <Field label={t.form.artist} htmlFor='artistName' error={errors.artistName}>
                        <input id='artistName' name='artistName' defaultValue={initial.artistName} aria-invalid={!!errors.artistName} className={INPUT}/>
                    </Field>
                    <Field label={t.form.date} htmlFor='date' error={errors.date}>
                        <DatePicker id='date' name='date' defaultValue={initial.date} invalid={!!errors.date} className={INPUT} onChange={setDate}/>
                    </Field>
                    <Field label={t.form.venue} htmlFor='venue' error={errors.venue}>
                        <input id='venue' name='venue' defaultValue={initial.venue} aria-invalid={!!errors.venue} className={INPUT} placeholder={t.form.venuePlaceholder}/>
                    </Field>
                    <Field label={t.form.city} htmlFor='city' error={errors.city}>
                        <input id='city' name='city' defaultValue={initial.city} aria-invalid={!!errors.city} className={INPUT}/>
                    </Field>
                </div>

                {/* tấm vé: khung đứt như đường xé, nhãn Dymo đè lên mép trên */}
                <fieldset className='relative mt-3 min-w-0 border-2 border-dashed border-ink/30 px-3.5 pb-4 pt-6'>
                    <legend className='dymo absolute -top-3 left-3 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white'>{t.form.ticketBox}</legend>
                    <div className='flex flex-col gap-3.5'>
                        <div className='grid grid-cols-3 gap-3'>
                            <Field label={t.form.zone} htmlFor='zone' error={errors.zone}>
                                <input id='zone' name='zone' defaultValue={initial.zone} aria-invalid={!!errors.zone} className={INPUT}/>
                            </Field>
                            <Field label={t.form.row} htmlFor='row' error={errors.row}>
                                <input id='row' name='row' defaultValue={initial.row} aria-invalid={!!errors.row} className={INPUT}/>
                            </Field>
                            <Field label={t.form.seat} htmlFor='seat' error={errors.seat}>
                                <input id='seat' name='seat' defaultValue={initial.seat} aria-invalid={!!errors.seat} className={INPUT}/>
                            </Field>
                        </div>
                        <div className='grid gap-3.5 @[320px]:grid-cols-2'>
                            <Field label={t.form.companion} htmlFor='companion' error={errors.companion} hint={t.form.companionHint}>
                                <input id='companion' name='companion' defaultValue={initial.companion} aria-invalid={!!errors.companion} className={INPUT}/>
                            </Field>
                            <PriceField defaultValue={initial.ticketPrice} error={errors.ticketPrice}/>
                        </div>
                    </div>
                </fieldset>
            </div>
        </section>,

        // ---- Trang 2: chi phí phát sinh + bán lại merch ----
        <section key='costs' aria-label={t.form.pageTabs[1]}>
            <PageHead label={t.form.costsHeading} no={2}/>
            <div className='flex flex-col gap-6'>
                <Section title={t.form.extraCosts}>
                    <CostRows
                        name='extraCosts'
                        initial={initial.extraCosts}
                        error={errors.extraCosts}
                        placeholder={t.form.extraPlaceholder}
                        quickAdds={t.form.extraQuickAdds}
                    />
                </Section>
                {/* field lưu DB vẫn tên cũ merchResale (khoản thu hồi gồm cả bán merch, pass vé, voucher...) */}
                <Section title={t.form.recoup}>
                    <CostRows
                        name='merchResale'
                        initial={initial.merchResale}
                        error={errors.merchResale}
                        placeholder={t.form.recoupPlaceholder}
                        quickAdds={t.form.recoupQuickAdds}
                        hint={t.form.recoupHint}
                    />
                </Section>
                {savedNet && (
                    <p className='relative ml-auto -rotate-2 bg-[#f1de8a] px-4 pb-2.5 pt-4 font-playpen-sans text-[13px] leading-snug shadow-[0_10px_14px_-8px_rgba(38,30,20,0.7)]'>
                        <span aria-hidden='true' className='tape absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[3deg] opacity-90'/>
                        <span className='block text-[11px] opacity-65'>{t.form.savedNet}</span>
                        <span className='font-bold'>{savedNet}</span>
                    </p>
                )}
            </div>
        </section>,

        // ---- Trang 3: nhật ký ----
        <section key='journal' aria-label={t.form.pageTabs[2]}>
            <PageHead label={t.form.journalHeading} no={3}/>
            <RichTextEditor
                name='body'
                label={t.form.body}
                defaultValue={initial.body}
                error={errors.body}
                hint={""}
            />
        </section>,

        // ---- Trang 4: ảnh & video, đánh giá, hiển thị ----
        <section key='media' aria-label={t.form.pageTabs[3]}>
            <PageHead label={t.form.mediaHeading} no={4}/>
            <div className='flex flex-col gap-6'>
                <Section title={t.form.media}>
                    <MediaUploader
                        ref={media}
                        initial={initial.images}
                        r2Enabled={r2Enabled}
                        error={errors.images}
                        onBusyChange={setConverting}
                    />
                </Section>
                <Section title={t.form.ratingSection}>
                    <div className='flex flex-col gap-3'>
                        <RatingPicker defaultValue={Number(initial.rating)}/>
                        {errors.rating && <p className={ERROR} role='alert'>{errors.rating}</p>}
                        <label className='flex cursor-pointer items-center gap-3 font-playpen-sans text-sm text-ink'>
                            <input type='checkbox' name='active' defaultChecked={initial.active} className='size-4 shrink-0 accent-[var(--brand)]'/>
                            {t.form.visible}
                        </label>
                        <p className={HINT}>{t.form.visibleHint}</p>
                        {upcoming && <p className={HINT} role='status'>{t.form.upcomingHint}</p>}
                    </div>
                </Section>
                {/* chỉ khi sửa một sự kiện đã có: thêm mới thì chưa có gì để xoá */}
                {originalSlug && (
                    <Section title={t.delete.sectionTitle}>
                        <div className='flex flex-col gap-3'>
                            <p className={HINT}>{t.delete.sectionHint}</p>
                            <DeleteEventButton slug={originalSlug} title={initial.title} variant='section'/>
                        </div>
                    </Section>
                )}
            </div>
        </section>,
    ];

    const tabs = t.form.pageTabs.map((label, page) => ({label, page, flag: flagged.has(page)}));

    const saveLabel = converting
        ? t.form.converting
        : upload
            ? (upload.total > 0 ? format(t.form.uploading, {done: Math.min(upload.done + 1, upload.total), total: upload.total}) : t.form.preparing)
            : pending ? t.form.saving : originalSlug ? t.form.saveEdit : t.form.saveNew;

    const footer = (
        <div className='flex flex-col gap-3'>
            {errors.form && (
                <p className='bg-[#f6dcd6] px-3.5 py-2.5 font-playpen-sans text-sm font-semibold text-[#8a1f16] shadow-[0_8px_12px_-8px_rgba(0,0,0,0.8)]' role='alert'>{errors.form}</p>
            )}
            <div className='flex items-center justify-between gap-3'>
                <Link
                    href={pathFor(lang, "/admin")}
                    className={`inline-flex h-10 items-center gap-2 bg-ticket-stock px-4 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink shadow-[0_6px_10px_-5px_rgba(0,0,0,0.8)] transition-[rotate] duration-200 [rotate:-1deg] hover:[rotate:0deg] focus-visible:[rotate:0deg] motion-reduce:transition-none ${FOCUS}`}>
                    <ArrowLeft className='size-3.5'/>
                    {t.form.cancel}
                </Link>
                <button
                    type='submit'
                    disabled={busy}
                    className={`relative inline-flex h-11 min-w-44 cursor-pointer items-center justify-center gap-2 bg-accent px-6 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper shadow-[0_8px_12px_-6px_rgba(120,40,10,0.85)] transition-[rotate,opacity] duration-200 [rotate:0.8deg] hover:[rotate:0deg] focus-visible:[rotate:0deg] disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`}>
                    <span aria-hidden='true' className='pointer-events-none absolute inset-1 border border-dashed border-paper/45'/>
                    {busy && <LoaderCircle className='size-4 animate-spin'/>}
                    {saveLabel}
                </button>
            </div>
        </div>
    );

    return (
        <form
            ref={formEl}
            onSubmit={onSubmit}
            onChange={(e) => {
                if (e.target instanceof HTMLInputElement && e.target.type === "file") picked.current = true;
            }}
            className='w-full'>
            <input type='hidden' name='originalSlug' value={originalSlug ?? ""}/>
            {/* server action không biết mình được gọi từ /admin hay /en/admin: ngôn ngữ đi kèm form */}
            <input type='hidden' name='lang' value={lang}/>
            <Book
                ref={book}
                className='bk-form'
                label={originalSlug ? t.form.bookEdit : t.form.bookNew}
                cover={<BookCover/>}
                pages={pages}
                tabs={tabs}
                tagLabel={t.form.firstPageBack}
                tagText={t.form.firstPageTag}
                footer={footer}
            />
        </form>
    );
}
