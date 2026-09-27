import {redirect} from "next/navigation";

// There is no separate login page any more: the locked notebook lives right at /en/admin. Kept for old links and bookmarks.
export default function Page() {
    redirect("/en/admin");
}
