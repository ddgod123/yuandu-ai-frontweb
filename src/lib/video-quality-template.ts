export type QualityTemplateSuggestion = {
  applied: boolean;
  summary: string;
  sourceBucketSummary: string;
  reasons: string[];
};

function mapQualityProfileLabel(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value === "size") return "体积优先";
  if (value === "clarity") return "清晰优先";
  return raw;
}

export function parseQualityTemplateSuggestionFromOptions(
  options?: Record<string, unknown> | null
): QualityTemplateSuggestion | null {
  if (!options || typeof options !== "object") return null;

  const recommendationRaw = options.quality_template_recommendation;
  if (!recommendationRaw || typeof recommendationRaw !== "object") return null;
  const recommendation = recommendationRaw as Record<string, unknown>;

  const profilesRaw = recommendation.recommended_profiles;
  if (!profilesRaw || typeof profilesRaw !== "object") return null;
  const profiles = profilesRaw as Record<string, unknown>;

  const profilePairs: string[] = [];
  for (const [formatRaw, profileRaw] of Object.entries(profiles)) {
    const format = formatRaw.trim().toLowerCase();
    if (!format || typeof profileRaw !== "string") continue;
    const profile = profileRaw.trim();
    if (!profile) continue;
    profilePairs.push(`${format.toUpperCase()}=${mapQualityProfileLabel(profile)}`);
  }
  if (!profilePairs.length) return null;

  const sourceBucketSummaryParts: string[] = [];
  const sourceBucketsRaw = recommendation.source_buckets;
  if (sourceBucketsRaw && typeof sourceBucketsRaw === "object") {
    const sourceBuckets = sourceBucketsRaw as Record<string, unknown>;
    const duration = typeof sourceBuckets.duration === "string" ? sourceBuckets.duration.trim() : "";
    const resolution = typeof sourceBuckets.resolution === "string" ? sourceBuckets.resolution.trim() : "";
    const fps = typeof sourceBuckets.fps === "string" ? sourceBuckets.fps.trim() : "";
    if (duration) sourceBucketSummaryParts.push(`时长桶 ${duration}`);
    if (resolution) sourceBucketSummaryParts.push(`分辨率桶 ${resolution}`);
    if (fps) sourceBucketSummaryParts.push(`帧率桶 ${fps}`);
  }

  const reasons: string[] = [];
  const reasonsRaw = recommendation.reasons;
  if (Array.isArray(reasonsRaw)) {
    for (const item of reasonsRaw) {
      if (typeof item !== "string") continue;
      const reason = item.trim();
      if (!reason) continue;
      reasons.push(reason);
    }
  }

  const appliedSource =
    typeof options.quality_template_applied === "string" ? options.quality_template_applied.trim().toLowerCase() : "";
  return {
    applied: appliedSource === "auto_recommendation",
    summary: profilePairs.join("；"),
    sourceBucketSummary: sourceBucketSummaryParts.join(" · "),
    reasons,
  };
}
