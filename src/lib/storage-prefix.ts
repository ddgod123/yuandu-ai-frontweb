const DEFAULT_STORAGE_ROOT_PREFIXES = ["emoji", "emoji-dev", "emoji-prod", "emoji-prod-v2"] as const;

function normalizePrefix(raw: string) {
  return raw.trim().replace(/^\/+|\/+$/g, "");
}

function normalizeObjectKey(raw: string) {
  return raw.trim().replace(/^\/+/, "").split("?")[0].split("#")[0];
}

function parsePrefixList(raw?: string) {
  return String(raw || "")
    .split(/[,\s;|]+/)
    .map((item) => normalizePrefix(item))
    .filter(Boolean);
}

const configuredPrimaryPrefix = normalizePrefix(process.env.NEXT_PUBLIC_QINIU_ROOT_PREFIX || "");
const configuredAllowedPrefixes = parsePrefixList(process.env.NEXT_PUBLIC_QINIU_ALLOWED_ROOT_PREFIXES);
const primaryStorageRootPrefix = configuredPrimaryPrefix || "emoji";
const allowedStorageRootPrefixSet = new Set<string>([
  ...DEFAULT_STORAGE_ROOT_PREFIXES,
  ...configuredAllowedPrefixes,
  primaryStorageRootPrefix,
]);

export function getPrimaryStorageRootPrefix() {
  return primaryStorageRootPrefix;
}

export function getAllowedStorageRootPrefixes() {
  return Array.from(allowedStorageRootPrefixSet.values());
}

export function isStorageObjectKey(rawKey?: string | null) {
  const key = normalizeObjectKey(String(rawKey || ""));
  if (!key) return false;
  for (const prefix of allowedStorageRootPrefixSet.values()) {
    if (key === prefix || key.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

export function buildStorageObjectKey(relativePath: string) {
  const key = normalizeObjectKey(relativePath);
  if (!key) return primaryStorageRootPrefix;
  if (isStorageObjectKey(key)) return key;
  return `${primaryStorageRootPrefix}/${key}`;
}
