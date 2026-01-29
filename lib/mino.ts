export type MinoPolicyPage = {
  url: string;
  text: string;
};

export type MinoResult = {
  productUrl: string;
  productText: string;
  policyPages: MinoPolicyPage[];
};

type RawMinoResult = {
  productUrl?: unknown;
  productText?: unknown;
  policyPages?: unknown;
};

const PROMPT = [
  "Open the product page at the given url.",
  "Extract visible text from the product page.",
  "Find links on the same site related to returns, refunds, warranty, or policies.",
  "Open up to 3 relevant policy pages (prioritize returns and warranty).",
  "Extract visible text from each policy page.",
  "Return JSON only with this schema:",
  "{",
  '  "productUrl": string,',
  '  "productText": string,',
  '  "policyPages": [',
  '    { "url": string, "text": string }',
  "  ]",
  "}",
  "No extra keys. No markdown.",
].join("\n");

function looksLikeSseEndpoint(apiUrl: string): boolean {
  return apiUrl.includes("/run-sse");
}

function extractJsonFromSse(raw: string): string | null {
  const dataLines = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, "").trim())
    .filter(Boolean);

  if (!dataLines.length) return null;
  const lastPayload = dataLines[dataLines.length - 1];

  if (lastPayload === "[DONE]") {
    for (let i = dataLines.length - 2; i >= 0; i -= 1) {
      if (dataLines[i] !== "[DONE]") return dataLines[i];
    }
  }

  return lastPayload;
}

export async function runMinoAgent(url: string): Promise<MinoResult> {
  const apiUrl = process.env.MINO_API_URL;
  const apiKey = process.env.MINO_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error("MINO_API_URL or MINO_API_KEY is not set");
  }

  const useSse = looksLikeSseEndpoint(apiUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (useSse) {
    headers["X-API-Key"] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const body = useSse
    ? JSON.stringify({ url, goal: PROMPT })
    : JSON.stringify({ prompt: PROMPT, data: { url } });

  const res = await fetch(apiUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const message = await res.text();
    const snippet = message.slice(0, 400);
    console.error("Mino API error", { status: res.status, snippet });
    throw new Error(`Mino API error: ${res.status}`);
  }

  const raw = await res.text();
  if (!raw.trim()) {
    console.error("Mino API empty response");
  }
  const jsonText = useSse ? extractJsonFromSse(raw) : raw;
  if (!jsonText) {
    throw new Error("Mino API response did not include JSON data");
  }
  let parsed: RawMinoResult;
  try {
    parsed = JSON.parse(jsonText) as RawMinoResult;
  } catch {
    throw new Error("Mino API response was not valid JSON");
  }

  const productUrl =
    typeof parsed.productUrl === "string" ? parsed.productUrl : url;
  const productText =
    typeof parsed.productText === "string" ? parsed.productText : "";
  const policyPages = Array.isArray(parsed.policyPages)
    ? parsed.policyPages
        .map((entry) => {
          if (
            entry &&
            typeof entry === "object" &&
            "url" in entry &&
            "text" in entry
          ) {
            const urlValue =
              typeof entry.url === "string" ? entry.url : undefined;
            const textValue =
              typeof entry.text === "string" ? entry.text : undefined;
            if (urlValue && textValue) {
              return { url: urlValue, text: textValue };
            }
          }
          return null;
        })
        .filter((entry): entry is MinoPolicyPage => Boolean(entry))
    : [];

  return {
    productUrl,
    productText,
    policyPages,
  };
}
