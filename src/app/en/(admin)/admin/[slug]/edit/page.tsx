import {AdminEditPage} from "@/components/pages/admin/admin-edit-page";

export default async function Page({params}: PageProps<"/en/admin/[slug]/edit">) {
    const {slug} = await params;
    return <AdminEditPage lang="en" slug={slug}/>;
}
