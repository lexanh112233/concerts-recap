"use client";

import Image from "next/image";
import {useCallback, useEffect, useRef, useState} from "react";
import {ImageOff, VideoOff} from "lucide-react";
import {useI18n} from "@/i18n/provider";
import type {IMedia} from "@/lib/concerts";

// Quy tắc chống giật: khung luôn có kích thước xác định TRƯỚC khi media tải
// (aspect-ratio hoặc parent có size), media chỉ lấp đầy bằng object-cover.
// Trong lúc chờ có skeleton shimmer; khi tải xong thì fade-in.

interface FrameProps {
    // Ví dụ "4/5". Bỏ trống nếu className đã tự đặt kích thước (vd. absolute inset-0).
    ratio?: string
    className?: string
}

function frameClass(className?: string) {
    const positioned = /(^|\s)(absolute|fixed|sticky|relative)(\s|$)/.test(className ?? "");
    return `${positioned ? "" : "relative"} overflow-hidden bg-stage-2 ${className ?? ""}`;
}

function Fade({loaded, children}: { loaded: boolean, children: React.ReactNode }) {
    return (
        <div
            className={`absolute inset-0 transition-[opacity,transform,filter] duration-700 ease-out motion-reduce:transition-none ${loaded ? "scale-100 opacity-100 blur-0" : "scale-[1.04] opacity-0 blur-sm"}`}>
            {children}
        </div>
    );
}

export function SmartImage({src, alt, sizes, priority, ratio, className, imgClassName, position, onRatio}: FrameProps & {
    src: string
    alt: string
    sizes: string
    priority?: boolean
    imgClassName?: string
    // object-position, vd. "50% 30%" để giữ phần đầu người khi bị crop
    position?: string
    // báo tỉ lệ thật (rộng/cao) khi ảnh đã tải, dùng khi server chưa đo được. Nên truyền hàm ổn định (vd. setState).
    onRatio?: (ratio: number) => void
}) {
    const {t} = useI18n();
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);

    // Ảnh đã có trong cache có thể "complete" trước khi React gắn onLoad
    const attach = useCallback((img: HTMLImageElement | null) => {
        if (img?.complete && img.naturalWidth > 0) {
            setLoaded(true);
            onRatio?.(img.naturalWidth / img.naturalHeight);
        }
    }, [onRatio]);

    return (
        <div className={frameClass(className)} style={ratio ? {aspectRatio: ratio} : undefined}>
            {!loaded && !failed && <div className='shimmer absolute inset-0' aria-hidden='true'/>}
            {failed ? (
                <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 text-paper/40'>
                    <ImageOff className='size-6'/>
                    <span className='text-xs'>{t.media.imageFailed}</span>
                </div>
            ) : (
                <Fade loaded={loaded}>
                    <Image
                        ref={attach}
                        src={src}
                        alt={alt}
                        fill
                        sizes={sizes}
                        priority={priority}
                        onLoad={(e) => {
                            setLoaded(true);
                            const img = e.currentTarget;
                            if (img.naturalWidth > 0) onRatio?.(img.naturalWidth / img.naturalHeight);
                        }}
                        onError={() => setFailed(true)}
                        style={position ? {objectPosition: position} : undefined}
                        className={`object-cover ${imgClassName ?? ""}`}
                    />
                </Fade>
            )}
        </div>
    );
}

export function SmartVideo({src, ratio, className, videoClassName, active, autoplayInView, eager, onRatio}: FrameProps & {
    src: string
    videoClassName?: string
    // điều khiển từ ngoài (vd. thẻ được hover thì mới phát)
    active?: boolean
    // tự phát khi vào khung nhìn, dừng khi rời đi
    autoplayInView?: boolean
    // tải metadata ngay từ HTML của server (video đầu tiên, nằm trong màn hình đầu); mặc định chỉ tải khi khung đã gần vào màn hình
    eager?: boolean
    // báo tỉ lệ thật khi trình duyệt đọc xong metadata (đã tính cả xoay của video quay dọc)
    onRatio?: (ratio: number) => void
}) {
    const {t} = useI18n();
    const ref = useRef<HTMLVideoElement>(null);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [inView, setInView] = useState(false);
    const [near, setNear] = useState(!!eager);

    // Chỉ gắn src khi khung sắp vào màn hình (lề 300px) để trang có nhiều video (bàn ảnh, danh sách) không tải metadata của tất cả ngay lúc mở.
    // Khung đã có tỉ lệ từ trước nên gắn src muộn không làm nhảy bố cục.
    useEffect(() => {
        const el = ref.current;
        if (near || !el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setNear(true);
        }, {rootMargin: "300px"});
        observer.observe(el);
        return () => observer.disconnect();
    }, [near]);

    useEffect(() => {
        const el = ref.current;
        if (!autoplayInView || !el) return;
        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {threshold: 0.25});
        observer.observe(el);
        return () => observer.disconnect();
    }, [autoplayInView]);

    const shouldPlay = autoplayInView ? inView : !!active;

    // phụ thuộc cả near: lệnh play() trước khi có src bị từ chối, nên phải gọi lại khi src vừa được gắn
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (shouldPlay) el.play().catch(() => undefined);
        else el.pause();
    }, [shouldPlay, near]);

    return (
        <div className={frameClass(className)} style={ratio ? {aspectRatio: ratio} : undefined}>
            {!ready && !failed && <div className='shimmer absolute inset-0' aria-hidden='true'/>}
            {failed ? (
                // trình duyệt không giải mã được (vd. .mov HEVC quay từ iPhone): báo rõ thay vì để shimmer chạy mãi
                // @container: chữ chỉ hiện khi khung đủ rộng (ô thumbnail 64px ở trang admin chỉ hiện icon)
                <div className='@container absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-1 text-center text-paper/40'>
                    <VideoOff className='size-5'/>
                    <span className='hidden text-xs leading-tight @[110px]:block'>{t.media.videoFailed}</span>
                </div>
            ) : (
                <Fade loaded={ready}>
                    <video
                        ref={ref}
                        // #t=0.1 để trình duyệt hiện khung hình đầu thay cho poster mà không tải cả video
                        src={near ? `${src}#t=0.1` : undefined}
                        muted
                        loop
                        playsInline
                        preload='metadata'
                        onLoadedMetadata={(e) => {
                            const v = e.currentTarget;
                            if (v.videoWidth > 0 && v.videoHeight > 0) onRatio?.(v.videoWidth / v.videoHeight);
                        }}
                        onLoadedData={() => setReady(true)}
                        onError={() => setFailed(true)}
                        className={`absolute inset-0 h-full w-full object-cover ${videoClassName ?? ""}`}
                    />
                </Fade>
            )}
        </div>
    );
}

// Chọn ảnh hoặc video theo loại media
export function SmartMedia({media, alt, sizes, priority, ratio, className, mediaClassName, active, autoplayInView, position, onRatio}: FrameProps & {
    media: IMedia
    alt: string
    sizes: string
    priority?: boolean
    mediaClassName?: string
    active?: boolean
    autoplayInView?: boolean
    position?: string
    onRatio?: (ratio: number) => void
}) {
    return media.isVideo ? (
        <SmartVideo
            src={media.src}
            ratio={ratio}
            className={className}
            videoClassName={mediaClassName}
            active={active}
            autoplayInView={autoplayInView}
            eager={priority}
            onRatio={onRatio}
        />
    ) : (
        <SmartImage
            src={media.src}
            alt={alt}
            sizes={sizes}
            priority={priority}
            ratio={ratio}
            className={className}
            imgClassName={mediaClassName}
            position={position}
            onRatio={onRatio}
        />
    );
}
