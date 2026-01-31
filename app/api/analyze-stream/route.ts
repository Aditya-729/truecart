import { NextResponse } from "next/server";

import { analyzeProduct } from "@/lib/analyzePipeline";
import { fetchPageHtml } from "@/lib/server/fetchPage";
import { extractProductInfoServer } from "@/lib/server/extractProductInfo";

const encoder = new TextEncoder();

type SendActivity = (message: string) => void;
type SendLongStep = (title: string) => void;

const sendEvent = (
  controller: ReadableStreamDefaultController,
  event: string,
  payload: unknown
) => {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
  );
};

async function streamAnalysis(url: string) {
  return new ReadableStream({
    async start(controller) {
      const sendActivity: SendActivity = (message) =>
        sendEvent(controller, "activity", { message });
      const sendLongStep: SendLongStep = (title) =>
        sendEvent(controller, "long-step", { title });
      const withHeartbeat = async <T>(title: string, task: () => Promise<T> | T) => {
        sendLongStep(title);
        const timer = setInterval(() => {
          sendActivity(`Still working on: ${title}…`);
        }, 2000);
        try {
          return await task();
        } finally {
          clearInterval(timer);
        }
      };

      try {
        if (!url) {
          sendActivity("Validating URL and user inputs");
          const result = await analyzeProduct("");
          sendEvent(controller, "done", result);
          controller.close();
          return;
        }
        try {
          new URL(url);
        } catch {
          sendActivity("Validating URL and user inputs");
          const result = await analyzeProduct("");
          sendEvent(controller, "done", result);
          controller.close();
          return;
        }

        sendActivity("Validating URL and user inputs");
        sendActivity("Fetching product page HTML");
        const pageResult = await withHeartbeat("Fetching product page", () =>
          fetchPageHtml(url)
        );
        if (!pageResult.blocked && pageResult.html) {
          sendActivity("Extracting product title, price and description");
          extractProductInfoServer(pageResult.html);
        } else {
          sendActivity("Extracting product title, price and description");
        }

        const result = await analyzeProduct(url, {
          emitValidationStep: false,
          onActivity: (message) => {
            sendActivity(message);
          },
          onLongStep: (title) => {
            sendLongStep(title);
          },
        });

        sendEvent(controller, "done", result);
        controller.close();
      } catch {
        const fallback = await analyzeProduct("");
        sendEvent(controller, "done", fallback);
        controller.close();
      }
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") ?? "";

  const stream = await streamAnalysis(url);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json({ blocked: true });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const stream = await streamAnalysis(url);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
