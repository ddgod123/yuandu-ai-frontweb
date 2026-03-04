"use client";

import React, { useEffect, useState, useRef } from "react";
import AdminLayout from "@/components/layout/admin-layout";
import { Download, RefreshCw, Image as ImageIcon, Settings2 } from "lucide-react";
import { toPng } from "html-to-image";

interface Collection {
  id: number;
  title: string;
  description: string;
  cover_url: string;
}

interface Emoji {
  id: number;
  title: string;
  preview_url: string;
  file_url: string;
}

export default function XhsGenerator() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedColId, setSelectedColId] = useState<number | null>(null);
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Settings
  const [bgColor, setBgColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#1a1a1a");
  const [gridCols, setGridCols] = useState(4);
  const [showTitle, setShowTitle] = useState(true);
  const [titleSize, setTitleSize] = useState(32);
  const [emojiSize, setEmojiSize] = useState(80);
  const [gap, setGap] = useState(16);
  const padding = 40;
  const borderRadius = 12;

  useEffect(() => {
    fetch("http://localhost:5050/api/collections")
      .then((res) => res.json())
      .then((data) => {
        setCollections(data.items || []);
        if (data.items?.length > 0) {
          setLoading(true);
          setSelectedColId(data.items[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (selectedColId) {
      fetch(`http://localhost:5050/api/emojis?collection_id=${selectedColId}&page_size=50`)
        .then((res) => res.json())
        .then((data) => {
          setEmojis(data.items || []);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [selectedColId]);

  const downloadImage = async () => {
    if (cardRef.current) {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `xhs-emoji-${selectedColId}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const selectedCollection = collections.find((c) => c.id === selectedColId);

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">小红书推广图生成器</h1>
          <p className="text-zinc-500">生成 4:3 比例的表情包展示卡片，用于小红书笔记发布。</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Settings Sidebar */}
          <div className="flex flex-col gap-6 rounded-2xl border p-6 dark:border-zinc-800">
            <div className="flex items-center gap-2 font-semibold">
              <Settings2 className="h-4 w-4" />
              配置选项
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">选择合集</label>
                <select
                  value={selectedColId || ""}
                  onChange={(e) => {
                    setLoading(true);
                    setSelectedColId(Number(e.target.value));
                  }}
                  className="w-full rounded-lg border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800"
                >
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">背景颜色</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">文字颜色</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">网格列数</label>
                  <span className="text-xs text-zinc-400">{gridCols}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={gridCols}
                  onChange={(e) => setGridCols(Number(e.target.value))}
                  className="w-full accent-zinc-900"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">表情大小</label>
                  <span className="text-xs text-zinc-400">{emojiSize}px</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="200"
                  value={emojiSize}
                  onChange={(e) => setEmojiSize(Number(e.target.value))}
                  className="w-full accent-zinc-900"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">间距</label>
                  <span className="text-xs text-zinc-400">{gap}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={gap}
                  onChange={(e) => setGap(Number(e.target.value))}
                  className="w-full accent-zinc-900"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">标题大小</label>
                  <span className="text-xs text-zinc-400">{titleSize}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="64"
                  value={titleSize}
                  onChange={(e) => setTitleSize(Number(e.target.value))}
                  className="w-full accent-zinc-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showTitle"
                  checked={showTitle}
                  onChange={(e) => setShowTitle(e.target.checked)}
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <label htmlFor="showTitle" className="text-sm font-medium">显示标题</label>
              </div>
            </div>

            <button
              onClick={downloadImage}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] dark:bg-zinc-50 dark:text-zinc-900"
            >
              <Download className="h-4 w-4" />
              下载 4:3 图片
            </button>
          </div>

          {/* Preview Area */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                <ImageIcon className="h-4 w-4" />
                预览 (4:3 比例)
              </div>
              <button 
                onClick={() => setEmojis([...emojis].sort(() => Math.random() - 0.5))}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-900"
              >
                <RefreshCw className="h-3 w-3" />
                随机排序
              </button>
            </div>

            <div className="relative w-full overflow-hidden rounded-2xl border bg-zinc-50 p-8 flex justify-center items-start min-h-[600px] dark:border-zinc-800 dark:bg-zinc-950/50">
              {/* The actual card to be exported */}
              <div
                ref={cardRef}
                style={{
                  width: "800px",
                  height: "600px",
                  backgroundColor: bgColor,
                  padding: `${padding}px`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                  position: "relative",
                  borderRadius: `${borderRadius}px`,
                }}
                className="overflow-hidden"
              >
                {showTitle && selectedCollection && (
                  <div 
                    style={{ 
                      color: textColor, 
                      fontSize: `${titleSize}px`,
                      fontWeight: "bold",
                      marginBottom: "40px",
                      textAlign: "center",
                      fontFamily: "'Inter', sans-serif"
                    }}
                  >
                    {selectedCollection.title}
                  </div>
                )}

                {loading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                      gap: `${gap}px`,
                      width: "100%",
                      justifyItems: "center",
                      alignItems: "center"
                    }}
                  >
                    {emojis.slice(0, gridCols * 4).map((emoji) => (
                      <div
                        key={emoji.id}
                        style={{
                          width: `${emojiSize}px`,
                          height: `${emojiSize}px`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        {/* html-to-image 导出稳定性优先，保留原生 img */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={emoji.preview_url || emoji.file_url}
                          alt={emoji.title}
                          crossOrigin="anonymous"
                          style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain"
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Branding Footer */}
                <div 
                  style={{ 
                    position: "absolute", 
                    bottom: "20px", 
                    right: "20px",
                    color: textColor,
                    opacity: 0.5,
                    fontSize: "12px",
                    fontWeight: "500"
                  }}
                >
                  Emoji Hub · 表情包平台
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>提示：</strong> 小红书最佳尺寸为 4:3 (1200x900px)。本工具生成的图片采用 2x 缩放导出，确保画质清晰。
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
