import { redirect } from "next/navigation";

/** Old URL — keep bookmarks working. */
export default function BtcUpdownRedirectPage() {
  redirect("/trading");
}
