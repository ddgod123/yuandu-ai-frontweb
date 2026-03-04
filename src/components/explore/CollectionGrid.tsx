"use client";

"use client";

import React from "react";
import Image from "next/image";
import { Heart } from "lucide-react";

const MOCK_COLLECTIONS = [
  { id: 1, title: "金采源2", count: 48, author: "ChaewonFan", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop", banner: "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=400&auto=format&fit=crop" },
  { id: 2, title: "猫狗2", count: 32, author: "PetLover", image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=400&auto=format&fit=crop", banner: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=400&auto=format&fit=crop" },
  { id: 3, title: "嘻哈猴儿", count: 64, author: "RetroVibes", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=400&auto=format&fit=crop", banner: "https://images.unsplash.com/photo-1533109721025-d1ae7ee7c1e1?q=80&w=400&auto=format&fit=crop" },
  { id: 4, title: "萌娃10", count: 24, author: "BabyEmoji", image: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=400&auto=format&fit=crop", banner: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?q=80&w=400&auto=format&fit=crop" },
  { id: 5, title: "文豪野犬》‌西格玛", count: 12, author: "SigmaFan", image: "https://images.unsplash.com/photo-1578632292335-df3abbb0d586?q=80&w=400&auto=format&fit=crop", banner: "https://images.unsplash.com/photo-1528319725582-ddc0b6aabc5e?q=80&w=400&auto=format&fit=crop" },
  { id: 6, title: "懒散兔", count: 56, author: "RabbitLove", image: "https://images.unsplash.com/photo-1583511655826-05700d52f4d9?q=80&w=400&auto=format&fit=crop", banner: "https://images.unsplash.com/photo-1490730141103-6ac27d020028?q=80&w=400&auto=format&fit=crop" },
  { id: 7, title: "兽耳娘", count: 92, author: "NekoArc", image: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=400&auto=format&fit=crop", banner: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop" },
  { id: 8, title: "金采源3", count: 36, author: "ChaewonFan", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=400&auto=format&fit=crop", banner: "https://images.unsplash.com/photo-1520333789090-1afc82db536a?q=80&w=400&auto=format&fit=crop" },
];

export default function CollectionGrid({ title }: { title: string }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <button className="text-sm font-bold text-blue-600 hover:text-blue-700">查看更多</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {MOCK_COLLECTIONS.map((item) => (
          <div key={item.id} className="group bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer">
            <div className="relative h-40 overflow-hidden bg-slate-100">
              <Image src={item.banner} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
              <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
            </div>
            <div className="relative px-4 pb-4">
              <div className="absolute -top-10 left-4 w-20 h-20 rounded-xl border-4 border-white overflow-hidden shadow-md bg-white">
                <Image src={item.image} alt={item.title} fill className="object-cover" unoptimized />
              </div>
              <div className="pt-12">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 truncate">{item.title}</h3>
                  <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                    <Heart size={18} className="text-slate-400 hover:text-red-500" />
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-sm text-slate-500 truncate">by {item.author}</p>
                  <p className="text-xs font-bold text-slate-400">{item.count} Pcs</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
