// Vòng bút đỏ vẽ tay quanh một mục (số ghế trên vé, tên ở header...): ellipse nét đứt hở một đoạn như lúc nhấc bút.
// SVG không có viewBox nên nét luôn dày đúng 2px dù vòng co giãn theo mục; phần tử cha phải `relative`.
// Vị trí, kích thước và độ nghiêng do nơi dùng đặt qua className. `redraw`: vòng tự vẽ lại từ đầu mỗi khi rê chuột hoặc focus vào
// một phần tử tổ tiên có class `group` (xem .pen-draw trong globals.css); lúc thường vòng đã vẽ đủ nên không có gì chạy.
export function PenRing({className = "", redraw = false}: { className?: string, redraw?: boolean }) {
    return (
        <svg
            aria-hidden='true'
            className={`pointer-events-none absolute overflow-visible text-accent ${redraw ? "pen-draw" : ""} ${className}`}>
            <ellipse cx='50%' cy='50%' rx='49%' ry='47%' pathLength={100} strokeDasharray='93 7' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'/>
        </svg>
    );
}
