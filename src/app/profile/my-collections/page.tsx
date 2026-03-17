import { redirect } from "next/navigation";

export default function LegacyMyCollectionsPage() {
  redirect("/mine/works");
}
