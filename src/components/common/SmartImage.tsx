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
  sizes?: string;
  fallbackClassName?: string;
  preferProxy?: boolean;
};

export default function SmartImage({
  url,
  alt,
  className = "object-cover",
  loading = "lazy",
  priority = false,
  sizes = "100vw",
  fallbackClassName = "h-full w-full bg-slate-100",
  preferProxy = true,
}: SmartImageProps) {
  const candidates = useMemo(
    () => buildImageCandidates((url || "").trim(), { preferProxy }),
    [url, preferProxy]
  );
  const seed = `${(url || "").trim()}|${preferProxy ? "1" : "0"}`;
  const [state, setState] = useState<{ seed: string; index: number }>({
    seed,
    index: 0,
  });
  const index = state.seed === seed ? state.index : 0;
  const src = candidates[index];

  if (!src) {
    return <div className={fallbackClassName} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized
      loading={loading}
      priority={priority}
      className={className}
      onError={() => {
        setState((prev) =>
          prev.seed === seed
            ? { seed, index: prev.index + 1 }
            : { seed, index: 1 }
        );
      }}
    />
  );
}
