import type { RuleFlag } from "./rules";

const EXPLANATIONS: Record<RuleFlag, string> = {
  returns_conflict:
    "Return terms on the product page conflict with the returns policy.",
  warranty_conflict:
    "Warranty claims on the product page conflict with the warranty policy.",
  stock_conflict:
    "Stock claims on the product page conflict with availability warnings.",
  price_conflict:
    "Price guarantees on the product page conflict with pricing policies.",
  unclear:
    "Unclear: not enough explicit text to verify claims against policies.",
  invalid_url: "URL is missing or invalid.",
  analysis_failed: "Analysis failed. Try again or use a test URL in dev.",
  dev_only: "Development mode only supports the test URLs.",
};

export function explainFlags(flags: RuleFlag[]): string[] {
  return flags.map((flag) => EXPLANATIONS[flag]);
}
