"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/admin-layout";
import { Plus, Folder, Trash2, Edit } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

interface Collection {
  id: number;
  title: string;
  description: string;
  cover_url: string;
  status: string;
}

export default function CollectionManager() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchCollections = () => {
    setLoading(true);
    fetch(`${API_BASE}/collections`)
      .then((res) => res.json())
      .then((data) => {
        setCollections(data.items || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
    };

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowCreate(false);
        fetchCollections();
      }
    } catch (err) {
      console.error("Create failed", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure? This will not delete the emojis inside, but they will become unorganized.")) return;
    try {
      const res = await fetch(`${API_BASE}/collections/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchCollections();
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
            <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
            <p className="text-zinc-500">Organize emojis into packs and sets.</p>
          </div>
          <button 
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            New Collection
          </button>
        </div>

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
              <h2 className="text-xl font-bold">New Collection</h2>
              <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Title</label>
                  <input
                    name="title"
                    required
                    className="rounded-lg border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    placeholder="e.g. Summer Pack"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    name="description"
                    className="rounded-lg border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    rows={3}
                  />
                </div>
                <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    {saving ? "Saving..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((col) => (
              <div
                key={col.id}
                className="group flex flex-col gap-4 rounded-2xl border p-6 transition-all hover:border-zinc-300 hover:shadow-sm dark:hover:border-zinc-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    <Folder className="h-6 w-6 text-zinc-500" />
                  </div>
                  <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(col.id)}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold">{col.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{col.description || "No description provided."}</p>
                </div>
                <div className="mt-auto pt-4 flex items-center gap-4 text-xs font-medium text-zinc-400">
                  <span>Status: {col.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
