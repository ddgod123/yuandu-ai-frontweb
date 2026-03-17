import { redirect } from "next/navigation";

export default function LegacyFavoriteEmojisPage() {
  redirect("/mine/favorites/emojis");
}
