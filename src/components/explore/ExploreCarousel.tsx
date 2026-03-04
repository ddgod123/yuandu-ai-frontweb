"use client";

"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MOCK_FEATURED = [
  {
    id: 1,
    title: "金采源表情包合集",
    author: "K-Pop Enthusiast",
    image: "https://images.unsplash.com/photo-1621609764095-b32bbe35cf3a?q=80&w=2000&auto=format&fit=crop",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop",
  },
  {
    id: 2,
    title: "猫狗大战：可爱瞬间",
    author: "PetLover",
    image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=2000&auto=format&fit=crop",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&auto=format&fit=crop",
  },
  {
    id: 3,
    title: "经典嘻哈猴系列",
    author: "RetroVibes",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=2000&auto=format&fit=crop",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop",
  },
];

export default function ExploreCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % MOCK_FEATURED.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + MOCK_FEATURED.length) % MOCK_FEATURED.length);
  };

  useEffect(() => {
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative group overflow-hidden rounded-2xl bg-slate-200 aspect-[21/9] sm:aspect-[21/7]">
      {MOCK_FEATURED.map((item, index) => (
        <div
          key={item.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === currentIndex ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 sm:p-10 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white/20">
                <Image src={item.avatar} alt={item.author} fill unoptimized />
              </div>
              <span className="text-sm font-medium text-white/90">{item.author}</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold">{item.title}</h2>
          </div>
        </div>
      ))}

      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/40 z-10"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/40 z-10"
      >
        <ChevronRight size={24} />
      </button>

      <div className="absolute bottom-4 right-6 flex gap-2 z-10">
        {MOCK_FEATURED.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex ? "bg-white w-6" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
