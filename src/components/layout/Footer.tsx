/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

type FooterSelfMediaItem = {
  key: string;
  name: string;
  logo: string;
  logo_url: string;
  qr_code: string;
  qr_code_url: string;
  profile_link: string;
  enabled: boolean;
  sort: number;
};

type FooterSetting = {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  complaintEmail: string;
  selfMediaLogo: string;
  selfMediaLogoURL: string;
  selfMediaQRCode: string;
  selfMediaQRCodeURL: string;
  selfMediaItems: FooterSelfMediaItem[];
  icpNumber: string;
  icpLink: string;
  publicSecurityNumber: string;
  publicSecurityLink: string;
  copyrightText: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

const DEFAULT_SETTING: FooterSetting = {
  siteName: "元都AI",
  siteDescription:
    "面向创作者与团队的 AI 视觉资产生产平台，提供视频转图、视觉内容生成与资产管理能力，让每次创作更快、更稳、更可控。",
  contactEmail: "3909356254@qq.com",
  complaintEmail: "3909356254@qq.com",
  selfMediaLogo: "",
  selfMediaLogoURL: "",
  selfMediaQRCode: "",
  selfMediaQRCodeURL: "",
  selfMediaItems: [],
  icpNumber: "ICP备案号：待补充",
  icpLink: "",
  publicSecurityNumber: "公安备案号：待补充",
  publicSecurityLink: "",
  copyrightText: "元都AI · AI视觉资产生产平台. All rights reserved.",
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

function toInitial(name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "媒";
  return trimmed.slice(0, 1).toUpperCase();
}

async function getFooterSetting(): Promise<FooterSetting> {
  try {
    const res = await fetch(`${API_BASE}/site-settings/footer`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return DEFAULT_SETTING;
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
      self_media_items?: FooterSelfMediaItem[];
      icp_number?: string;
      icp_link?: string;
      public_security_number?: string;
      public_security_link?: string;
      copyright_text?: string;
    };

    return normalizeSetting({
      siteName: data.site_name || "",
      siteDescription: data.site_description || "",
      contactEmail: data.contact_email || "",
      complaintEmail: data.complaint_email || "",
      selfMediaLogo: data.self_media_logo || "",
      selfMediaLogoURL: data.self_media_logo_url || "",
      selfMediaQRCode: data.self_media_qr_code || "",
      selfMediaQRCodeURL: data.self_media_qr_code_url || "",
      selfMediaItems: Array.isArray(data.self_media_items) ? data.self_media_items : [],
      icpNumber: data.icp_number || "",
      icpLink: data.icp_link || "",
      publicSecurityNumber: data.public_security_number || "",
      publicSecurityLink: data.public_security_link || "",
      copyrightText: data.copyright_text || "",
    });
  } catch {
    return DEFAULT_SETTING;
  }
}

function buildNormalizedMediaItems(setting: FooterSetting) {
  const list = (setting.selfMediaItems || [])
    .map((item, index) => {
      const name = (item.name || "").trim() || "自媒体";
      const logo = (item.logo || "").trim();
      const qrCode = (item.qr_code || "").trim();
      const logoURL = (item.logo_url || "").trim() || (isHTTPURL(logo) ? logo : "");
      const qrCodeURL = (item.qr_code_url || "").trim() || (isHTTPURL(qrCode) ? qrCode : "");
      const sort = Number(item.sort) > 0 ? Number(item.sort) : index + 1;

      return {
        key: (item.key || "").trim() || `item_${index + 1}`,
        name,
        logo,
        logoURL,
        qrCode,
        qrCodeURL,
        profileLink: (item.profile_link || "").trim(),
        enabled: Boolean(item.enabled),
        sort,
      };
    })
    .filter((item) => item.enabled)
    .sort((a, b) => a.sort - b.sort);

  if (list.length > 0) {
    return list;
  }

  const legacyLogo =
    setting.selfMediaLogo.trim() || (isHTTPURL(setting.selfMediaLogo) ? setting.selfMediaLogo.trim() : "");
  const legacyQRCode =
    setting.selfMediaQRCodeURL.trim() || (isHTTPURL(setting.selfMediaQRCode) ? setting.selfMediaQRCode.trim() : "");
  if (!legacyLogo && !legacyQRCode) {
    return [];
  }

  return [
    {
      key: "qq",
      name: "QQ",
      logo: setting.selfMediaLogo,
      logoURL: legacyLogo,
      qrCode: setting.selfMediaQRCode,
      qrCodeURL: legacyQRCode,
      profileLink: "",
      enabled: true,
      sort: 1,
    },
  ];
}

export default async function Footer() {
  const setting = await getFooterSetting();
  const currentYear = new Date().getFullYear();
  const contactEmail = setting.contactEmail.trim() || DEFAULT_SETTING.contactEmail;
  const complaintEmail = setting.complaintEmail.trim() || contactEmail;
  const icpNumber = setting.icpNumber.trim() || DEFAULT_SETTING.icpNumber;
  const publicSecurityNumber =
    setting.publicSecurityNumber.trim() || DEFAULT_SETTING.publicSecurityNumber;
  const copyrightText = setting.copyrightText.trim() || DEFAULT_SETTING.copyrightText;
  const normalizedMediaItems = buildNormalizedMediaItems(setting);

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 py-12 md:grid-cols-4">
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
            <div className="mt-4">
              {normalizedMediaItems.length > 0 ? (
                <div className="flex flex-wrap items-start gap-3">
                  {normalizedMediaItems.map((item) => {
                    const trigger = (
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                        {item.logoURL ? (
                          <img src={item.logoURL} alt={`${item.name} logo`} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-black text-slate-500">{toInitial(item.name)}</span>
                        )}
                      </div>
                    );

                    return (
                      <div key={item.key} className="group relative">
                        {item.profileLink ? (
                          <a href={item.profileLink} target="_blank" rel="noreferrer" aria-label={item.name}>
                            {trigger}
                          </a>
                        ) : (
                          <button type="button" className="cursor-default" aria-label={item.name}>
                            {trigger}
                          </button>
                        )}
                        <div className="mt-1 text-center text-[11px] text-slate-500">{item.name}</div>

                        {item.qrCodeURL ? (
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-36 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 text-center opacity-0 shadow-xl transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                            <img src={item.qrCodeURL} alt={`${item.name} 二维码`} className="mx-auto h-28 w-28 rounded-lg object-cover" />
                            <div className="mt-1 text-[11px] text-slate-500">扫码关注</div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-400">暂未配置自媒体账号</div>
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
