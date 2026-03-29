import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clapperboard,
  Layers3,
  Sparkles,
  Wand2,
  Target,
  Settings,
  Smartphone,
  Scissors,
  Zap,
} from "lucide-react";

const workflow = [
  {
    title: "AI1 导演系统",
    subtitle: "理解与策划",
    desc: "先理解视频语义与您的意图，生成结构化策略。不盲目抽帧，先想后做。",
    icon: BrainCircuit,
  },
  {
    title: "AI2 决策大脑",
    subtitle: "特征匹配与初筛",
    desc: "核心提名引擎，评估高光时刻、动作有效性，给出专业提名方案。",
    icon: Layers3,
  },
  {
    title: "双核引擎",
    subtitle: "Worker + 质量算法",
    desc: "结合清晰度、亮度、主体等本地 CV 指标进行硬核技术筛选与按需生成。",
    icon: Clapperboard,
  },
  {
    title: "AI3 终审法官",
    subtitle: "复审与交付",
    desc: "综合语义价值与机器评分做最终重排，输出可下载、可传播的数字资产。",
    icon: CheckCircle2,
  },
];

const painPoints = [
  {
    title: "人工链路太慢",
    desc: "逐秒找痛点、记时间、导图片，效率极低且成本高昂。",
    solution: "我们的方案：全链路自动化，上传即交付。",
    icon: Settings,
  },
  {
    title: "结果靠“盲猜”",
    desc: "依赖个人经验，同样素材产出质量参差不齐，废片率高。",
    solution: "我们的方案：AI 规则引擎多维打分，只留精品。",
    icon: Target,
  },
  {
    title: "场景难适配",
    desc: "传统工具只管“切出来”，不管你要发去哪里、给谁看。",
    solution: "我们的方案：结合动态策略库，为场景量身定制。",
    icon: Zap,
  },
];

const scenes = [
  {
    title: "小红书 / 社媒场景",
    text: "AI 自动捕捉高亮表情、爆点瞬间，自带网感。",
    icon: Sparkles,
  },
  {
    title: "手机壁纸提取",
    text: "结合画面构图分析，自动避开水印与极暗画面，提取极清静帧。",
    icon: Smartphone,
  },
  {
    title: "智能人像抠图",
    text: "聚焦视觉主体，剥离复杂背景，一键生产透明底素材。",
    icon: Scissors,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white pb-20 pt-24 lg:pb-32 lg:pt-32">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-blue-100/60 blur-3xl" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-6 text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm">
            <Sparkles size={16} />
            ✨ 重新定义视频处理流程
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-tight tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
            让视频里的每一秒，<br className="hidden md:block" />
            自动沉淀为<span className="text-emerald-600">高价值视觉资产</span>
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">
            告别“人工审片-打点-剪辑-导出”的低效作坊。通过首创的
            <strong className="font-bold text-slate-800">多阶段 AI Agent 决策网络</strong>
            ，精准捕捉视频高光、自动理解语境、深度优化质量。不仅是转码，更是工业级的内容生产线。
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/create"
              className="inline-flex h-14 items-center gap-2 rounded-2xl bg-slate-900 px-8 text-base font-bold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-1 hover:bg-emerald-600 hover:shadow-emerald-600/25"
            >
              进入 AI 工作台
              <ArrowRight size={18} />
            </Link>
            <a
              href="#advanced-scenes"
              className="inline-flex h-14 items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-8 text-base font-bold text-slate-700 transition hover:-translate-y-1 hover:border-slate-300 hover:bg-slate-50"
            >
              探索高级处理场景
            </a>
          </div>
        </div>
      </section>

      {/* 2. Pain Points Section */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">内容生产，不该如此原始</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {painPoints.map((item) => (
            <div key={item.title} className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-100">
                <item.icon size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
              <p className="mt-4 flex-grow text-base leading-7 text-slate-600">{item.desc}</p>
              <div className="mt-8 rounded-xl bg-emerald-50/80 px-4 py-3.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100/50">
                {item.solution}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Workflow Section */}
      <section className="border-y border-slate-100 bg-slate-50/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 shadow-sm">
              <Wand2 size={16} className="text-emerald-600" />
              工作原理解密
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">独创「三脑一引擎」生产架构</h2>
          </div>

          <div className="relative mt-12 grid gap-8 md:grid-cols-4">
            {/* 连线（仅在桌面端显示） */}
            <div className="absolute left-[12.5%] top-10 hidden w-[75%] border-t-2 border-dashed border-emerald-200 md:block"></div>
            
            {workflow.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="relative z-10 flex flex-col items-center text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-md ring-1 ring-slate-100 transition-transform hover:scale-105">
                    <Icon size={32} className="text-emerald-600" />
                  </div>
                  <div className="mb-2 rounded-full bg-slate-200/50 px-3 py-1 text-xs font-bold tracking-wider text-slate-500">
                    STEP 0{index + 1}
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h3>
                  <div className="mt-1 text-sm font-semibold text-emerald-600">{item.subtitle}</div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Advanced Scenes Section */}
      <section id="advanced-scenes" className="mx-auto max-w-7xl px-6 py-24 lg:py-32 scroll-mt-20">
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-100/50">
            <Sparkles size={16} />
            全新特性
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">懂你所需的每一个分发场景</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            不仅仅是导出图片，更是对特定媒体平台的深度适配与重构。
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {scenes.map((item) => (
            <div key={item.title} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-10 transition-all hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-slate-50 transition-colors group-hover:bg-emerald-50"></div>
              <item.icon size={36} className="relative z-10 text-slate-700 transition-colors group-hover:text-emerald-600" />
              <h3 className="relative z-10 mt-8 text-2xl font-bold text-slate-900">{item.title}</h3>
              <p className="relative z-10 mt-4 text-base leading-7 text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Footer CTA Section */}
      <section className="pb-24 pt-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 px-8 py-20 text-center text-white shadow-2xl">
            <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900"></div>
            
            <div className="relative z-10">
              <h2 className="text-4xl font-black tracking-tight md:text-5xl">开始把视频，变成真正有价值的图片内容</h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                先跑通 PNG 主线，再逐步打磨场景策略与质量闭环，让每次生成都可控、可复盘、可进化。
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Link
                  href="/create"
                  className="inline-flex h-14 items-center gap-2 rounded-2xl bg-emerald-500 px-8 text-base font-bold text-white transition hover:-translate-y-1 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25"
                >
                  立即开始生成
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/emoji-recommend"
                  className="inline-flex h-14 items-center rounded-2xl border-2 border-slate-700 bg-transparent px-8 text-base font-bold text-white transition hover:-translate-y-1 hover:bg-slate-800"
                >
                  看一看成品样例
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
