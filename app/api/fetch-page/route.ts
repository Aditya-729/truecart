import { NextResponse } from "next/server";

import { fetchPageHtml } from "@/lib/server/fetchPage";

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

  const result = await fetchPageHtml(url);
  return NextResponse.json(result);
}
