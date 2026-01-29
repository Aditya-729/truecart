import type { ExtractedClaims, ExtractedPolicy } from "@/lib/extract";
import type { RuleFlag } from "@/lib/rules";

type ProductInsight = {
  message: string;
  summary: string;
  pros: string[];
  cons: string[];
  policyStatus: "present" | "missing";
};

type ProductDetails = {
  name: string;
  price: string | null;
  flags: RuleFlag[];
  hiddenFindings: string[];
  policyStatus: "present" | "missing";
};

function firstSentences(text: string, maxSentences: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  return parts.slice(0, maxSentences).join(" ").trim();
}

function extractProductName(productText: string, fallbackUrl: string): string {
  const lines = productText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate =
    lines.find((line) => line.length >= 6 && line.split(" ").length >= 2) ?? "";
  if (candidate) return candidate.slice(0, 120);

  try {
    const url = new URL(fallbackUrl);
    const slug = url.pathname.split("/").filter(Boolean).pop() ?? "Product";
    return slug.replace(/[-_]/g, " ").slice(0, 120);
  } catch {
    return "Product";
  }
}

function extractPriceLabel(productText: string): string | null {
  const match = productText.match(
    /(USD|INR|EUR|GBP|CAD|AUD|[$€£₹])\s*([0-9]+(?:\.[0-9]{1,2})?)/i
  );
  if (!match) return null;
  const currency = match[1].toUpperCase();
  const amount = match[2];
  if (currency.length === 1) return `${currency}${amount}`;
  return `${currency} ${amount}`;
}

function describeHiddenFindings(
  flags: RuleFlag[],
  policyStatus: "present" | "missing"
): string[] {
  const findings: string[] = [];
  const hasFlag = (flag: RuleFlag) => flags.includes(flag);

  if (hasFlag("returns_conflict"))
    findings.push("Return policy claims conflict with policy details.");
  if (hasFlag("warranty_conflict"))
    findings.push("Warranty terms conflict between product and policy.");
  if (hasFlag("stock_conflict"))
    findings.push("Stock availability conflicts with policy warnings.");
  if (hasFlag("price_conflict"))
    findings.push("Price guarantees conflict with policy price changes.");
  if (hasFlag("unclear"))
    findings.push("Some claims lack clear policy coverage.");
  if (policyStatus === "missing")
    findings.push("No policy pages were found to verify hidden costs or terms.");

  return findings;
}

export function buildProductInsight(
  productText: string,
  policyText: string,
  claims: ExtractedClaims,
  policy: ExtractedPolicy
): ProductInsight {
  const policyStatus = policyText.trim() ? "present" : "missing";
  const summary =
    firstSentences(productText, 2) ||
    "Product details are limited, but available information suggests a standard offering.";

  const pros: string[] = [];
  const cons: string[] = [];

  if (claims.returnsAllowed === true) pros.push("Returns are allowed.");
  if (claims.warrantyProvided === true) pros.push("Warranty coverage is mentioned.");
  if (claims.stockStatus === "in_stock") pros.push("Item appears in stock.");
  if (typeof claims.priceValue === "number") pros.push("Price is listed.");
  if (claims.priceGuarantee === true) pros.push("Price guarantee is mentioned.");

  if (claims.returnsAllowed === false) cons.push("Returns may not be allowed.");
  if (claims.warrantyProvided === false) cons.push("No warranty is indicated.");
  if (policy.stockWarning) cons.push("Availability may be limited.");
  if (policy.pricePolicy === "price_change")
    cons.push("Prices can change without notice.");

  if (!pros.length) pros.push("Limited product assurances detected.");
  if (!cons.length) cons.push("No major policy drawbacks detected.");

  const message =
    policyStatus === "missing"
      ? "No hidden policy pages were found, and no flags were raised."
      : "No hidden policy conflicts or flags were detected.";

  return {
    message,
    summary,
    pros,
    cons,
    policyStatus,
  };
}

export function buildProductDetails(
  url: string,
  productText: string,
  policyText: string,
  flags: RuleFlag[],
  claims: ExtractedClaims,
  policy: ExtractedPolicy
): ProductDetails {
  const policyStatus = policyText.trim() ? "present" : "missing";
  const name = extractProductName(productText, url);
  const price = extractPriceLabel(productText) ?? null;
  const hiddenFindings = describeHiddenFindings(flags, policyStatus);

  return {
    name,
    price,
    flags,
    hiddenFindings,
    policyStatus,
  };
}
