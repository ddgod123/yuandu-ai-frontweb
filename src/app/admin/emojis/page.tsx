"use client";

import React, { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/layout/admin-layout";
import Image from "next/image";
import { Plus, Search } from "lucide-react";

interface Emoji {
  id: number;
  title: string;
  file_url: string;
  format: string;
  status: string;
}

export default function EmojiManager() {
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");

  const fetchEmojis = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append("q", search);
    if (collectionFilter) params.append("collection_id", collectionFilter);

    fetch(`http://localhost:5050/api/emojis?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setEmojis(data.items || []);
        setLoading(false);
      });
  }, [collectionFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmojis();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchEmojis]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const files = (e.currentTarget.elements.namedItem("files") as HTMLInputElement).files;
    
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const res = await fetch("http://localhost:5050/api/emojis", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setShowUpload(false);
        fetchEmojis();
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(`http://localhost:5050/api/emojis/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchEmojis();
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Emojis</h1>
            <p className="text-zinc-500">Manage your emoji library and assets.</p>
          </div>
          <button 
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Upload Emoji
          </button>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
              <h2 className="text-xl font-bold">Upload Emojis</h2>
              <form onSubmit={handleUpload} className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Files</label>
                  <input
                    name="files"
                    type="file"
                    multiple
                    className="block w-full text-sm text-zinc-500 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Collection ID (Optional)</label>
                  <input
                    name="collection_id"
                    type="number"
                    className="rounded-lg border bg-transparent p-2 text-sm outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowUpload(false)}
                    className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex flex-1 items-center gap-2 rounded-xl border bg-zinc-50/50 p-2 px-4 dark:bg-zinc-900/50">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search emojis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <input
            type="number"
            placeholder="Collection ID"
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
            className="w-32 rounded-xl border bg-zinc-50/50 p-2 px-4 text-sm outline-none dark:bg-zinc-900/50"
          />
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {emojis.map((emoji) => (
              <div
                key={emoji.id}
                className="group relative flex flex-col gap-2 rounded-xl border p-2 transition-all hover:border-zinc-300 hover:shadow-sm dark:hover:border-zinc-700"
              >
                <div className="aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <div className="relative h-full w-full">
                    <Image
                      src={emoji.file_url}
                      alt={emoji.title}
                      fill
                      unoptimized
                      className="object-contain p-2 transition-transform group-hover:scale-110"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className="truncate text-xs font-medium">{emoji.title}</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleDelete(emoji.id)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
