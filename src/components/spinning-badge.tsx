import {Sparkles} from "lucide-react";

// Tem tròn có chữ chạy vòng quanh, quay chậm. textLength ép chữ vừa khít vòng tròn dù nhãn dài hay ngắn.
export function SpinningBadge({label, sub, className = ""}: { label: string, sub: string, className?: string }) {
    const text = `${label} ✦ ${sub} ✦ `.toUpperCase();
    return (
        <div className={`size-[116px] sm:size-[136px] ${className}`}>
            <svg viewBox='0 0 160 160' className='spin-slow absolute inset-0 size-full' role='img' aria-label={`${label}, ${sub}`}>
                <defs>
                    <path id='badge-circle' d='M80,80 m-58,0 a58,58 0 1,1 116,0 a58,58 0 1,1 -116,0'/>
                </defs>
                <circle cx='80' cy='80' r='78' className='fill-accent'/>
                <circle cx='80' cy='80' r='71' fill='none' stroke='rgba(247,245,241,0.45)' strokeDasharray='2 4'/>
                <text className='fill-paper font-mono' fontSize='12.5' fontWeight='700'>
                    <textPath href='#badge-circle' textLength='356' lengthAdjust='spacing'>{text}</textPath>
                </text>
            </svg>
            <Sparkles className='absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-paper' aria-hidden='true'/>
        </div>
    );
}
