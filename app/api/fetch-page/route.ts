import { NextResponse } from "next/server";

type FetchRequest = {
  url?: string;
};

export async function POST(request: Request) {
  let body: FetchRequest;
  try {
    body = (await request.json()) as FetchRequest;
  } catch {
    return NextResponse.json({ blocked: true });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ blocked: true });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ blocked: true });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

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
      return NextResponse.json({ blocked: true });
    }

    const html = await res.text();
    return NextResponse.json({ blocked: false, html });
  } catch {
    return NextResponse.json({ blocked: true });
  } finally {
    clearTimeout(timeout);
  }
}
import { NextResponse } from "next/server";

type FetchRequest = {
  url?: string;
};

export async function POST(request: Request) {
  let body: FetchRequest;
  try {
    body = (await request.json()) as FetchRequest;
  } catch {
    return NextResponse.json({ blocked: true });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ blocked: true });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ blocked: true });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

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
      return NextResponse.json({ blocked: true });
    }

    const html = await res.text();
    return NextResponse.json({ blocked: false, html });
  } catch {
    return NextResponse.json({ blocked: true });
  } finally {
    clearTimeout(timeout);
  }
}
