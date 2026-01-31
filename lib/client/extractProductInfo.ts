type ExtractedProductInfo = {
  title: string | null;
  price: string | null;
  description: string | null;
};

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

const getText = (root: Document, selector: string) => {
  const el = root.querySelector<HTMLElement>(selector);
  return el?.textContent ? normalize(el.textContent) : null;
};

const getMeta = (root: Document, name: string) => {
  const el =
    root.querySelector<HTMLMetaElement>(`meta[name="${name}"]`) ||
    root.querySelector<HTMLMetaElement>(`meta[property="${name}"]`);
  return el?.content ? normalize(el.content) : null;
};

const getFirst = (values: Array<string | null>) =>
  values.find((value) => Boolean(value)) ?? null;

const extractAmazon = (doc: Document) => {
  const title = getFirst([
    getText(doc, "#productTitle"),
    getMeta(doc, "og:title"),
    getText(doc, "title"),
  ]);
  const price = getFirst([
    getText(doc, "#priceblock_ourprice"),
    getText(doc, "#priceblock_dealprice"),
    getText(doc, "#priceblock_saleprice"),
    getText(doc, ".a-price .a-offscreen"),
    getText(doc, "[data-a-color='price'] .a-offscreen"),
  ]);
  const description = getFirst([
    getText(doc, "#productDescription"),
    getText(doc, "#feature-bullets"),
    getText(doc, "[data-feature-name='product-description']"),
    getMeta(doc, "og:description"),
  ]);
  return { title, price, description };
};

const extractFlipkart = (doc: Document) => {
  const title = getFirst([
    getText(doc, "span.B_NuCI"),
    getMeta(doc, "og:title"),
    getText(doc, "title"),
  ]);
  const price = getFirst([
    getText(doc, "div._30jeq3"),
    getText(doc, "div._1vC4OE"),
    getText(doc, "[class*='price']"),
  ]);
  const description = getFirst([
    getText(doc, "div._1AN87F"),
    getText(doc, "div._1mXcCf"),
    getText(doc, "div._2o-xpa"),
    getMeta(doc, "og:description"),
  ]);
  return { title, price, description };
};

const extractGeneric = (doc: Document) => {
  const title = getFirst([getMeta(doc, "og:title"), getText(doc, "title")]);
  const price = getFirst([
    getText(doc, "[itemprop='price']"),
    getText(doc, "[data-price]"),
    getText(doc, ".price"),
    getText(doc, ".product-price"),
    getMeta(doc, "product:price:amount"),
  ]);
  const description = getFirst([
    getText(doc, "[itemprop='description']"),
    getText(doc, ".product-description"),
    getText(doc, "#description"),
    getMeta(doc, "og:description"),
  ]);
  return { title, price, description };
};

export function extractProductInfoFromHTML(html: string, url: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("amazon.")) {
    return extractAmazon(doc) satisfies ExtractedProductInfo;
  }
  if (lowerUrl.includes("flipkart.com")) {
    return extractFlipkart(doc) satisfies ExtractedProductInfo;
  }
  return extractGeneric(doc) satisfies ExtractedProductInfo;
}
type ExtractedProductInfo = {
  title: string | null;
  price: string | null;
  description: string | null;
};

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

const getText = (root: Document, selector: string) => {
  const el = root.querySelector<HTMLElement>(selector);
  return el?.textContent ? normalize(el.textContent) : null;
};

const getMeta = (root: Document, name: string) => {
  const el =
    root.querySelector<HTMLMetaElement>(`meta[name="${name}"]`) ||
    root.querySelector<HTMLMetaElement>(`meta[property="${name}"]`);
  return el?.content ? normalize(el.content) : null;
};

const getPrice = (root: Document, selectors: string[]) => {
  for (const selector of selectors) {
    const value = getText(root, selector);
    if (value) return value;
  }
  return null;
};

const getDescription = (root: Document, selectors: string[]) => {
  for (const selector of selectors) {
    const value = getText(root, selector);
    if (value) return value;
  }
  return null;
};

export function extractProductInfoFromHTML(html: string, url: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const lowerUrl = url.toLowerCase();

  let title: string | null = null;
  let price: string | null = null;
  let description: string | null = null;

  if (lowerUrl.includes("amazon.")) {
    title =
      getText(doc, "#productTitle") ||
      getMeta(doc, "og:title") ||
      getText(doc, "title");
    price = getPrice(doc, [
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      "#priceblock_saleprice",
      ".a-price .a-offscreen",
      "[data-a-color='price'] .a-offscreen",
    ]);
    description =
      getDescription(doc, [
        "#productDescription",
        "#feature-bullets",
        "[data-feature-name='product-description']",
      ]) || getMeta(doc, "og:description");
  } else if (lowerUrl.includes("flipkart.com")) {
    title =
      getText(doc, "span.B_NuCI") ||
      getMeta(doc, "og:title") ||
      getText(doc, "title");
    price = getPrice(doc, [
      "div._30jeq3",
      "div._1vC4OE",
      "[class*='price']",
    ]);
    description =
      getDescription(doc, [
        "div._1AN87F",
        "div._1mXcCf",
        "div._2o-xpa",
      ]) || getMeta(doc, "og:description");
  } else {
    title = getMeta(doc, "og:title") || getText(doc, "title");
    price =
      getPrice(doc, [
        "[itemprop='price']",
        "[data-price]",
        ".price",
        ".product-price",
      ]) || getMeta(doc, "product:price:amount");
    description =
      getDescription(doc, [
        "[itemprop='description']",
        ".product-description",
        "#description",
      ]) || getMeta(doc, "og:description");
  }

  return {
    title,
    price,
    description,
  } satisfies ExtractedProductInfo;
}
