import { redirect } from "next/navigation";

export default function LegacyMyEmojisPage({
  searchParams,
}: {
  searchParams?: { job_id?: string };
}) {
  void searchParams;
  redirect("/mine/favorites/emojis");
}
