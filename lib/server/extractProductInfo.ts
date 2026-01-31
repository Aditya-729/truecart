type ServerProductInfo = {
  title: string | null;
  price: string | null;
  description: string | null;
};

const extractMeta = (html: string, name: string) => {
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=[\"']${name}[\"'][^>]+content=[\"']([^\"']+)[\"']`,
    "i"
  );
  const match = html.match(regex);
  return match?.[1]?.trim() ?? null;
};

const extractTitle = (html: string) => {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
};

const extractPrice = (html: string) => {
  const metaPrice =
    extractMeta(html, "product:price:amount") ||
    extractMeta(html, "og:price:amount");
  if (metaPrice) return metaPrice;

  const match = html.match(
    /(?:₹|\$|€|£|INR|USD|EUR|GBP)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/i
  );
  return match?.[0]?.trim() ?? null;
};

export function extractProductInfoServer(html: string): ServerProductInfo {
  const title = extractMeta(html, "og:title") || extractTitle(html);
  const description = extractMeta(html, "og:description") || extractMeta(html, "description");
  const price = extractPrice(html);

  return {
    title,
    price,
    description,
  };
}
