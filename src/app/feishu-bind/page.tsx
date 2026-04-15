import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(input: string | string[] | undefined) {
  if (Array.isArray(input)) return input[0] || "";
  return input || "";
}

export default async function FeishuBindPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = (searchParams && "then" in searchParams ? await searchParams : searchParams) || {};
  const code = firstValue(params.code).trim();
  if (code) {
    redirect(`/profile?bind_code=${encodeURIComponent(code)}`);
  }
  redirect("/profile");
}
