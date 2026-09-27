import {createHash} from "node:crypto";

// Giới hạn số lần đăng nhập sai để không dò mật khẩu hàng loạt được (độ trễ 0,6 giây mỗi lần sai không đủ vì có thể gửi song song).
// Đếm theo IP trong MongoDB (Vercel chạy serverless nên bộ nhớ của tiến trình không giữ được trạng thái giữa các lần gọi).
// Module này chỉ có logic thuần + giao diện kho lưu để test được không cần DB; kho thật ở lib/login-attempts-store.ts.

export const MAX_FAILURES = 10;
export const WINDOW_MS = 15 * 60 * 1000;

export interface AttemptRecord {
    count: number
    // hết hạn cửa sổ đếm: sau mốc này bộ đếm coi như bắt đầu lại (và bản ghi tự bị dọn bởi chỉ mục TTL)
    expiresAt: Date
}

export interface AttemptStore {
    get(key: string): Promise<AttemptRecord | null>
    // ghi nhận một lần sai lúc `now`: cộng vào cửa sổ còn hiệu lực, hoặc mở cửa sổ mới (count = 1, hết hạn sau WINDOW_MS)
    fail(key: string, now: Date): Promise<AttemptRecord>
    clear(key: string): Promise<void>
}

// Đang bị khoá khi cửa sổ còn hiệu lực và đã sai đủ số lần cho phép.
export function isLockedOut(record: AttemptRecord | null, now: Date): boolean {
    return record !== null && record.expiresAt.getTime() > now.getTime() && record.count >= MAX_FAILURES;
}

// Số phút (làm tròn lên, tối thiểu 1) còn phải chờ để được thử lại.
export function retryMinutes(record: AttemptRecord, now: Date): number {
    return Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 60_000));
}

// Khoá đếm của một người dùng: BĂM của IP (không lưu IP thô trong DB). IP lấy từ header của proxy phía trước (Vercel đặt x-forwarded-for,
// phần tử ĐẦU là client thật); không có thì gom vào một khoá chung "unknown".
export function clientKey(headers: { get(name: string): string | null }): string {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
    return createHash("sha256").update(`concerts-recap/login/${ip}`).digest("hex");
}
