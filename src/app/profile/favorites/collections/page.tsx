import { redirect } from "next/navigation";

export default function LegacyFavoriteCollectionsPage() {
  redirect("/mine/favorites/collections");
}
