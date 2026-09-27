import {Schema, model, models} from "mongoose";

// Bộ đếm số lần đăng nhập sai theo IP đã băm (xem lib/login-throttle.ts). Collection riêng của dự án, tự dọn bằng chỉ mục TTL:
// bản ghi biến mất ngay sau khi `expiresAt` qua (MongoDB quét mỗi ~60 giây), nên không tích tụ dữ liệu.
const LoginAttemptsSchema = new Schema(
    {
        key: {type: String, required: true, unique: true},
        count: {type: Number, required: true, default: 0},
        expiresAt: {type: Date, required: true},
    },
    {versionKey: false},
);
LoginAttemptsSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

const adminLoginAttempts = models.adminLoginAttempts || model("adminLoginAttempts", LoginAttemptsSchema, "adminLoginAttempts");
export default adminLoginAttempts;
