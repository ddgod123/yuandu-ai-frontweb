import { fetchWithAuthRetry } from "@/lib/auth-client";

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

type DownloadURLPayload = {
  url?: string;
  name?: string;
  key?: string;
  expires_at?: number;
  expiresAt?: number;
};

export type DownloadLinkResponse = {
  url: string;
  name?: string;
  key?: string;
  expiresAt?: number;
};

export type DownloadLinkError = {
  status: number;
  code: string;
  message: string;
};

export type DownloadLinkResult =
  | {
      ok: true;
      data: DownloadLinkResponse;
    }
  | {
      ok: false;
      error: DownloadLinkError;
    };

async function parseApiError(res: Response): Promise<ApiErrorPayload> {
  try {
    return (await res.clone().json()) as ApiErrorPayload;
  } catch {
    return {};
  }
}

export async function requestDownloadLink(
  endpoint: string,
  init: RequestInit = {}
): Promise<DownloadLinkResult> {
  try {
    const res = await fetchWithAuthRetry(endpoint, init);
    if (!res.ok) {
      const apiErr = await parseApiError(res);
      return {
        ok: false,
        error: {
          status: res.status,
          code: (apiErr.error || "").trim(),
          message: (apiErr.message || "").trim(),
        },
      };
    }

    const payload = (await res.json()) as DownloadURLPayload;
    const url = (payload?.url || "").trim();
    if (!url) {
      return {
        ok: false,
        error: {
          status: 502,
          code: "download_url_empty",
          message: "下载地址为空",
        },
      };
    }

    return {
      ok: true,
      data: {
        url,
        name: (payload?.name || "").trim() || undefined,
        key: (payload?.key || "").trim() || undefined,
        expiresAt:
          typeof payload?.expires_at === "number"
            ? payload.expires_at
            : typeof payload?.expiresAt === "number"
              ? payload.expiresAt
              : undefined,
      },
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        status: 0,
        code: "network_error",
        message: error instanceof Error ? error.message : "网络异常",
      },
    };
  }
}

export function triggerURLDownload(url: string, filename?: string) {
  const link = document.createElement("a");
  link.href = url;
  if (filename) {
    link.download = filename;
  }
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
