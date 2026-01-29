type ExtractedBase = {
  returnsDays?: number;
  returnsAllowed?: boolean;
  warrantyMonths?: number;
  warrantyProvided?: boolean;
  stockStatus?: "in_stock" | "out_of_stock" | "preorder" | "backorder";
  priceValue?: number;
  priceGuarantee?: boolean;
  pricePolicy?: "price_change" | "price_guarantee" | "price_match";
  stockWarning?: boolean;
};

export type ExtractedClaims = ExtractedBase;
export type ExtractedPolicy = ExtractedBase;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function findReturnDays(text: string): number | undefined {
  const patterns = [
    /return[s]?\s+within\s+(\d{1,3})\s+day/i,
    /(\d{1,3})\s+day[s]?\s+return/i,
    /return[s]?\s+policy\s+.*?(\d{1,3})\s+day/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }
  return undefined;
}

function findWarrantyMonths(text: string): number | undefined {
  const match = text.match(
    /warranty[^.\n]{0,120}?(\d{1,2})\s*(year|years|month|months)/i
  );
  if (!match) return undefined;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  return unit.startsWith("year") ? value * 12 : value;
}

function findStockStatus(text: string): ExtractedClaims["stockStatus"] {
  if (/out of stock|sold out|unavailable/i.test(text)) return "out_of_stock";
  if (/pre[-\s]?order/i.test(text)) return "preorder";
  if (/back\s?order/i.test(text)) return "backorder";
  if (/in stock|available now|available/i.test(text)) return "in_stock";
  return undefined;
}

function findPriceValue(text: string): number | undefined {
  const match = text.match(
    /(USD|INR|EUR|GBP|CAD|AUD|[$€£₹])\s*([0-9]+(?:\.[0-9]{2})?)/i
  );
  if (!match) return undefined;
  return Number(match[2]);
}

function findReturnsAllowed(text: string): boolean | undefined {
  if (/no returns|final sale|non[-\s]?returnable/i.test(text)) return false;
  if (/returns accepted|free returns|return policy/i.test(text)) return true;
  return undefined;
}

function findWarrantyProvided(text: string): boolean | undefined {
  if (/no warranty|as[-\s]?is|without warranty/i.test(text)) return false;
  if (/warranty/i.test(text)) return true;
  return undefined;
}

function findPriceGuarantee(text: string): boolean | undefined {
  if (/price match|price guarantee|price guaranteed/i.test(text)) return true;
  if (/prices subject to change|reserve the right to change prices/i.test(text))
    return false;
  return undefined;
}

function findPricePolicy(text: string): ExtractedPolicy["pricePolicy"] {
  if (/price match/i.test(text)) return "price_match";
  if (/price guarantee|price guaranteed/i.test(text)) return "price_guarantee";
  if (/prices subject to change|reserve the right to change prices/i.test(text))
    return "price_change";
  return undefined;
}

function findStockWarning(text: string): boolean {
  return /subject to availability|availability not guaranteed/i.test(text);
}

export function extractClaims(productText: string): ExtractedClaims {
  const text = normalize(productText);
  const returnsDays = findReturnDays(text);
  const warrantyMonths = findWarrantyMonths(text);
  const stockStatus = findStockStatus(text);
  const priceValue = findPriceValue(text);
  const returnsAllowed = findReturnsAllowed(text);
  const warrantyProvided = findWarrantyProvided(text);
  const priceGuarantee = findPriceGuarantee(text);

  return {
    returnsDays,
    returnsAllowed,
    warrantyMonths,
    warrantyProvided,
    stockStatus,
    priceValue,
    priceGuarantee,
  };
}

export function extractPolicy(policyText: string): ExtractedPolicy {
  const text = normalize(policyText);
  const returnsDays = findReturnDays(text);
  const warrantyMonths = findWarrantyMonths(text);
  const returnsAllowed = findReturnsAllowed(text);
  const warrantyProvided = findWarrantyProvided(text);
  const pricePolicy = findPricePolicy(text);
  const stockWarning = findStockWarning(text);

  return {
    returnsDays,
    returnsAllowed,
    warrantyMonths,
    warrantyProvided,
    pricePolicy,
    stockWarning,
  };
}
