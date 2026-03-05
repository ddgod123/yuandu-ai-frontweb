"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useMemo, useState } from "react";

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
    <main className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-emerald-100/80 blur-3xl" />
          <div className="absolute -bottom-24 -right-12 h-64 w-64 rounded-full bg-sky-100/80 blur-3xl" />

          <div className="relative grid gap-0 md:grid-cols-[1.05fr_1fr]">
            <section className="border-b border-slate-100 p-8 md:border-b-0 md:border-r md:p-10">
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                ARCHIVE JOIN
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900">
                加入档案馆申请
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-500">
                欢迎申请成为档案馆贡献者。提交后可在管理后台“审核与版权 / 加入申请”查看和处理。
              </p>
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                我们只用于申请审核，不会对外公开你的隐私信息。
              </div>
              <Link
                href="/"
                className="mt-8 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                返回首页
              </Link>
            </section>

            <section className="p-8 md:p-10">
              {submitted ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                  <h2 className="text-xl font-black text-emerald-800">提交成功</h2>
                  <p className="mt-2 text-sm text-emerald-700">
                    你的申请已进入审核队列，我们会尽快处理。
                  </p>
                  <button
                    type="button"
                    className="mt-5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    onClick={() => setSubmitted(false)}
                  >
                    继续提交新申请
                  </button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={onSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="姓名" required>
                      <input
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
                        placeholder="请输入姓名"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </FormField>
                    <FormField label="电话" required>
                      <input
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
                        placeholder="请输入联系电话"
                        value={form.phone}
                        onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                    </FormField>
                    <FormField label="性别" required>
                      <select
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
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
                    </FormField>
                    <FormField label="年龄" required>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
                        placeholder="请输入年龄"
                        value={form.age}
                        onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))}
                      />
                    </FormField>
                    <FormField label="邮箱" required>
                      <input
                        type="email"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
                        placeholder="请输入邮箱"
                        value={form.email}
                        onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </FormField>
                    <FormField label="职业" required>
                      <input
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
                        placeholder="请输入职业"
                        value={form.occupation}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, occupation: event.target.value }))
                        }
                      />
                    </FormField>
                  </div>

                  {error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    className="h-11 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submitting}
                  >
                    {submitting ? "提交中..." : "提交申请"}
                  </button>
                </form>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </div>
      {children}
    </label>
  );
}
