"use client";

import {useState} from "react";
import {Check, Share2} from "lucide-react";
import {useI18n} from "@/i18n/provider";

export function ShareButton({title}: { title: string }) {
    const {t} = useI18n();
    const [copied, setCopied] = useState(false);

    const share = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({title, url});
                return;
            }
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // người dùng huỷ hộp thoại chia sẻ hoặc trình duyệt chặn clipboard
        }
    };

    return (
        // nhãn dán màu accent, hơi nghiêng; rê chuột thì thẳng lại
        <button
            type='button'
            onClick={share}
            className='flex rotate-2 items-center gap-2 rounded-[4px] bg-accent px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-paper shadow-[0_10px_16px_-8px_rgba(0,0,0,0.8)] transition-[rotate,translate] duration-200 hover:-translate-y-0.5 hover:rotate-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper'>
            {copied ? <Check className='size-4'/> : <Share2 className='size-4'/>}
            <span aria-live='polite'>{copied ? t.share.copied : t.share.share}</span>
        </button>
    );
}
