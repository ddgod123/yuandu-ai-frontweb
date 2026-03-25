const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

export const LEGAL_META = {
  version: "v1.0",
  effectiveDate: "2026-03-05",
  updatedDate: "2026-03-25",
  operatorName: "北京元都致远商贸有限公司",
};

type FooterSettingResponse = {
  site_name?: string;
  contact_email?: string;
  complaint_email?: string;
};

export type LegalContactInfo = {
  siteName: string;
  contactEmail: string;
  complaintEmail: string;
};

const DEFAULT_CONTACT_INFO: LegalContactInfo = {
  siteName: "表情包档案馆",
  contactEmail: "3909356254@qq.com",
  complaintEmail: "3909356254@qq.com",
};

export async function getLegalContactInfo(): Promise<LegalContactInfo> {
  try {
    const res = await fetch(`${API_BASE}/site-settings/footer`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return DEFAULT_CONTACT_INFO;
    }

    const data = (await res.json()) as FooterSettingResponse;
    const contactEmail = (data.contact_email || "").trim() || DEFAULT_CONTACT_INFO.contactEmail;
    const complaintEmail = (data.complaint_email || "").trim() || contactEmail;

    return {
      siteName: (data.site_name || "").trim() || DEFAULT_CONTACT_INFO.siteName,
      contactEmail,
      complaintEmail,
    };
  } catch {
    return DEFAULT_CONTACT_INFO;
  }
}
