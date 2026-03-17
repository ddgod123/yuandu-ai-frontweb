import { redirect } from "next/navigation";

export default function LegacyMyEmojisPage({
  searchParams,
}: {
  searchParams?: { job_id?: string };
}) {
  const jobID = String(searchParams?.job_id || "").trim();
  if (jobID) {
    redirect(`/mine/works/${encodeURIComponent(jobID)}`);
  }
  redirect("/mine/works");
}
