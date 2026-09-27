import type {ReactNode} from "react";
import {AdminShell} from "@/components/admin/admin-shell";
import {adminMetadata} from "@/i18n/admin/server";

// Root layout của trang quản trị tiếng Anh (/en/admin): cùng khung với app/admin, chỉ khác ngôn ngữ.
// Nằm trong nhóm (admin) để tách khỏi root layout công khai tiếng Anh ở app/en/(site) (admin không dùng header/footer công khai).
export const metadata = adminMetadata("en");

export default function ENAdminLayout({children}: { children: ReactNode }) {
    return <AdminShell lang="en">{children}</AdminShell>;
}
