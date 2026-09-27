import type {ReactNode} from "react";
import {AdminShell} from "@/components/admin/admin-shell";
import {adminMetadata} from "@/i18n/admin/server";

// Root layout của trang quản trị tiếng Việt (/admin). Bản tiếng Anh nằm ở app/en/(admin) (/en/admin) với root layout riêng.
export const metadata = adminMetadata("vi");

export default function AdminLayout({children}: { children: ReactNode }) {
    return <AdminShell lang="vi">{children}</AdminShell>;
}
