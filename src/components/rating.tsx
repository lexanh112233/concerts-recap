import {Star} from "lucide-react";

// tone: "dark" cho nền tối, "light" cho vé giấy; `label` là câu đọc cho trình đọc màn hình (đã dịch)
export function Rating({value, label, tone = "dark", className = "size-4"}: {
    value: number
    label: string
    tone?: "dark" | "light"
    className?: string
}) {
    const filled = Math.round(value);
    const empty = tone === "dark" ? "text-white/25" : "text-charcoal/25";
    return (
        <div className='flex items-center gap-0.5' role='img' aria-label={label}>
            {Array.from({length: 5}, (_, i) => (
                <Star
                    key={i}
                    className={`${className} ${i < filled ? "fill-accent text-accent" : empty}`}
                />
            ))}
        </div>
    );
}
