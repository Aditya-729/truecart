import { NextResponse } from "next/server";

import type { RuleFlag } from "@/lib/rules";
import { analyzeProduct } from "@/lib/analyzePipeline";
import { explainFlags } from "@/lib/explain";

export async function POST(request: Request) {
  const startedAt = Date.now();

  let body: { url?: string };
  try {
    body = await trackStep("Parse request", async () => {
      return (await request.json()) as { url?: string };
    });
  } catch {
    return respond(["analysis_failed"]);
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";

  try {
    const result = await analyzeProduct(url);
    return NextResponse.json(result);
  } catch (error) {
    const processingMs = Date.now() - startedAt;
    return NextResponse.json({
      verdict: "unclear",
      flags: ["analysis_failed" as RuleFlag],
      explanations: explainFlags(["analysis_failed"]),
      processingMs,
      steps: [],
      insight: null,
      details: {
        name: "",
        price: null,
        description: "",
        flags: [],
        hiddenFindings: [],
        policyStatus: "missing",
      },
      previewImage: null,
    });
  }
}
