import type { NextConfig } from "next";
import { allowedMediaHosts } from "./src/lib/media-hosts";
import { securityHeadersFromEnv } from "./src/lib/security-headers";

// Host ảnh/video được phép dùng với next/image: chỉ host của R2_PUBLIC_URL (xem src/lib/media-hosts.ts, cùng một hàm nên luôn khớp nhau).
// Header bảo mật (CSP, chống nhúng iframe...) ở src/lib/security-headers.ts, cũng đọc R2_PUBLIC_URL / R2_ACCOUNT_ID.
// Đổi biến môi trường cần khởi động lại server (hoặc deploy lại).
const nextConfig: NextConfig = {
  // không khoe "X-Powered-By: Next.js"
  poweredByHeader: false,
  images: {
    remotePatterns: allowedMediaHosts().map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeadersFromEnv(process.env, process.env.NODE_ENV === "development"),
      },
    ];
  },
};

export default nextConfig;
