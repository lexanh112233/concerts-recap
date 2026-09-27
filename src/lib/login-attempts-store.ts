import connectToDatabase from "@/lib/db";
import {WINDOW_MS, type AttemptRecord, type AttemptStore} from "@/lib/login-throttle";
import adminLoginAttempts from "@/models/login-attempts";

// Kho đếm lần đăng nhập sai bằng MongoDB (collection adminLoginAttempts).
const DUPLICATE_KEY = 11000;

type Doc = { count: number, expiresAt: Date };
const toRecord = (doc: Doc): AttemptRecord => ({count: doc.count, expiresAt: doc.expiresAt});

export const mongoAttemptStore: AttemptStore = {
    async get(key) {
        await connectToDatabase();
        const doc = (await adminLoginAttempts.findOne({key}).lean()) as Doc | null;
        return doc ? toRecord(doc) : null;
    },

    async fail(key, now) {
        await connectToDatabase();
        const live = {key, expiresAt: {$gt: now}};
        // cửa sổ còn hiệu lực: cộng dồn (một lệnh nguyên tử nên nhiều lần sai song song đều được đếm)
        const bumped = (await adminLoginAttempts.findOneAndUpdate(live, {$inc: {count: 1}}, {returnDocument: "after"}).lean()) as Doc | null;
        if (bumped) return toRecord(bumped);

        // chưa có hoặc đã hết hạn (bản ghi cũ có thể còn nằm đó tới lượt quét TTL kế tiếp): mở cửa sổ mới
        try {
            const fresh = (await adminLoginAttempts.findOneAndUpdate(
                {key},
                {$set: {count: 1, expiresAt: new Date(now.getTime() + WINDOW_MS)}},
                {upsert: true, returnDocument: "after"},
            ).lean()) as Doc;
            return toRecord(fresh);
        } catch (error) {
            // hai lần sai đầu tiên chạy song song cùng tạo bản ghi: bên chậm hơn đụng chỉ mục unique, chỉ cần cộng vào bản ghi vừa được tạo
            if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
            const retried = (await adminLoginAttempts.findOneAndUpdate(live, {$inc: {count: 1}}, {returnDocument: "after"}).lean()) as Doc | null;
            if (!retried) throw error;
            return toRecord(retried);
        }
    },

    async clear(key) {
        await connectToDatabase();
        await adminLoginAttempts.deleteOne({key});
    },
};
