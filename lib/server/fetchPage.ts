type FetchPageResult = {
  blocked: boolean;
  html?: string;
};

export async function fetchPageHtml(
  url: string,
  timeoutMs = 10000
): Promise<FetchPageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { blocked: true };
    }

    const html = await res.text();
    return { blocked: false, html };
  } catch {
    return { blocked: true };
  } finally {
    clearTimeout(timeout);
  }
}
