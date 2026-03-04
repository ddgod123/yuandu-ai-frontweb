import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-3">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm shadow-lg shadow-emerald-200">
                <span className="filter grayscale brightness-200">🗂️</span>
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900">表情包档案馆</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
              致力于收集、整理和分享互联网上那些让人忍俊不禁、心领神会的精彩表情。每一个表情都是一段情绪，每一份合集都是一种文化。
            </p>
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">资源</h4>
            <ul className="mt-4 space-y-2 text-sm font-medium text-slate-500">
              <li><Link href="/" className="hover:text-emerald-500 transition-colors">首页</Link></li>
              <li><Link href="/categories" className="hover:text-emerald-500 transition-colors">分类</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-slate-50 pt-8 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
          © 2026 表情包档案馆 · Emoji Archive Project · Made with ❤️ for Internet Culture
        </div>
      </div>
    </footer>
  );
}
