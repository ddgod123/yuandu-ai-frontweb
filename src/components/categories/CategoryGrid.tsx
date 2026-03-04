"use client";

import React from "react";
import Image from "next/image";
import { MoreHorizontal } from "lucide-react";

const MOCK_CATEGORIES = [
  {
    id: 1,
    name: "明星/爱豆",
    count: 1240,
    icon: "✨",
    color: "bg-pink-500",
    previewImages: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1521119989659-a83eee488004?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop",
    ],
  },
  {
    id: 2,
    name: "二次元/动漫",
    count: 856,
    icon: "🎮",
    color: "bg-blue-500",
    previewImages: [
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1578632292335-df3abbb0d586?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1620336655055-088d06e36bf0?q=80&w=200&auto=format&fit=crop",
    ],
  },
  {
    id: 3,
    name: "可爱/萌宠",
    count: 2310,
    icon: "🐶",
    color: "bg-orange-500",
    previewImages: [
      "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517423440428-a5a00ad1e3e8?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?q=80&w=200&auto=format&fit=crop",
    ],
  },
  {
    id: 4,
    name: "沙雕/搞怪",
    count: 1520,
    icon: "😂",
    color: "bg-yellow-500",
    previewImages: [
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1516627145497-ae6968895b74?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1533109721025-d1ae7ee7c1e1?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1490730141103-6ac27d020028?q=80&w=200&auto=format&fit=crop",
    ],
  },
  {
    id: 5,
    name: "复古/怀旧",
    count: 420,
    icon: "📻",
    color: "bg-indigo-500",
    previewImages: [
      "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1520004481444-dffaf579392d?q=80&w=200&auto=format&fit=crop",
    ],
  },
  {
    id: 6,
    name: "极简/线条",
    count: 310,
    icon: "🎨",
    color: "bg-emerald-500",
    previewImages: [
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1515405299443-f71bb768a67d?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?q=80&w=200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=200&auto=format&fit=crop",
    ],
  },
];

export default function CategoryGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {MOCK_CATEGORIES.map((category) => (
        <div 
          key={category.id} 
          className="group relative bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 cursor-pointer overflow-hidden"
        >
          {/* Background Decorative Blob */}
          <div className={`absolute -right-12 -top-12 w-40 h-40 rounded-full ${category.color} opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500`} />
          
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${category.color} text-2xl shadow-lg shadow-current/20 text-white`}>
                {category.icon}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">{category.name}</h3>
                <p className="text-sm font-bold text-slate-400">{category.count.toLocaleString()} 个表情包</p>
              </div>
            </div>
            <button className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-400 transition-colors">
              <MoreHorizontal size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 relative z-10">
            {category.previewImages.map((img, idx) => (
              <div 
                key={idx} 
                className="relative aspect-square rounded-3xl overflow-hidden bg-slate-50 border-2 border-white shadow-sm group-hover:scale-[1.02] transition-transform duration-500"
                style={{ transitionDelay: `${idx * 50}ms` }}
              >
                <Image 
                  src={img} 
                  alt={`${category.name} preview ${idx}`} 
                  fill 
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between relative z-10">
            <div className="flex -space-x-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                   <Image 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${category.id + i}`} 
                    alt="user" 
                    width={32} 
                    height={32} 
                    unoptimized
                  />
                </div>
              ))}
              <div className="h-8 w-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400">
                +8
              </div>
            </div>
            <button className="flex items-center gap-2 text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
              浏览全部
              <div className="h-6 w-6 rounded-full bg-slate-900 group-hover:bg-emerald-600 flex items-center justify-center text-white transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
              </div>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
