import {AdminHomePage} from "@/components/pages/admin/admin-home-page";

export default async function Page({searchParams}: PageProps<"/admin">) {
    const {saved, deleted, leftover} = await searchParams;
    return <AdminHomePage lang="vi" saved={saved} deleted={deleted} leftover={leftover}/>;
}
