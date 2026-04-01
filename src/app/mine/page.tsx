import { redirect } from "next/navigation";

export default function MineIndexPage() {
  redirect("/mine/favorites/collections");
}
