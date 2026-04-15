/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { CheckCircle2, Crown, QrCode, ShieldCheck, Sparkles } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";
const DEFAULT_CONTACT_EMAIL = "3909356254@qq.com";

const FREE_PLAN_RIGHTS = ["浏览和搜索全部公开合集", "支持下载单张表情图片", "支持点赞、收藏与分享"];
const SUBSCRIBER_PLAN_RIGHTS = [
  "包含免费用户全部权益",
  "支持一键下载合集 ZIP 包",
  "专属极速下载通道，无需等待",
  "通过兑换码快速开通与续期",
];

type FooterSelfMediaItem = {
  key?: string;
  name?: string;
  qr_code?: string;
  qr_code_url?: string;
  profile_link?: string;
  enabled?: boolean;
  sort?: number;
};

type FooterSettingResponse = {
  contact_email?: string;
  self_media_qr_code?: string;
  self_media_qr_code_url?: string;
  self_media_items?: FooterSelfMediaItem[];
};

type SubscriptionContactInfo = {
  contactEmail: string;
  qqNumber: string;
  qqQrCodeURL: string;
  qqProfileLink: string;
};

function normalizeURL(value?: string) {
  const text = (value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : "";
}

function normalizeQQNumber(email: string) {
  const local = email.split("@")[0] || "";
  return /^\d{5,}$/.test(local) ? local : "";
}

async function loadSubscriptionContactInfo(): Promise<SubscriptionContactInfo> {
  const fallback: SubscriptionContactInfo = {
    contactEmail: DEFAULT_CONTACT_EMAIL,
    qqNumber: normalizeQQNumber(DEFAULT_CONTACT_EMAIL),
    qqQrCodeURL: "",
    qqProfileLink: "",
  };

  try {
    const res = await fetch(`${API_BASE}/site-settings/footer`, { cache: "no-store" });
    if (!res.ok) return fallback;
    const data = (await res.json()) as FooterSettingResponse;
    const contactEmail = (data.contact_email || "").trim() || fallback.contactEmail;
    const list = Array.isArray(data.self_media_items) ? data.self_media_items : [];
    const enabled = list
      .filter((item) => Boolean(item?.enabled))
      .sort((a, b) => Number(a?.sort || 9999) - Number(b?.sort || 9999));
    const qqItem =
      enabled.find((item) => (item?.key || "").trim().toLowerCase() === "qq") ||
      enabled.find((item) => (item?.name || "").toLowerCase().includes("qq")) ||
      null;
    const qqQrCodeURL =
      normalizeURL(qqItem?.qr_code_url) ||
      normalizeURL(qqItem?.qr_code) ||
      normalizeURL(data.self_media_qr_code_url) ||
      normalizeURL(data.self_media_qr_code);
    return {
      contactEmail,
      qqNumber: normalizeQQNumber(contactEmail),
      qqQrCodeURL,
      qqProfileLink: normalizeURL(qqItem?.profile_link),
    };
  } catch {
    return fallback;
  }
}

export default async function SubscriptionIntroPage() {
  const contactInfo = await loadSubscriptionContactInfo();
  const hasQQProfileLink = Boolean(contactInfo.qqProfileLink);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <section className="mx-auto max-w-7xl px-6 py-10 sm:py-12">
        <div className="overflow-hidden rounded-[2.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
          <div className="relative border-b border-slate-100 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.14),transparent_48%),radial-gradient(circle_at_85%_80%,rgba(59,130,246,0.1),transparent_40%)] p-8 sm:p-10 lg:p-12">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black tracking-wide text-emerald-700">
                  <Sparkles size={14} />
                  订阅服务
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                  元都表情包订阅计划
                </h1>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 sm:text-base">
                  为高频下载与内容分发场景提供更高效率的服务能力。当前采用人工发放兑换码方式开通与续期。
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href="/profile/subscription"
                    className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-emerald-500"
                  >
                    已有兑换码，去兑换
                  </Link>
                  {hasQQProfileLink ? (
                    <a
                      href={contactInfo.qqProfileLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-600"
                    >
                      联系运营
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid min-w-[240px] gap-3 text-sm">
                {["支持一键下载合集 ZIP", "支持专属极速下载通道", "支持兑换码开通与续期"].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 font-bold text-slate-700 shadow-sm backdrop-blur"
                  >
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10 lg:p-12">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* 免费版 */}
              <div className="relative flex flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
                <div className="mb-6">
                  <h2 className="text-xl font-black text-slate-900">基础版</h2>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tight text-slate-900">免费</span>
                    <span className="text-sm font-bold text-slate-400">/ 永久</span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-500">适合日常浏览与轻度使用的用户。</p>
                </div>
                <div className="mb-8 flex-1 space-y-4">
                  {FREE_PLAN_RIGHTS.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm font-bold text-slate-600">
                      <ShieldCheck size={18} className="mt-0.5 shrink-0 text-slate-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/categories"
                  className="flex h-12 w-full items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-sm font-black text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
                >
                  立即体验
                </Link>
              </div>

              {/* 订阅版 */}
              <div className="relative flex flex-col overflow-hidden rounded-[2.5rem] border-2 border-emerald-500 bg-gradient-to-b from-emerald-50 to-white p-8 shadow-[0_20px_50px_-20px_rgba(16,185,129,0.3)]">
                <div className="absolute right-0 top-0 rounded-bl-[2rem] bg-emerald-500 px-6 py-2 text-xs font-black tracking-widest text-white uppercase shadow-sm">
                  RECOMMENDED
                </div>
                <div className="mb-6">
                  <h2 className="flex items-center gap-2 text-xl font-black text-emerald-700">
                    <Crown size={20} className="fill-emerald-500" />
                    订阅会员
                  </h2>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tight text-slate-900">专属兑换码</span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-emerald-600/80">为高频下载与专业创作者打造的极速体验。</p>
                </div>
                <div className="mb-8 flex-1 space-y-4">
                  {SUBSCRIBER_PLAN_RIGHTS.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm font-bold text-slate-800">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/profile/subscription"
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.6)] transition-all hover:bg-emerald-400 hover:shadow-[0_8px_25px_-8px_rgba(16,185,129,0.8)] active:scale-[0.98]"
                >
                  去兑换开通
                </Link>
              </div>
            </div>

            <div className="mt-12 overflow-hidden rounded-[2.5rem] bg-slate-900 text-white shadow-2xl">
              <div className="relative p-8 sm:p-10 lg:p-12">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(16,185,129,0.15),transparent_50%)]" />
                
                <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-xl">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-300 backdrop-blur-md">
                      <QrCode size={14} />
                      企业 / 团队采购
                    </div>
                    <h3 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">联系运营获取兑换码</h3>
                    <p className="mt-3 text-base font-medium leading-relaxed text-slate-400">
                      扫码添加官方运营 QQ，备注“订阅开通”。我们支持为团队或高频创作者提供定制化的兑换码方案。
                    </p>
                    
                    <div className="mt-6 flex flex-col gap-3 text-sm font-bold text-slate-300 sm:flex-row sm:items-center sm:gap-6">
                      {contactInfo.qqNumber ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">QQ:</span>
                          <span className="text-emerald-400">{contactInfo.qqNumber}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Email:</span>
                        <a href={`mailto:${contactInfo.contactEmail}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                          {contactInfo.contactEmail}
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-center gap-4 sm:flex-row lg:flex-col">
                    {contactInfo.qqQrCodeURL ? (
                      <div className="rounded-3xl bg-white p-3 shadow-xl">
                        <img
                          src={contactInfo.qqQrCodeURL}
                          alt="QQ 二维码"
                          className="h-32 w-32 rounded-2xl object-cover sm:h-40 sm:w-40"
                        />
                      </div>
                    ) : (
                      <div className="flex h-32 w-32 items-center justify-center rounded-3xl border-2 border-dashed border-slate-700 bg-slate-800/50 px-4 text-center text-xs font-bold text-slate-500 sm:h-40 sm:w-40">
                        暂未配置二维码
                      </div>
                    )}
                    {contactInfo.qqProfileLink ? (
                      <a
                        href={contactInfo.qqProfileLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center justify-center rounded-full bg-white/10 px-6 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/20"
                      >
                        打开 QQ 主页
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
