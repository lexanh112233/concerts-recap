"use client";

import {useRef, useState} from "react";
import {Plus, X} from "lucide-react";
import type {CostRowInput} from "@/lib/costs";
import {ERROR, FOCUS, GHOST_BUTTON, HINT, INPUT} from "@/components/admin/paper";
import {useAdminI18n} from "@/i18n/admin/provider";
import {format} from "@/i18n/format";
import {groupedNumber} from "@/i18n/admin/validation";
import {normalizePrice} from "@/lib/price";

interface Row {
    id: string
    label: string
    amount: string
}

const toRow = (r: CostRowInput, i: number): Row => ({id: `initial-${i}`, label: r.label, amount: r.amount});

// Số tiền hợp lệ của một dòng (0 nếu chưa gõ hoặc gõ sai — để tính tổng chạy êm ngay khi đang gõ, không chờ submit).
function rowAmount(amount: string) {
    const price = normalizePrice(amount);
    return price ? Number(price) : 0;
}

// Danh sách "nhãn + số tiền" tự do, thêm/xoá dòng tự do (không cần sắp thứ tự). Tự quản lấy state và tự có input ẩn
// JSON hoá để nộp cùng form (giống PriceField/RatingPicker/DatePicker — không cần lift state lên EventForm).
// Dùng cho cả "Chi phí phát sinh" và "Khoản thu hồi"; `name` quyết định field nào (khớp parseEventForm ở event-input.ts).
export function CostRows({name, initial, error, placeholder, quickAdds, hint}: {
    name: string
    initial: CostRowInput[]
    error?: string
    // gợi ý trong ô nhãn, vd. "Nhãn, vd. Taxi"
    placeholder: string
    // nhãn gợi ý bấm-là-thêm-dòng (vd. "Taxi", "Grab"); không có thì không hiện dải chip
    quickAdds?: string[]
    // ghi chú nhỏ dưới danh sách (vd. gợi ý những gì tính là khoản thu hồi)
    hint?: string
}) {
    const {t, lang} = useAdminI18n();
    const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
    const labelRefs = useRef(new Map<string, HTMLInputElement>());
    const amountRefs = useRef(new Map<string, HTMLInputElement>());
    // dòng vừa thêm (quick-add hoặc "+ Thêm dòng") cần được focus ngay khi input của nó vừa gắn vào DOM;
    // đọc trong ref callback (chạy đồng bộ lúc commit) thay vì effect + setState để tránh render dây chuyền
    const pendingFocus = useRef<{ id: string, field: "label" | "amount" } | null>(null);

    // ref callback chạy đồng bộ ngay khi input gắn vào DOM: nếu đúng là ô đang chờ focus thì focus rồi xoá cờ chờ
    const attachRef = (field: "label" | "amount", id: string) => (el: HTMLInputElement | null) => {
        const map = field === "label" ? labelRefs.current : amountRefs.current;
        if (!el) {
            map.delete(id);
            return;
        }
        map.set(id, el);
        if (pendingFocus.current?.id === id && pendingFocus.current.field === field) {
            el.focus();
            pendingFocus.current = null;
        }
    };

    const patch = (id: string, change: Partial<Row>) =>
        setRows((list) => list.map((r) => (r.id === id ? {...r, ...change} : r)));
    const remove = (id: string) => setRows((list) => list.filter((r) => r.id !== id));

    // gõ tay: dòng trống, con trỏ vào ô nhãn. Quick-add: nhãn điền sẵn, con trỏ nhảy thẳng vào ô số tiền.
    const add = (label: string) => {
        const id = crypto.randomUUID();
        pendingFocus.current = {id, field: label ? "amount" : "label"};
        setRows((list) => [...list, {id, label, amount: ""}]);
    };

    const total = rows.reduce((sum, r) => sum + rowAmount(r.amount), 0);

    return (
        <div className='flex min-w-0 flex-col gap-3'>
            {quickAdds && quickAdds.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                    {quickAdds.map((label) => (
                        <button
                            key={label}
                            type='button'
                            onClick={() => add(label)}
                            className={`cursor-pointer border border-dashed border-ink/40 px-2.5 py-1 font-playpen-sans text-xs text-ink/75 transition-colors hover:border-accent hover:text-accent ${FOCUS}`}>
                            + {label}
                        </button>
                    ))}
                </div>
            )}

            {rows.length > 0 && (
                <ul className='flex flex-col gap-2'>
                    {rows.map((row) => (
                        <li key={row.id} className='flex flex-wrap items-center gap-2'>
                            <input
                                ref={attachRef("label", row.id)}
                                value={row.label}
                                onChange={(e) => patch(row.id, {label: e.target.value})}
                                placeholder={placeholder}
                                aria-label={t.costs.labelAria}
                                className={`${INPUT} min-w-0 flex-1 basis-40`}
                            />
                            <div className='relative w-32 shrink-0'>
                                <input
                                    ref={attachRef("amount", row.id)}
                                    value={row.amount}
                                    onChange={(e) => patch(row.id, {amount: e.target.value})}
                                    inputMode='numeric'
                                    autoComplete='off'
                                    placeholder='0'
                                    aria-label={t.costs.amountAria}
                                    className={`${INPUT} pr-6`}
                                />
                                <span aria-hidden='true' className='pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 font-playpen-sans text-sm text-ink/50'>đ</span>
                            </div>
                            <button
                                type='button'
                                aria-label={t.costs.remove}
                                onClick={() => remove(row.id)}
                                className={`${GHOST_BUTTON} size-8`}>
                                <X className='size-4'/>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className='flex flex-wrap items-center justify-between gap-2'>
                <button
                    type='button'
                    onClick={() => add("")}
                    className={`${GHOST_BUTTON} gap-1.5 px-2 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em]`}>
                    <Plus className='size-3.5'/>
                    {t.costs.addRow}
                </button>
                {/* không dùng formatPrice: formatPrice(0) trả "Miễn phí" (đúng cho GIÁ VÉ), không hợp với dòng tổng này */}
                {rows.length > 0 && <p className='font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/70'>{format(t.costs.total, {amount: `${groupedNumber(total, lang)}đ`})}</p>}
            </div>

            {error && <p className={ERROR} role='alert'>{error}</p>}
            {hint && <p className={HINT}>{hint}</p>}

            {/* JSON hoá để nộp cùng form; parseEventForm/parseCostRows ở server đọc lại đúng field name này */}
            <input type='hidden' name={name} value={JSON.stringify(rows.map(({label, amount}) => ({label, amount})))}/>
        </div>
    );
}
