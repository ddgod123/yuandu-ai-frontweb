import type { Metadata } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

type CollectionMeta = {
  id?: number;
  title?: string;
  description?: string;
  is_showcase?: boolean;
};

function buildDescription(data: CollectionMeta) {
  const raw = (data.description || "").trim();
  if (raw) return raw.slice(0, 140);
  if (data.is_showcase) return "表情包赏析详情页，仅展示不提供下载。";
  return "表情包合集详情页，查看内容与互动数据。";
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const id = (params?.id || "").trim();
  const fallbackTitle = id ? `表情包合集 #${id} · 元都AI` : "表情包合集详情 · 元都AI";

  if (!id) {
    return {
      title: fallbackTitle,
      description: "表情包合集详情页。",
    };
  }

  try {
    const res = await fetch(`${API_BASE}/collections/${encodeURIComponent(id)}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return {
        title: fallbackTitle,
        description: "表情包合集详情页。",
      };
    }
    const data = (await res.json()) as CollectionMeta;
    const title = (data.title || "").trim();
    const displayTitle = title
      ? `${title}${data.is_showcase ? "（赏析）" : ""} · 元都AI`
      : fallbackTitle;
    const description = buildDescription(data);
    return {
      title: displayTitle,
      description,
      openGraph: {
        title: displayTitle,
        description,
      },
    };
  } catch {
    return {
      title: fallbackTitle,
      description: "表情包合集详情页。",
    };
  }
}

export default function CollectionDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}

