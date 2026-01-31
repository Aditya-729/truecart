import { NextResponse } from "next/server";

import { analyzeProduct } from "@/lib/analyzePipeline";
import type { StreamStepEvent } from "@/lib/analyzePipeline";
import { fetchPageHtml } from "@/lib/server/fetchPage";
import { extractProductInfoServer } from "@/lib/server/extractProductInfo";

const encoder = new TextEncoder();

type SendStep = (name: string, emoji: string, message: string) => void;

const sendEvent = (
  controller: ReadableStreamDefaultController,
  payload: string,
  event?: string
) => {
  const prefix = event ? `event: ${event}\n` : "";
  controller.enqueue(encoder.encode(`${prefix}data: ${payload}\n\n`));
};

const createStep = (name: string, emoji: string, message: string): StreamStepEvent => ({
  id: Math.random().toString(36).slice(2),
  time: new Date().toISOString(),
  name,
  emoji,
  message,
});

async function streamAnalysis(url: string) {
  return new ReadableStream({
    async start(controller) {
      const sendStep: SendStep = (name, emoji, message) => {
        const step = createStep(name, emoji, message);
        sendEvent(controller, JSON.stringify(step));
      };

      try {
        if (!url) {
          sendStep("validate_input", "🔍", "Validating URL and user inputs");
          const result = await analyzeProduct("");
          sendEvent(controller, JSON.stringify(result), "done");
          controller.close();
          return;
        }
        try {
          new URL(url);
        } catch {
          sendStep("validate_input", "🔍", "Validating URL and user inputs");
          const result = await analyzeProduct("");
          sendEvent(controller, JSON.stringify(result), "done");
          controller.close();
          return;
        }

        sendStep("validate_input", "🔍", "Validating URL and user inputs");
        sendStep("fetch_product_page", "🌐", "Fetching product page HTML");
        const pageResult = await fetchPageHtml(url);
        if (!pageResult.blocked && pageResult.html) {
          sendStep(
            "extract_product_info",
            "🧠",
            "Extracting product title, price and description"
          );
          extractProductInfoServer(pageResult.html);
        } else {
          sendStep(
            "extract_product_info",
            "🧠",
            "Extracting product title, price and description"
          );
        }

        const result = await analyzeProduct(url, {
          emitValidationStep: false,
          onStep: (step) => {
            sendEvent(controller, JSON.stringify(step));
          },
        });

        sendEvent(controller, JSON.stringify(result), "done");
        controller.close();
      } catch {
        const fallback = await analyzeProduct("");
        sendEvent(controller, JSON.stringify(fallback), "done");
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
