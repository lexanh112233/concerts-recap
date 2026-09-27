// Nhiều hàm ngày trong src/lib dùng giờ địa phương (đúng ý: ngày diễn ra là ngày trên tờ vé), nên test phải chạy ở một múi giờ cố định
// thì máy bạn (UTC+7) và CI (UTC) mới cho cùng kết quả. Muốn thử múi giờ khác: `TZ=UTC pnpm test:run` (biến đã có thì không bị ghi đè).
export default function setup() {
    process.env.TZ ??= "Asia/Ho_Chi_Minh";
}
