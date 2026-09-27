import {AdminEditPage} from "@/components/pages/admin/admin-edit-page";

export default async function Page({params}: PageProps<"/admin/[slug]/edit">) {
    const {slug} = await params;
    return <AdminEditPage lang="vi" slug={slug}/>;
}
