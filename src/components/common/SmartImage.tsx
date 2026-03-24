"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { buildImageCandidates } from "@/lib/image-candidates";

type SmartImageProps = {
  url?: string | null;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
  fallbackClassName?: string;
};

export default function SmartImage({
  url,
  alt,
  className = "object-cover",
  loading = "lazy",
  priority = false,
  fallbackClassName = "h-full w-full bg-slate-100",
}: SmartImageProps) {
  const candidates = useMemo(() => buildImageCandidates((url || "").trim()), [url]);
  const [index, setIndex] = useState(0);
  const src = candidates[index];

  if (!src) {
    return <div className={fallbackClassName} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      loading={loading}
      priority={priority}
      className={className}
      onError={() => {
        setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
      }}
    />
  );
}
