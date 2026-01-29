import type { ExtractedClaims, ExtractedPolicy } from "./extract";

export type RuleFlag =
  | "returns_conflict"
  | "warranty_conflict"
  | "stock_conflict"
  | "price_conflict"
  | "unclear"
  | "invalid_url"
  | "analysis_failed"
  | "dev_only";

export type RuleResult = {
  flags: RuleFlag[];
  verdict: "good" | "caution" | "risk" | "unclear";
};

export function detectContradictions(
  claims: ExtractedClaims,
  policy: ExtractedPolicy
): RuleResult {
  const flags: RuleFlag[] = [];

  if (
    claims.returnsDays !== undefined &&
    policy.returnsDays !== undefined &&
    claims.returnsDays > policy.returnsDays
  ) {
    flags.push("returns_conflict");
  }

  if (
    claims.returnsAllowed === true &&
    policy.returnsAllowed === false
  ) {
    flags.push("returns_conflict");
  }

  if (
    claims.returnsAllowed === false &&
    policy.returnsAllowed === true
  ) {
    flags.push("returns_conflict");
  }

  if (
    claims.warrantyMonths !== undefined &&
    policy.warrantyMonths !== undefined &&
    claims.warrantyMonths > policy.warrantyMonths
  ) {
    flags.push("warranty_conflict");
  }

  if (
    claims.warrantyProvided === true &&
    policy.warrantyProvided === false
  ) {
    flags.push("warranty_conflict");
  }

  if (
    claims.stockStatus === "in_stock" &&
    policy.stockWarning
  ) {
    flags.push("stock_conflict");
  }

  if (
    claims.priceGuarantee === true &&
    policy.pricePolicy === "price_change"
  ) {
    flags.push("price_conflict");
  }

  const returnsClaimed =
    claims.returnsDays !== undefined || claims.returnsAllowed !== undefined;
  const returnsPolicy =
    policy.returnsDays !== undefined || policy.returnsAllowed !== undefined;

  const warrantyClaimed =
    claims.warrantyMonths !== undefined || claims.warrantyProvided !== undefined;
  const warrantyPolicy =
    policy.warrantyMonths !== undefined || policy.warrantyProvided !== undefined;

  const stockClaimed = claims.stockStatus !== undefined;
  const stockPolicy = policy.stockWarning !== undefined;

  const priceClaimed =
    claims.priceGuarantee !== undefined || claims.priceValue !== undefined;
  const pricePolicy = policy.pricePolicy !== undefined;

  if (
    (returnsClaimed && !returnsPolicy) ||
    (warrantyClaimed && !warrantyPolicy) ||
    (stockClaimed && !stockPolicy) ||
    (priceClaimed && !pricePolicy)
  ) {
    flags.push("unclear");
  }

  const hasAnySignal = Boolean(
    returnsClaimed ||
      returnsPolicy ||
      warrantyClaimed ||
      warrantyPolicy ||
      stockClaimed ||
      stockPolicy ||
      priceClaimed ||
      pricePolicy
  );

  if (!hasAnySignal) {
    flags.push("unclear");
  }

  const hasConflict = flags.some((flag) => flag.endsWith("_conflict"));
  const hasUnclear = flags.includes("unclear");
  const verdict = hasConflict
    ? "risk"
    : hasUnclear
      ? "unclear"
      : flags.length
        ? "caution"
        : "good";

  return { flags, verdict };
}
