import { NextResponse } from "next/server";

import { runMinoAgent } from "@/lib/mino";
import { extractClaims, extractPolicy } from "@/lib/extract";
import { detectContradictions } from "@/lib/rules";
import type { RuleFlag } from "@/lib/rules";
import { explainFlags } from "@/lib/explain";
import { buildProductDetails, buildProductInsight } from "@/lib/summary";

const TEST_CASES: Record<string, { productText: string; policyText: string }> = {
  "https://example.com/product/clear": {
    productText:
      "In stock. Returns accepted within 30 days. 1 year warranty included.",
    policyText:
      "Return policy: returns accepted within 30 days. Warranty lasts 12 months.",
  },
  "https://example.com/product/conflict": {
    productText: "Price match guarantee. In stock. Free returns in 30 days.",
    policyText:
      "Prices subject to change without notice. Availability not guaranteed.",
  },
  "https://example.com/product/unclear": {
    productText: "Warranty included.",
    policyText: "",
  },
};

export async function POST(request: Request) {
  type StepStatus = "done" | "failed";
  type TraceStep = {
    name: string;
    status: StepStatus;
    durationMs?: number;
    detail?: string;
  };

  const startedAt = Date.now();
  const steps: TraceStep[] = [];

  const respond = (
    flags: RuleFlag[],
    verdict: "good" | "caution" | "risk" | "unclear" = "unclear"
  ) => {
    const processingMs = Date.now() - startedAt;
    return NextResponse.json({
      verdict,
      flags,
      explanations: explainFlags(flags),
      processingMs,
      steps,
    });
  };

  const trackStep = async <T>(
    name: string,
    task: () => Promise<T> | T
  ): Promise<T> => {
    const stepStartedAt = Date.now();
    try {
      const result = await task();
      steps.push({
        name,
        status: "done",
        durationMs: Date.now() - stepStartedAt,
      });
      return result;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed";
      steps.push({
        name,
        status: "failed",
        durationMs: Date.now() - stepStartedAt,
        detail,
      });
      throw error;
    }
  };

  let body: { url?: string };
  try {
    body = await trackStep("Parse request", async () => {
      return (await request.json()) as { url?: string };
    });
  } catch {
    return respond(["analysis_failed"]);
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    steps.push({
      name: "Validate URL",
      status: "failed",
      detail: "Missing URL",
    });
    return respond(["invalid_url"]);
  }

  try {
    new URL(url);
    steps.push({ name: "Validate URL", status: "done" });
  } catch {
    steps.push({
      name: "Validate URL",
      status: "failed",
      detail: "Invalid URL",
    });
    return respond(["invalid_url"]);
  }

  try {
    const testCase = TEST_CASES[url];
    if (process.env.NODE_ENV !== "production") {
      if (!testCase) {
        steps.push({
          name: "Load test case",
          status: "failed",
          detail: "Unknown test URL",
        });
        return respond(["dev_only"]);
      }
      steps.push({ name: "Load test case", status: "done" });
      const claims = await trackStep("Extract claims", () =>
        extractClaims(testCase.productText)
      );
      const policy = await trackStep("Extract policy", () =>
        extractPolicy(testCase.policyText)
      );
      const rules = await trackStep("Detect contradictions", () =>
        detectContradictions(claims, policy)
      );
      const explanations = await trackStep("Explain flags", () =>
        explainFlags(rules.flags)
      );

      const insight =
        rules.flags.length === 0
          ? buildProductInsight(
              testCase.productText,
              testCase.policyText,
              claims,
              policy
            )
          : null;
      const details = buildProductDetails(
        url,
        testCase.productText,
        testCase.policyText,
        rules.flags,
        claims,
        policy
      );

      return NextResponse.json({
        verdict: rules.verdict,
        flags: rules.flags,
        explanations,
        processingMs: Date.now() - startedAt,
        steps,
        insight,
        details,
      });
    }

    const mino = await trackStep("Fetch Mino data", () => runMinoAgent(url));
    const policyText = await trackStep("Compile policy text", () =>
      mino.policyPages.map((page) => page.text).join("\n")
    );

    const claims = await trackStep("Extract claims", () =>
      extractClaims(mino.productText)
    );
    const policy = await trackStep("Extract policy", () =>
      extractPolicy(policyText)
    );
    const rules = await trackStep("Detect contradictions", () =>
      detectContradictions(claims, policy)
    );
    const explanations = await trackStep("Explain flags", () =>
      explainFlags(rules.flags)
    );
    const insight =
      rules.flags.length === 0 || !policyText.trim()
        ? buildProductInsight(
            mino.productText,
            policyText,
            claims,
            policy
          )
        : null;
    const details = buildProductDetails(
      url,
      mino.productText,
      policyText,
      rules.flags,
      claims,
      policy
    );

    return NextResponse.json({
      verdict: rules.verdict,
      flags: rules.flags,
      explanations,
      processingMs: Date.now() - startedAt,
      steps,
      insight,
      details,
    });
  } catch (error) {
    return respond(["analysis_failed"]);
  }
}
