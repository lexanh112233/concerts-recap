import {AdminHomePage} from "@/components/pages/admin/admin-home-page";

export default async function Page({searchParams}: PageProps<"/en/admin">) {
    const {saved, deleted, leftover} = await searchParams;
    return <AdminHomePage lang="en" saved={saved} deleted={deleted} leftover={leftover}/>;
}
