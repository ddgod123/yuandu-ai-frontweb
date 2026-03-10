"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";

type FooterSetting = {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  complaintEmail: string;
  selfMediaLogo: string;
  selfMediaLogoURL: string;
  selfMediaQRCode: string;
  selfMediaQRCodeURL: string;
  icpNumber: string;
  icpLink: string;
  publicSecurityNumber: string;
  publicSecurityLink: string;
  copyrightText: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

const DEFAULT_SETTING: FooterSetting = {
  siteName: "表情包档案馆",
  siteDescription:
    "致力于收集、整理和分享互联网表情包资源。本站提供合集浏览、下载与收藏功能，服务于个人非商业交流场景。",
  contactEmail: "contact@emoji-archive.com",
  complaintEmail: "contact@emoji-archive.com",
  selfMediaLogo: "",
  selfMediaLogoURL: "",
  selfMediaQRCode: "",
  selfMediaQRCodeURL: "",
  icpNumber: "ICP备案号：待补充",
  icpLink: "",
  publicSecurityNumber: "公安备案号：待补充",
  publicSecurityLink: "",
  copyrightText: "表情包档案馆. All rights reserved.",
};

function normalizeSetting(payload: Partial<FooterSetting> | null | undefined): FooterSetting {
  return {
    ...DEFAULT_SETTING,
    ...(payload || {}),
  };
}

function isHTTPURL(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export default function Footer() {
  const [setting, setSetting] = useState<FooterSetting>(DEFAULT_SETTING);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const controller = new AbortController();

    const loadSetting = async () => {
      try {
        const res = await fetch(`${API_BASE}/site-settings/footer`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          site_name?: string;
          site_description?: string;
          contact_email?: string;
          complaint_email?: string;
          self_media_logo?: string;
          self_media_logo_url?: string;
          self_media_qr_code?: string;
          self_media_qr_code_url?: string;
          icp_number?: string;
          icp_link?: string;
          public_security_number?: string;
          public_security_link?: string;
          copyright_text?: string;
        };
        if (controller.signal.aborted) return;
        setSetting(
          normalizeSetting({
            siteName: data.site_name || "",
            siteDescription: data.site_description || "",
            contactEmail: data.contact_email || "",
            complaintEmail: data.complaint_email || "",
            selfMediaLogo: data.self_media_logo || "",
            selfMediaLogoURL: data.self_media_logo_url || "",
            selfMediaQRCode: data.self_media_qr_code || "",
            selfMediaQRCodeURL: data.self_media_qr_code_url || "",
            icpNumber: data.icp_number || "",
            icpLink: data.icp_link || "",
            publicSecurityNumber: data.public_security_number || "",
            publicSecurityLink: data.public_security_link || "",
            copyrightText: data.copyright_text || "",
          })
        );
      } catch {
        // 保持默认配置兜底，避免接口失败导致底部不可用
      }
    };

    loadSetting();

    return () => {
      controller.abort();
    };
  }, []);

  const contactEmail = setting.contactEmail.trim() || DEFAULT_SETTING.contactEmail;
  const complaintEmail = setting.complaintEmail.trim() || contactEmail;
  const icpNumber = setting.icpNumber.trim() || DEFAULT_SETTING.icpNumber;
  const publicSecurityNumber =
    setting.publicSecurityNumber.trim() || DEFAULT_SETTING.publicSecurityNumber;
  const copyrightText = setting.copyrightText.trim() || DEFAULT_SETTING.copyrightText;
  const selfMediaLogoURL =
    setting.selfMediaLogoURL.trim() ||
    (isHTTPURL(setting.selfMediaLogo) ? setting.selfMediaLogo.trim() : "");
  const selfMediaQRCodeURL =
    setting.selfMediaQRCodeURL.trim() ||
    (isHTTPURL(setting.selfMediaQRCode) ? setting.selfMediaQRCode.trim() : "");

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 py-12 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm text-white shadow-lg shadow-emerald-200/60">
                <span>🗂️</span>
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900">{setting.siteName}</span>
            </Link>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">{setting.siteDescription}</p>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              如有侵权、版权争议或合作需求，请联系：{" "}
              <a href={`mailto:${contactEmail}`} className="font-semibold text-emerald-600 hover:text-emerald-500">
                {contactEmail}
              </a>
            </p>
          </div>

          <div>
            <h4 className="text-sm font-black tracking-wide text-slate-900">站点导航</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/" className="transition-colors hover:text-emerald-500">
                  首页
                </Link>
              </li>
              <li>
                <Link href="/categories" className="transition-colors hover:text-emerald-500">
                  表情包大全
                </Link>
              </li>
              <li>
                <Link href="/trending" className="transition-colors hover:text-emerald-500">
                  表情包IP
                </Link>
              </li>
              <li>
                <Link href="/profile/favorites" className="transition-colors hover:text-emerald-500">
                  我的收藏
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-black tracking-wide text-slate-900">服务与协议</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/join" className="transition-colors hover:text-emerald-500">
                  申请加入
                </Link>
              </li>
              <li>
                <a href={`mailto:${complaintEmail}`} className="transition-colors hover:text-emerald-500">
                  版权投诉
                </a>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-emerald-500">
                  用户协议
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-emerald-500">
                  隐私政策
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="transition-colors hover:text-emerald-500">
                  免责声明
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-black tracking-wide text-slate-900">自媒体</h4>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {selfMediaLogoURL ? (
                <div className="flex items-center gap-2">
                  <img
                    src={selfMediaLogoURL}
                    alt="自媒体 logo"
                    className="h-10 w-10 rounded-xl border border-slate-200 object-cover"
                  />
                  <span className="text-xs text-slate-500">品牌 Logo</span>
                </div>
              ) : null}

              {selfMediaQRCodeURL ? (
                <div className="inline-flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <img
                    src={selfMediaQRCodeURL}
                    alt="自媒体二维码"
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                  <span className="mt-2 text-center text-[11px] text-slate-500">扫码关注</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">暂未配置二维码</div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 py-6 text-xs leading-6 text-slate-500">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <p>
              © {currentYear} {copyrightText}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {setting.icpLink ? (
                <a
                  href={setting.icpLink}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-emerald-500"
                >
                  {icpNumber}
                </a>
              ) : (
                <span>{icpNumber}</span>
              )}
              {setting.publicSecurityLink ? (
                <a
                  href={setting.publicSecurityLink}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-emerald-500"
                >
                  {publicSecurityNumber}
                </a>
              ) : (
                <span>{publicSecurityNumber}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
