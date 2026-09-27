import {randomUUID} from "node:crypto";
import {DeleteObjectCommand, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import type {Lang} from "@/i18n/config";
import {validationMessages} from "@/i18n/admin/validation";
import {UPLOAD_TYPES, validateUpload} from "@/lib/upload-rules";

// Cloudflare R2 qua API tương thích S3. Trình duyệt tải thẳng lên R2 bằng URL đã ký
// (không đi qua server Next nên không vướng giới hạn kích thước body).
interface R2Config {
    accountId: string
    accessKeyId: string
    secretAccessKey: string
    bucket: string
    publicUrl: string
}

// Cần đủ 5 biến. R2_PUBLIC_URL (địa chỉ công khai của bucket, dạng https://pub-xxxx.r2.dev hoặc domain riêng) là bắt buộc: đó là địa chỉ lưu vào
// từng ảnh/video của sự kiện, và cũng là host duy nhất được phép hiển thị (xem lib/media-hosts.ts).
export function getR2Config(): R2Config | null {
    const {R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL} = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) return null;
    return {
        accountId: R2_ACCOUNT_ID,
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
        bucket: R2_BUCKET,
        publicUrl: R2_PUBLIC_URL.replace(/\/+$/, ""),
    };
}

export const isR2Configured = () => getR2Config() !== null;

let cached: { signature: string, client: S3Client } | null = null;

function getClient(cfg: R2Config) {
    const signature = `${cfg.accountId}:${cfg.accessKeyId}`;
    if (cached?.signature === signature) return cached.client;

    const client = new S3Client({
        region: "auto",
        endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
        credentials: {accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey},
        // SDK mới tự thêm header checksum vào URL ký; R2 từ chối nên chỉ tính khi bắt buộc.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
    });
    cached = {signature, client};
    return client;
}

export async function createPresignedUpload(contentType: string, size: number, lang: Lang = "vi") {
    const cfg = getR2Config();
    if (!cfg) throw new Error(validationMessages(lang).r2.notConfigured);

    const invalid = validateUpload(contentType, size, lang);
    if (invalid) throw new Error(invalid);

    // key do server tự sinh nên trình duyệt không thể ghi đè file khác; cùng thư mục với ảnh cũ
    const key = `diary-images/${randomUUID()}.${UPLOAD_TYPES[contentType].ext}`;
    const uploadUrl = await getSignedUrl(
        getClient(cfg),
        new PutObjectCommand({Bucket: cfg.bucket, Key: key, ContentType: contentType}),
        {expiresIn: 600},
    );
    return {uploadUrl, publicUrl: `${cfg.publicUrl}/${key}`, key};
}

// Địa chỉ công khai mà URL media của sự kiện có thể mang: bucket đang cấu hình (R2_PUBLIC_URL). Chưa cấu hình thì không có địa chỉ nào (không xoá file nào).
export function mediaPublicBases(): string[] {
    const cfg = getR2Config();
    return cfg ? [cfg.publicUrl] : [];
}

// Xoá các file (theo key) khỏi bucket, mỗi file một lệnh chạy song song. KHÔNG bao giờ throw: xoá sự kiện đã xong ở DB thì
// file R2 chỉ là dọn dẹp cố gắng hết sức. Trả số file xoá được và số file không xoá được (R2 chưa cấu hình thì tất cả là "không xoá được",
// thường gặp nhất khác là token R2 chưa có quyền xoá) để nơi gọi báo cho người dùng biết còn file mồ côi.
export async function deleteR2Objects(keys: readonly string[]): Promise<{ deleted: number, failed: number }> {
    if (keys.length === 0) return {deleted: 0, failed: 0};
    const cfg = getR2Config();
    if (!cfg) return {deleted: 0, failed: keys.length};

    const results = await Promise.allSettled(keys.map(async (key) => {
        await getClient(cfg).send(new DeleteObjectCommand({Bucket: cfg.bucket, Key: key}));
    }));
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (rejected.length > 0) {
        // chỉ ghi tên lỗi và số lượng, không ghi key hay thông tin tài khoản
        const names = [...new Set(rejected.map((r) => (r.reason instanceof Error ? r.reason.name : "lỗi lạ")))].join(", ");
        console.error(`Không xoá được ${rejected.length}/${keys.length} file trên R2: ${names}`);
    }
    return {deleted: keys.length - rejected.length, failed: rejected.length};
}
