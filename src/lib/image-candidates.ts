import { isStorageObjectKey } from "@/lib/storage-prefix";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp|svg)$/i;
const ABSOLUTE_HTTP_REGEX = /^https?:\/\//i;

export function isImageFile(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return IMAGE_EXT_REGEX.test(clean);
}

function isLikelyImageURL(url?: string | null) {
  const trimmed = (url || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:image/")) return true;
  if (trimmed.startsWith("blob:")) return true;
  if (isImageFile(trimmed)) return true;
  // Some avatar providers return image bytes from extension-less endpoints
  // like /svg?seed=xxx. Keep these candidates so <img> can attempt rendering.
  if (trimmed.startsWith("//")) return true;
  if (ABSOLUTE_HTTP_REGEX.test(trimmed)) return true;
  return false;
}

function extractObjectKey(rawURL: string) {
  const trimmed = (rawURL || "").trim();
  if (!trimmed) return "";
  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
      const parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
      return decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
    }
  } catch {
    // ignore parse errors
  }
  return trimmed.replace(/^\/+/, "").split("?")[0].split("#")[0];
}

function buildStorageProxyCandidate(rawURL: string) {
  const key = extractObjectKey(rawURL);
  if (!isStorageObjectKey(key)) return "";
  return `${API_BASE}/storage/proxy?key=${encodeURIComponent(key)}`;
}

export function buildImageCandidates(rawURL: string, options?: { preferProxy?: boolean }): string[] {
  const trimmed = rawURL.trim();
  const preferProxy = options?.preferProxy ?? true;
  if (!trimmed) return [];
  const proxyCandidate = buildStorageProxyCandidate(trimmed);
  if (!isLikelyImageURL(trimmed) && (!preferProxy || !proxyCandidate)) return [];

  const candidates: string[] = [];
  const isProxyURL = (value: string) => value.includes("/api/storage/proxy?");
  const add = (value: string) => {
    if (!value) return;
    if (!isProxyURL(value) && !isLikelyImageURL(value)) return;
    if (!candidates.includes(value)) {
      candidates.push(value);
    }
  };

  // Prefer backend proxy first so frontweb is less sensitive to external CDN/domain issues.
  if (preferProxy) {
    add(proxyCandidate);
  }

  // 避免 SSR/CSR 首帧因 window 协议差异导致 hydration mismatch。
  const preferHTTPS = true;

  if (trimmed.startsWith("//")) {
    const httpsURL = `https:${trimmed}`;
    const httpURL = `http:${trimmed}`;
    if (preferHTTPS) {
      add(httpsURL);
      add(httpURL);
    } else {
      add(httpURL);
      add(httpsURL);
    }
    if (preferProxy) {
      add(proxyCandidate);
    }
    return candidates;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const httpsURL = trimmed.replace(/^http:\/\//i, "https://");
    const httpURL = trimmed.replace(/^https:\/\//i, "http://");
    if (preferHTTPS) {
      add(httpsURL);
      add(httpURL);
    } else {
      add(httpURL);
      add(httpsURL);
    }
    if (preferProxy) {
      add(proxyCandidate);
    }
    return candidates;
  }

  if (trimmed.startsWith("/")) {
    add(trimmed);
    if (preferProxy) {
      add(proxyCandidate);
    }
    return candidates;
  }

  const hostCandidate = trimmed.split("/")[0];
  if (hostCandidate.includes(".") || hostCandidate.includes(":")) {
    if (preferHTTPS) {
      add(`https://${trimmed}`);
      add(`http://${trimmed}`);
    } else {
      add(`http://${trimmed}`);
      add(`https://${trimmed}`);
    }
    if (preferProxy) {
      add(proxyCandidate);
    }
    return candidates;
  }

  add(trimmed);
  if (preferProxy) {
    add(proxyCandidate);
  }
  return candidates;
}
