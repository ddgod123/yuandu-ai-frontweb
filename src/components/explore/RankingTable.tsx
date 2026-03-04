"use client";

"use client";

import React from "react";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

const MOCK_RANKING = [
  { id: 1, title: "文豪野犬》‌西格玛", author: "SigmaFan", downloads: "12.4k", change: "+125%", image: "https://images.unsplash.com/photo-1578632292335-df3abbb0d586?q=80&w=100&auto=format&fit=crop" },
  { id: 2, title: "萌娃系列 1-10", author: "BabyEmoji", downloads: "8.2k", change: "+80%", image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=100&auto=format&fit=crop" },
  { id: 3, title: "懒散兔与啾先生", author: "RabbitLove", downloads: "7.5k", change: "-5%", image: "https://images.unsplash.com/photo-1583511655826-05700d52f4d9?q=80&w=100&auto=format&fit=crop" },
  { id: 4, title: "兽耳娘", author: "NekoArc", downloads: "6.9k", change: "+45%", image: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=100&auto=format&fit=crop" },
  { id: 5, title: "金采源1-3", author: "ChaewonFan", downloads: "5.1k", change: "+210%", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop" },
];

export default function RankingTable() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900">实时排行榜</h2>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button className="px-3 py-1 text-sm font-medium bg-white rounded-md shadow-sm">24小时</button>
            <button className="px-3 py-1 text-sm font-medium text-slate-500">7天</button>
            <button className="px-3 py-1 text-sm font-medium text-slate-500">全部</button>
          </div>
        </div>
        <button className="text-sm font-bold text-blue-600 hover:text-blue-700">查看全部</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
        {/* We split the ranking into two columns for desktop like OpenSea */}
        {[MOCK_RANKING.slice(0, 5), MOCK_RANKING.slice(0, 5)].map((col, colIdx) => (
          <div key={colIdx} className="space-y-4">
            {col.map((item, idx) => (
              <div key={`${colIdx}-${item.id}`} className="flex items-center group cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors">
                <span className="w-8 text-lg font-bold text-slate-400">{idx + 1 + (colIdx * 5)}</span>
                <div className="relative w-14 h-14 rounded-xl overflow-hidden mr-4 bg-slate-100">
                  <Image src={item.image} alt={item.title} fill className="object-cover" unoptimized />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <h3 className="font-bold text-slate-900 truncate">{item.title}</h3>
                    <CheckCircle2 size={14} className="text-blue-500 flex-shrink-0" fill="currentColor" />
                  </div>
                  <p className="text-sm text-slate-500 truncate">{item.author}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{item.downloads}</p>
                  <p className={`text-xs font-medium ${item.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                    {item.change}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
