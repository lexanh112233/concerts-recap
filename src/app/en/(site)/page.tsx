import type {Metadata} from "next";
import {HomePage} from "@/components/pages/home-page";
import {homeMetadata} from "@/lib/site-metadata";

// Tự làm mới định kỳ; khi thêm/sửa sự kiện trong /admin sẽ revalidate ngay.
export const revalidate = 300;

export const metadata: Metadata = homeMetadata("en");

export default function Page() {
    return <HomePage lang="en"/>;
}
