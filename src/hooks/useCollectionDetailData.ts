"use client";

import { useEffect, useState } from "react";
import { API_BASE, fetchWithAuthRetry } from "@/lib/auth-client";

export type TagBrief = {
  id: number;
  name: string;
  slug?: string;
};

export type ApiCollection = {
  id: number;
  title: string;
  description?: string;
  cover_url?: string;
  is_showcase?: boolean;
  copyright_author?: string;
  copyright_work?: string;
  copyright_link?: string;
  file_count?: number;
  download_code?: string;
  favorite_count?: number;
  like_count?: number;
  download_count?: number;
  favorited?: boolean;
  liked?: boolean;
  tags?: TagBrief[];
};

export type ZipItem = {
  id: number;
  key: string;
  name: string;
  size_bytes?: number;
  uploaded_at?: string;
};

export type ApiEmoji = {
  id: number;
  title: string;
  preview_url?: string;
  file_url?: string;
  format?: string;
  size_bytes?: number;
  favorited?: boolean;
};

export function useCollectionDetailData(collectionId: number, page: number, pageSize: number) {
  const [collection, setCollection] = useState<ApiCollection | null>(null);
  const [emojis, setEmojis] = useState<ApiEmoji[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [zipItems, setZipItems] = useState<ZipItem[]>([]);
  const [loadingZips, setLoadingZips] = useState(false);

  useEffect(() => {
    if (!collectionId) return;
    const controller = new AbortController();

    const loadDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/collections/${collectionId}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setCollection(null);
          return;
        }
        const data = (await res.json()) as ApiCollection;
        setCollection(data);
      } catch {
        if (controller.signal.aborted) return;
        setCollection(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingDetail(false);
        }
      }
    };

    loadDetail();

    return () => {
      controller.abort();
    };
  }, [collectionId]);

  useEffect(() => {
    if (!collectionId) return;
    const controller = new AbortController();

    const loadZips = async () => {
      setLoadingZips(true);
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/collections/${collectionId}/zips`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setZipItems([]);
          return;
        }
        const data = (await res.json()) as { items?: ZipItem[] };
        setZipItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (controller.signal.aborted) return;
        setZipItems([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingZips(false);
        }
      }
    };

    loadZips();

    return () => {
      controller.abort();
    };
  }, [collectionId]);

  useEffect(() => {
    if (!collectionId) return;
    const controller = new AbortController();

    const loadEmojis = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          collection_id: String(collectionId),
          page: String(page),
          page_size: String(pageSize),
        });
        const res = await fetchWithAuthRetry(`${API_BASE}/emojis?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          if (page === 1) {
            setEmojis([]);
            setTotal(0);
          }
          return;
        }
        const payload = (await res.json()) as { items?: ApiEmoji[]; total?: number };
        const items = Array.isArray(payload.items) ? payload.items : [];
        const totalCount = typeof payload.total === "number" ? payload.total : items.length;

        setTotal(totalCount);
        setEmojis((prev) => (page === 1 ? items : [...prev, ...items]));
      } catch {
        if (controller.signal.aborted) return;
        if (page === 1) {
          setEmojis([]);
          setTotal(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadEmojis();

    return () => {
      controller.abort();
    };
  }, [collectionId, page, pageSize]);

  return {
    collection,
    setCollection,
    emojis,
    setEmojis,
    total,
    setTotal,
    loading,
    loadingDetail,
    zipItems,
    loadingZips,
  };
}

