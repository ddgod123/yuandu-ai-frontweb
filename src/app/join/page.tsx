"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import { User, Phone, Mail, Briefcase, Calendar, Users, ArrowLeft, CheckCircle2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

type JoinFormState = {
  name: string;
  phone: string;
  gender: "男" | "女" | "其他" | "保密";
  age: string;
  email: string;
  occupation: string;
};

const initialForm: JoinFormState = {
  name: "",
  phone: "",
  gender: "保密",
  age: "",
  email: "",
  occupation: "",
};

export default function JoinPage() {
  const [form, setForm] = useState<JoinFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const ageNum = useMemo(() => Number.parseInt(form.age, 10), [form.age]);

  const validate = () => {
    if (!form.name.trim()) return "请填写姓名";
    if (!form.phone.trim()) return "请填写电话";
    if (!form.email.trim()) return "请填写邮箱";
    if (!form.occupation.trim()) return "请填写职业";
    if (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > 120) return "年龄请输入 1-120 之间的数字";
    return "";
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/join-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          gender: form.gender,
          age: ageNum,
          email: form.email.trim(),
          occupation: form.occupation.trim(),
        }),
      });
      if (!response.ok) {
        const raw = (await response.text()).trim();
        throw new Error(raw || "提交失败，请稍后重试");
      }
      setSubmitted(true);
      setForm(initialForm);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white py-12 lg:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          {/* 左侧：品牌展示与引导 */}
          <div className="relative">
            <div className="sticky top-32 space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 ring-1 ring-emerald-100">
                <Sparkles size={14} className="animate-pulse" />
                成为贡献者
              </div>
              
              <div className="space-y-4">
                <h1 className="text-5xl font-black tracking-tight text-slate-900 lg:text-6xl">
                  共建<br />
                  <span className="relative inline-block">
                    <span className="relative z-10 text-emerald-500">表情包档案馆</span>
                    <span className="absolute -bottom-2 left-0 h-3 w-full bg-emerald-100/50 -rotate-1" />
                  </span>
                </h1>
                <p className="max-w-md text-lg font-medium leading-relaxed text-slate-500">
                  我们正在寻找热爱表情包文化的创作者。加入我们，让你的创意被数百万用户发现与收藏。
                </p>
              </div>

              <div className="grid gap-6 pt-4">
                {[
                  { icon: <ShieldCheck className="text-emerald-500" />, title: "隐私保护", desc: "您的个人信息仅用于身份核实，严格保密。" },
                  { icon: <CheckCircle2 className="text-emerald-500" />, title: "快速审核", desc: "提交申请后，我们将在 3 个工作日内完成审核。" },
                  { icon: <Users className="text-emerald-500" />, title: "创作者社区", desc: "加入专属群组，与其他优秀的表情包作者交流。" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-900 shadow-sm ring-1 ring-slate-100">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{item.title}</h3>
                      <p className="text-sm font-medium text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-8">
                <Link
                  href="/"
                  className="group inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
                >
                  <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
                  返回首页探索更多
                </Link>
              </div>
            </div>
          </div>

          {/* 右侧：简约表单卡片 */}
          <div className="relative">
            {/* 装饰背景 */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-50 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-50 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/40 lg:p-12">
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-emerald-500 text-white shadow-xl shadow-emerald-200">
                    <CheckCircle2 size={48} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900">申请已提交</h2>
                  <p className="mt-4 max-w-xs text-base font-medium leading-relaxed text-slate-500">
                    感谢您的信任！审核结果将通过您填写的联系方式通知，请耐心等待。
                  </p>
                  <button
                    type="button"
                    className="mt-12 h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0"
                    onClick={() => setSubmitted(false)}
                  >
                    返回修改或再次提交
                  </button>
                </div>
              ) : (
                <div className="space-y-10">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">填写申请信息</h2>
                    <p className="mt-2 text-sm font-medium text-slate-400">带 * 号的为必填项</p>
                  </div>

                  <form className="space-y-8" onSubmit={onSubmit}>
                    <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
                      <FormField label="姓名" required icon={<User size={14} />}>
                        <input
                          className="w-full border-b-2 border-slate-100 bg-transparent py-3 text-base font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-emerald-500"
                          placeholder="您的真实姓名"
                          value={form.name}
                          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      </FormField>
                      <FormField label="电话" required icon={<Phone size={14} />}>
                        <input
                          className="w-full border-b-2 border-slate-100 bg-transparent py-3 text-base font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-emerald-500"
                          placeholder="联系电话"
                          value={form.phone}
                          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                        />
                      </FormField>
                      <FormField label="性别" required icon={<Users size={14} />}>
                        <div className="relative">
                          <select
                            className="w-full appearance-none border-b-2 border-slate-100 bg-transparent py-3 text-base font-bold text-slate-900 outline-none transition-all focus:border-emerald-500"
                            value={form.gender}
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, gender: event.target.value as JoinFormState["gender"] }))
                            }
                          >
                            <option value="男">男</option>
                            <option value="女">女</option>
                            <option value="其他">其他</option>
                            <option value="保密">保密</option>
                          </select>
                        </div>
                      </FormField>
                      <FormField label="年龄" required icon={<Calendar size={14} />}>
                        <input
                          type="number"
                          className="w-full border-b-2 border-slate-100 bg-transparent py-3 text-base font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-emerald-500"
                          placeholder="您的年龄"
                          value={form.age}
                          onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))}
                        />
                      </FormField>
                      <FormField label="邮箱" required icon={<Mail size={14} />}>
                        <input
                          type="email"
                          className="w-full border-b-2 border-slate-100 bg-transparent py-3 text-base font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-emerald-500"
                          placeholder="常用邮箱地址"
                          value={form.email}
                          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                        />
                      </FormField>
                      <FormField label="职业" required icon={<Briefcase size={14} />}>
                        <input
                          className="w-full border-b-2 border-slate-100 bg-transparent py-3 text-base font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-emerald-500"
                          placeholder="您的职业"
                          value={form.occupation}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, occupation: event.target.value }))
                          }
                        />
                      </FormField>
                    </div>

                    {error ? (
                      <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-5 py-4 text-sm font-bold text-rose-500">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">!</div>
                        {error}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      className="group relative h-16 w-full overflow-hidden rounded-2xl bg-slate-900 text-lg font-bold text-white shadow-xl shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-1 active:translate-y-0 disabled:opacity-60"
                      disabled={submitting}
                    >
                      <div className="relative z-10 flex items-center justify-center gap-3">
                        {submitting ? (
                          <>
                            <Loader2 size={24} className="animate-spin" />
                            正在提交...
                          </>
                        ) : (
                          <>
                            立即提交申请
                            <Sparkles size={20} className="transition-transform group-hover:scale-125 group-hover:rotate-12" />
                          </>
                        )}
                      </div>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FormField({
  label,
  required = false,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}
