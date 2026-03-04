import { redirect } from "next/navigation";

export default function FavoritesIndexPage() {
  redirect("/profile/favorites/collections");
}

