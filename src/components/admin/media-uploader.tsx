"use client";

import {useEffect, useImperativeHandle, useRef, useState, type DragEvent, type Ref} from "react";
import {Check, ChevronLeft, ChevronRight, CloudUpload, Copy, LoaderCircle, Play, TriangleAlert, Upload, X} from "lucide-react";
import {createUploadUrl} from "@/app/admin/actions";
import {ERROR, HINT} from "@/components/admin/paper";
import {getMediaList} from "@/lib/concerts";
import {HeicError, heicToJpeg, isHeicFile} from "@/lib/heic";
import {useAdminI18n} from "@/i18n/admin/provider";
import {format, plural} from "@/i18n/format";
import {MAX_LABEL, UPLOAD_ACCEPT, validateHeic, validateUpload} from "@/lib/upload-rules";

// Trạng thái của một ô ảnh/video:
//  done       đã có trên R2 (ảnh cũ của sự kiện hoặc vừa tải lên khi lưu)
//  pending    file mới còn nằm trên trình duyệt, CHƯA tải lên R2: chỉ tải khi bấm Lưu
//  converting đang đổi ảnh HEIC sang JPEG (cục bộ, chưa liên quan tới R2)
//  uploading  đang tải lên R2 (chỉ trong lúc bấm Lưu)
//  failed     tải lên R2 lỗi khi bấm Lưu; bấm Lưu lần nữa để thử lại hoặc gỡ ô này đi
//  invalid    file không hợp lệ (sai định dạng, quá lớn, không đọc được HEIC): không bao giờ được lưu
type Status = "done" | "pending" | "converting" | "uploading" | "failed" | "invalid";

interface Item {
    id: string
    // địa chỉ công khai; chỉ có khi đã ở trên R2
    url: string
    // file cục bộ (đã là JPEG nếu gốc là HEIC) chờ tải lên
    file?: File
    // ảnh xem trước cục bộ (object URL do component tạo, phải revoke khi bỏ)
    preview?: string
    isVideo: boolean
    status: Status
    progress: number
    error?: string
}

// Form gọi commit() khi bấm Lưu: tải các file còn chờ lên R2 rồi trả về danh sách địa chỉ cuối cùng theo đúng thứ tự.
// Trả null nếu có file tải lỗi (form không được lưu để khỏi mất ảnh).
export interface MediaUploaderHandle {
    commit: (onProgress?: (done: number, total: number) => void) => Promise<string[] | null>
}

// Trình duyệt không phân biệt được "bucket chưa bật CORS" với "mất mạng" (cả hai đều chỉ báo lỗi mạng), nhưng nguyên nhân thường gặp
// nhất là CORS: preflight bị R2 từ chối 403 khi bucket chưa có luật cho địa chỉ trang. Khi gặp lỗi này ta hiện hướng dẫn sửa.
// putFile ném lỗi có mã (không kèm chữ) để chỗ gọi tự dịch theo ngôn ngữ giao diện.
class UploadError extends Error {
    constructor(readonly code: "network" | "status", readonly status?: number) {
        super(code);
    }
}

// PUT bằng XHR để có tiến độ (fetch chưa hỗ trợ tiến độ tải lên)
function putFile(url: string, file: File, onProgress: (percent: number) => void) {
    return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
            ? resolve()
            : reject(new UploadError("status", xhr.status));
        xhr.onerror = () => reject(new UploadError("network"));
        xhr.send(file);
    });
}

// Hướng dẫn bật CORS cho bucket R2, điền sẵn địa chỉ trang đang mở (origin phải khớp đúng, gồm cả cổng và http/https).
function CorsHelp() {
    const {t} = useAdminI18n();
    const [copied, setCopied] = useState(false);
    const policy = JSON.stringify([{
        AllowedOrigins: [window.location.origin],
        AllowedMethods: ["PUT"],
        AllowedHeaders: ["Content-Type"],
        MaxAgeSeconds: 3600,
    }], null, 2);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(policy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // trình duyệt chặn clipboard: người dùng tự bôi đen đoạn JSON
        }
    };

    return (
        <details open className='border border-[#c98a1b]/50 bg-[#f6d98a]/40 p-3 font-playpen-sans text-xs text-[#4f3300]'>
            <summary className='cursor-pointer select-none font-semibold hover:text-ink'>{t.media.corsTitle}</summary>
            <ol className='mt-2 list-decimal space-y-1 pl-4 leading-5'>
                <li>{t.media.corsStep1}</li>
                <li>{t.media.corsStep2}</li>
                <li>{t.media.corsStep3}</li>
            </ol>
            <div className='relative mt-2'>
                <pre className='overflow-x-auto bg-ink p-3 pr-10 font-mono text-[11px] leading-5 text-paper'>{policy}</pre>
                <button
                    type='button'
                    onClick={copy}
                    aria-label={t.media.copyJson}
                    className='absolute right-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-md bg-white/15 text-paper transition-colors hover:bg-white/25'>
                    {copied ? <Check className='size-3.5 text-emerald-300'/> : <Copy className='size-3.5'/>}
                </button>
            </div>
        </details>
    );
}

export function MediaUploader({initial, r2Enabled, error, onBusyChange, ref}: {
    initial: string[]
    r2Enabled: boolean
    error?: string
    // true trong lúc còn ảnh HEIC đang được đổi sang JPEG (form tạm khóa nút Lưu)
    onBusyChange?: (busy: boolean) => void
    ref?: Ref<MediaUploaderHandle>
}) {
    const {t, lang} = useAdminI18n();
    // lỗi tải lên của trình duyệt → thông báo theo ngôn ngữ giao diện
    const uploadMessage = (e: unknown) => {
        if (e instanceof UploadError) return e.code === "network" ? t.media.networkError : format(t.media.r2Status, {status: e.status ?? 0});
        return e instanceof Error && e.message ? e.message : t.media.uploadFailed;
    };
    const [items, setItems] = useState<Item[]>(() => initial.map((url, i) => ({
        id: `initial-${i}`,
        url,
        isVideo: getMediaList([url])[0]?.isVideo ?? false,
        status: "done",
        progress: 100,
    })));
    const [dragOver, setDragOver] = useState(false);
    // đang tải lên khi bấm Lưu: khóa thêm/gỡ/đổi thứ tự để danh sách không đổi giữa chừng
    const [locked, setLocked] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const converting = useRef(0);
    // bản sao mới nhất của danh sách cho commit() đọc (commit chạy từ form, ngoài vòng render của component này)
    const latest = useRef(items);

    useEffect(() => {
        latest.current = items;
    }, [items]);

    // giải phóng ảnh xem trước cục bộ khi rời trang
    useEffect(() => () => {
        for (const item of latest.current) if (item.preview) URL.revokeObjectURL(item.preview);
    }, []);

    const patch = (id: string, change: Partial<Item>) =>
        setItems((list) => list.map((item) => (item.id === id ? {...item, ...change} : item)));

    const setConverting = (delta: number) => {
        converting.current += delta;
        onBusyChange?.(converting.current > 0);
    };

    // Chọn file: chỉ kiểm tra, xem trước và (với HEIC) đổi sang JPEG ngay trên trình duyệt. KHÔNG tải gì lên R2 ở bước này.
    const addFile = async (original: File) => {
        const id = crypto.randomUUID();
        const heic = await isHeicFile(original);
        const invalid = heic ? validateHeic(original.size, lang) : validateUpload(original.type, original.size, lang);
        setItems((list) => [...list, {
            id,
            url: "",
            file: heic || invalid ? undefined : original,
            // HEIC gốc trình duyệt không vẽ được: chỉ có ảnh xem trước sau khi đã đổi sang JPEG
            preview: heic || invalid ? undefined : URL.createObjectURL(original),
            isVideo: original.type.startsWith("video/"),
            status: invalid ? "invalid" : heic ? "converting" : "pending",
            progress: 0,
            error: invalid ?? undefined,
        }]);
        if (invalid || !heic) return;

        setConverting(1);
        try {
            const jpeg = await heicToJpeg(original);
            // JPEG sau khi đổi có thể lớn hơn file HEIC gốc
            const tooBig = validateUpload(jpeg.type, jpeg.size, lang);
            if (tooBig) throw new Error(tooBig);
            patch(id, {file: jpeg, preview: URL.createObjectURL(jpeg), status: "pending"});
        } catch (e) {
            patch(id, {status: "invalid", error: e instanceof HeicError ? t.media.heicUnreadable : e instanceof Error ? e.message : t.media.heicUnreadable});
        } finally {
            setConverting(-1);
        }
    };

    const addFiles = async (files: FileList | File[]) => {
        for (const file of Array.from(files)) await addFile(file);
    };

    useImperativeHandle(ref, () => ({
        commit: async (onProgress) => {
            const snapshot = latest.current;
            // failed: thử lại các file tải lỗi ở lần bấm Lưu trước
            const todo = snapshot.filter((item) => item.file && (item.status === "pending" || item.status === "failed"));
            const uploaded = new Map<string, string>();
            let finished = 0;

            setLocked(true);
            onProgress?.(0, todo.length);
            try {
                for (const item of todo) {
                    const file = item.file as File;
                    try {
                        patch(item.id, {status: "uploading", progress: 0, error: undefined});
                        const signed = await createUploadUrl({contentType: file.type, size: file.size, lang});
                        if (!signed.ok) throw new Error(signed.error);
                        await putFile(signed.uploadUrl, file, (progress) => patch(item.id, {progress}));
                        uploaded.set(item.id, signed.publicUrl);
                        patch(item.id, {url: signed.publicUrl, status: "done", progress: 100});
                    } catch (e) {
                        patch(item.id, {status: "failed", error: uploadMessage(e)});
                    }
                    onProgress?.(++finished, todo.length);
                }
            } finally {
                setLocked(false);
            }

            if (todo.some((item) => !uploaded.has(item.id))) return null;
            return snapshot
                .filter((item) => item.status === "done" || uploaded.has(item.id))
                .map((item) => uploaded.get(item.id) ?? item.url);
        },
    }));

    const onDrop = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setDragOver(false);
        if (r2Enabled && !locked && e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
    };

    const move = (index: number, dir: -1 | 1) =>
        setItems((list) => {
            const next = [...list];
            const target = index + dir;
            if (target < 0 || target >= next.length) return list;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });

    const remove = (item: Item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
        setItems((list) => list.filter((it) => it.id !== item.id));
    };

    const waiting = items.filter((item) => item.status === "pending").length;
    // thông báo lỗi (không lặp lại), không kèm tên file
    const failures = [...new Set(items.filter((item) => (item.status === "invalid" || item.status === "failed") && item.error).map((item) => item.error as string))];
    const networkFailure = failures.includes(t.media.networkError);

    return (
        <div className='flex min-w-0 flex-col gap-4'>
            {r2Enabled ? (
                <label
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-7 text-center transition-colors ${locked ? "pointer-events-none opacity-50" : ""} ${dragOver ? "border-accent bg-accent/10" : "border-ink/35 hover:border-ink/60 hover:bg-ink/[0.03]"}`}>
                    <Upload className='size-6 text-accent'/>
                    <span className='font-playpen-sans text-sm font-semibold text-ink'>{t.media.drop}</span>
                    <span className='font-mono text-[10.5px] tracking-[0.04em] text-ink/55'>{format(t.media.formats, {image: MAX_LABEL.image, video: MAX_LABEL.video})}</span>
                    <input
                        ref={fileInput}
                        type='file'
                        multiple
                        accept={UPLOAD_ACCEPT}
                        disabled={locked}
                        className='sr-only'
                        onChange={(e) => {
                            if (e.target.files?.length) void addFiles(e.target.files);
                            e.target.value = "";
                        }}
                    />
                </label>
            ) : (
                <div className='flex gap-3 border border-[#c98a1b]/50 bg-[#f6d98a]/40 p-4 font-playpen-sans text-sm text-[#4f3300]'>
                    <TriangleAlert className='mt-0.5 size-4 shrink-0'/>
                    <div className='flex min-w-0 flex-col gap-2'>
                        <p>{t.media.noR2}</p>
                        <details className='text-xs'>
                            <summary className='cursor-pointer select-none font-semibold hover:text-ink'>{t.media.enableHow}</summary>
                            <p className='mt-2 break-words leading-6'>
                                {t.media.enableFill} <code className='font-mono font-semibold'>R2_ACCOUNT_ID</code>, <code className='font-mono font-semibold'>R2_ACCESS_KEY_ID</code>,{" "}
                                <code className='font-mono font-semibold'>R2_SECRET_ACCESS_KEY</code>, <code className='font-mono font-semibold'>R2_BUCKET</code>{" "}
                                {t.media.enableInto} <code className='font-mono font-semibold'>.env.local</code> {t.media.enableRest}
                            </p>
                        </details>
                    </div>
                </div>
            )}

            {error && <p className={ERROR} role='alert'>{error}</p>}

            {items.length > 0 && (
                <ul className='flex max-h-80 flex-row flex-wrap content-start gap-2 overflow-y-auto overscroll-contain p-0.5'>
                    {items.map((item, i) => {
                        const broken = item.status === "invalid" || item.status === "failed";
                        return (
                            <li
                                key={item.id}
                                className={`group relative size-[76px] shrink-0 overflow-hidden bg-ink/10 shadow-[0_4px_7px_-3px_rgba(38,30,20,0.55)] ring-2 ${broken ? "ring-[#a3241a]" : item.status === "pending" ? "ring-accent/70" : "ring-white"}`}
                                title={broken ? item.error : item.status === "pending" ? t.media.pendingTitle : undefined}>
                                {(item.preview || item.url) && (
                                    item.isVideo ? (
                                        <video src={`${item.preview ?? item.url}#t=0.1`} muted preload='metadata' className='size-full object-cover'/>
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={item.preview ?? item.url} alt={format(t.media.photoAlt, {n: i + 1})} className='size-full object-cover'/>
                                    )
                                )}

                                <div className='pointer-events-none absolute left-1.5 top-1.5 flex gap-1'>
                                    {item.isVideo && !broken && (
                                        <span className='flex size-5 items-center justify-center rounded-full bg-black/60'>
                                            <Play className='size-2.5 fill-white text-white'/>
                                        </span>
                                    )}
                                    {item.status === "pending" && (
                                        <span className='flex size-5 items-center justify-center rounded-full bg-accent text-paper' aria-label={t.media.pendingAria}>
                                            <CloudUpload className='size-3'/>
                                        </span>
                                    )}
                                </div>
                                {i === 0 && (item.status === "done" || item.status === "pending") && (
                                    <span className='pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper group-hover:opacity-0 group-focus-within:opacity-0 max-md:opacity-100'>
                                        {t.media.cover}
                                    </span>
                                )}

                                {item.status === "uploading" && (
                                    <div className='absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 px-2'>
                                        <LoaderCircle className='size-5 animate-spin text-white/80'/>
                                        <div className='h-1 w-full overflow-hidden rounded-full bg-white/20'>
                                            <div className='h-full bg-accent transition-[width] duration-150' style={{width: `${item.progress}%`}}/>
                                        </div>
                                        <span className='text-[10px] tabular-nums text-white/80'>{item.progress}%</span>
                                    </div>
                                )}
                                {item.status === "converting" && (
                                    <div className='absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 px-1 text-center'>
                                        <LoaderCircle className='size-5 animate-spin text-white/80'/>
                                        <span className='text-[10px] leading-tight text-white/80'>{t.media.heicBadge}</span>
                                    </div>
                                )}
                                {broken && (
                                    <div className='absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 px-1 text-center'>
                                        <TriangleAlert className='size-5 text-destructive'/>
                                        <span className='text-[10px] leading-tight text-destructive'>{t.media.errorBadge}</span>
                                    </div>
                                )}

                                {/* điều khiển: luôn hiện trên cảm ứng, hiện khi rê chuột/focus trên máy tính; khóa lúc đang tải lên khi lưu */}
                                <button type='button' aria-label={t.media.remove} disabled={locked} onClick={() => remove(item)}
                                        className='absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/70 text-white opacity-100 transition-opacity hover:bg-destructive disabled:pointer-events-none disabled:opacity-0 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'>
                                    <X className='size-3.5'/>
                                </button>
                                <div className='absolute inset-x-1 bottom-1 flex items-center justify-between opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'>
                                    <button type='button' aria-label={t.media.moveUp} disabled={locked || i === 0} onClick={() => move(i, -1)}
                                            className='flex size-6 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-accent disabled:opacity-30 disabled:hover:bg-black/70'>
                                        <ChevronLeft className='size-3.5'/>
                                    </button>
                                    <button type='button' aria-label={t.media.moveDown} disabled={locked || i === items.length - 1} onClick={() => move(i, 1)}
                                            className='flex size-6 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-accent disabled:opacity-30 disabled:hover:bg-black/70'>
                                        <ChevronRight className='size-3.5'/>
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            {failures.length > 0 && (
                <ul className='flex flex-col gap-1' role='alert'>
                    {failures.map((message) => (
                        <li key={message} className={`flex items-start gap-1.5 ${ERROR}`}>
                            <TriangleAlert className='mt-0.5 size-3 shrink-0'/>
                            {message}
                        </li>
                    ))}
                </ul>
            )}
            {networkFailure && <CorsHelp/>}
            {waiting > 0 && (
                <p className='flex items-center gap-1.5 font-playpen-sans text-xs font-semibold text-[#a83a15]'>
                    <CloudUpload className='size-3.5 shrink-0'/>
                    {plural(lang, t.media.waiting, waiting)}
                </p>
            )}
            <p className={HINT}>{t.media.hint}</p>
        </div>
    );
}
