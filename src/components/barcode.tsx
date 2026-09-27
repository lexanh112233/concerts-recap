// Mã vạch giả nhưng ổn định theo seed, để mỗi tấm vé có một dãy vạch riêng.
function barcodeBars(seed: string) {
    let h = 2166136261;
    for (const c of seed) {
        h ^= c.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    const bars: Array<{ x: number, w: number }> = [];
    let x = 0;
    while (x < 260) {
        h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
        const w = 1 + (h % 2);
        const gap = 1 + ((h >>> 8) % 2);
        bars.push({x, w});
        x += w + gap;
    }
    return {bars, width: x};
}

export function Barcode({seed}: { seed: string }) {
    const {bars, width} = barcodeBars(seed);
    return (
        <svg viewBox={`0 0 ${width} 40`} preserveAspectRatio='none' className='h-10 w-full text-charcoal/80' aria-hidden='true'>
            {bars.map((b) => (
                <rect key={b.x} x={b.x} y={0} width={b.w} height={40} fill='currentColor'/>
            ))}
        </svg>
    );
}
