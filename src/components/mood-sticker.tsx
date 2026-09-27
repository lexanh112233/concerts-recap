import {moodFor} from "@/lib/mood";

const INK = "#262421";
const PAPER = "#f7f5f1";
const RED = "#c1481d";

// Trái tim nhỏ dùng làm mắt khi điểm tối đa, vẽ quanh gốc tọa độ để đặt bằng translate.
const HEART = "M0,3 C-4,-0.5 -5,-3.5 -2.6,-4.6 C-1.2,-5.2 0,-4 0,-3 C0,-4 1.2,-5.2 2.6,-4.6 C5,-3.5 4,-0.5 0,3Z";

const stroke = {fill: "none", stroke: INK, strokeWidth: 1.8, strokeLinecap: "round"} as const;

// Biểu cảm theo điểm, vẽ trong khung 40×40 (tâm 20,20; mặt bán kính ~16).
function Face({stars}: { stars: number }) {
    switch (stars) {
        case 5:
            return (
                <>
                    <path transform='translate(14 16.5)' d={HEART} fill={RED}/>
                    <path transform='translate(26 16.5)' d={HEART} fill={RED}/>
                    <path d='M12.5 23 Q20 34 27.5 23 Z' fill={INK} stroke={INK} strokeWidth={1.4} strokeLinejoin='round'/>
                    <path d='M16.5 27.6 Q20 24.8 23.5 27.6 Q20 31.4 16.5 27.6Z' fill={RED}/>
                    <circle cx={9.5} cy={24} r={2.6} fill={RED} opacity={0.3}/>
                    <circle cx={30.5} cy={24} r={2.6} fill={RED} opacity={0.3}/>
                </>
            );
        case 4:
            return (
                <>
                    <path d='M11 17.5 q3 -4 6 0 M23 17.5 q3 -4 6 0' {...stroke}/>
                    <path d='M13 25 Q20 31.5 27 25' {...stroke}/>
                    <circle cx={9.5} cy={24} r={2.4} fill={RED} opacity={0.25}/>
                    <circle cx={30.5} cy={24} r={2.4} fill={RED} opacity={0.25}/>
                </>
            );
        case 3:
            return (
                <>
                    <circle cx={14} cy={17} r={1.9} fill={INK}/>
                    <circle cx={26} cy={17} r={1.9} fill={INK}/>
                    <path d='M14.5 27 H25.5' {...stroke}/>
                </>
            );
        case 2:
            return (
                <>
                    <circle cx={14} cy={17} r={1.9} fill={INK}/>
                    <circle cx={26} cy={17} r={1.9} fill={INK}/>
                    <path d='M14 28.5 Q20 24.5 26 28.5' {...stroke}/>
                </>
            );
        case 1:
            return (
                <>
                    <path d='M11 14 l6 6 M17 14 l-6 6 M23 14 l6 6 M29 14 l-6 6' {...stroke}/>
                    <path d='M13 29 q2 -3 4 0 t4 0 t4 0' {...stroke}/>
                    <path d='M31 22 q2.4 3.2 0 5 q-2.4 -1.8 0 -5z' fill='#4f8fd6'/>
                </>
            );
        default:
            // chưa chấm điểm: dấu hỏi
            return (
                <>
                    <path d='M15.5 15.5 Q15.5 10.5 20 10.5 Q24.5 10.5 24.5 15 Q24.5 18.2 20 20.2 V23' {...stroke}/>
                    <circle cx={20} cy={28} r={1.4} fill={INK}/>
                </>
            );
    }
}

// Sticker mặt cười thay cho chuỗi chấm điểm trên vé lớn: vòng trắng cắt viền (die-cut), mặt giấy nét charcoal, dán nghiêng một góc cố định theo điểm.
// Chỉ có hình học SVG (không id, không filter) nên nhiều vé cùng một trang không đụng nhau. Dòng chữ viết tay đi kèm do vé tự vẽ.
// `label` là tên đầy đủ cho trình đọc màn hình (đã dịch, do nơi dùng ghép từ từ điển).
export function MoodSticker({rating, label, className = "size-14"}: { rating: number, label: string, className?: string }) {
    const {stars, tilt} = moodFor(rating);
    return (
        <svg
            role='img'
            aria-label={label}
            viewBox='0 0 40 40'
            style={{rotate: `${tilt}deg`}}
            className={`shrink-0 drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)] ${className}`}>
            <circle cx={20} cy={20} r={19} fill='#fff'/>
            <circle cx={20} cy={20} r={16.2} fill={PAPER} stroke={INK} strokeWidth={1.6} strokeDasharray={stars === 0 ? "3 2.4" : undefined}/>
            <Face stars={stars}/>
        </svg>
    );
}
