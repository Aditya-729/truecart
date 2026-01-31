import { explainFlags } from "@/lib/explain";
import { extractClaims, extractPolicy } from "@/lib/extract";
import { runMinoAgent } from "@/lib/mino";
import { detectContradictions } from "@/lib/rules";
import type { RuleFlag } from "@/lib/rules";
import { buildProductDetails, buildProductInsight } from "@/lib/summary";

type StepStatus = "done" | "failed";

export type TraceStep = {
  name: string;
  status: StepStatus;
  durationMs?: number;
  detail?: string;
};

export type AnalyzeResult = {
  verdict: "good" | "caution" | "risk" | "unclear";
  flags: RuleFlag[];
  explanations: string[];
  processingMs: number;
  steps: TraceStep[];
  insight: ReturnType<typeof buildProductInsight> | null;
  details: ReturnType<typeof buildProductDetails>;
  previewImage: string | null;
};

export type StreamStepEvent = {
  id: string;
  time: string;
  name: string;
  emoji: string;
  message: string;
};

type AnalyzeOptions = {
  onStep?: (step: StreamStepEvent) => void;
  emitValidationStep?: boolean;
};

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

const createStepEvent = (
  name: string,
  emoji: string,
  message: string
): StreamStepEvent => ({
  id: Math.random().toString(36).slice(2),
  time: new Date().toISOString(),
  name,
  emoji,
  message,
});

export async function analyzeProduct(
  url: string,
  options: AnalyzeOptions = {}
): Promise<AnalyzeResult> {
  const startedAt = Date.now();
  const steps: TraceStep[] = [];

  const sendStep = (name: string, emoji: string, message: string) => {
    if (!options.onStep) return;
    options.onStep(createStepEvent(name, emoji, message));
  };

  const respond = (
    flags: RuleFlag[],
    verdict: "good" | "caution" | "risk" | "unclear" = "unclear"
  ): AnalyzeResult => {
    const processingMs = Date.now() - startedAt;
    return {
      verdict,
      flags,
      explanations: explainFlags(flags),
      processingMs,
      steps,
      insight: null,
      details: buildProductDetails(url, "", "", flags, {}, {}),
      previewImage: null,
    };
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

  if (options.emitValidationStep !== false) {
    sendStep("validate_input", "🔍", "Validating URL and user inputs");
  }
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

    sendStep("extract_rules", "📄", "Extracting eligibility and exclusion rules");
    const claims = await trackStep("Extract claims", () =>
      extractClaims(testCase.productText)
    );
    const policy = await trackStep("Extract policy", () =>
      extractPolicy(testCase.policyText)
    );

    sendStep("parse_documents", "🧾", "Parsing uploaded documents and OCR text");
    sendStep("analyze_rules", "⚙️", "Matching rules with user profile");
    const rules = await trackStep("Detect contradictions", () =>
      detectContradictions(claims, policy)
    );
    const explanations = await trackStep("Explain flags", () =>
      explainFlags(rules.flags)
    );
    sendStep("finalize", "📊", "Compiling rejection reasons and recommendations");

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

    return {
      verdict: rules.verdict,
      flags: rules.flags,
      explanations,
      processingMs: Date.now() - startedAt,
      steps,
      insight,
      details,
      previewImage: null,
    };
  }

  sendStep("call_mino", "🤖", "Sending pages to Mino agent");
  const mino = await trackStep("Fetch Mino data", () => runMinoAgent(url));

  sendStep("collect_pages", "📚", "Collecting eligibility and exclusion pages");
  const policyText = await trackStep("Compile policy text", () =>
    mino.policyPages.map((page) => page.text).join("\n")
  );

  sendStep("extract_rules", "📄", "Extracting eligibility and exclusion rules");
  const claims = await trackStep("Extract claims", () =>
    extractClaims(mino.productText)
  );
  const policy = await trackStep("Extract policy", () =>
    extractPolicy(policyText)
  );

  sendStep("parse_documents", "🧾", "Parsing uploaded documents and OCR text");
  sendStep("analyze_rules", "⚙️", "Matching rules with user profile");
  const rules = await trackStep("Detect contradictions", () =>
    detectContradictions(claims, policy)
  );
  const explanations = await trackStep("Explain flags", () =>
    explainFlags(rules.flags)
  );
  sendStep("finalize", "📊", "Compiling rejection reasons and recommendations");

  const insight =
    rules.flags.length === 0 || !policyText.trim()
      ? buildProductInsight(mino.productText, policyText, claims, policy)
      : null;
  const details = buildProductDetails(
    url,
    mino.productText,
    policyText,
    rules.flags,
    claims,
    policy,
    {
      title: mino.productTitle,
      price: mino.productPrice,
      description: mino.productDescription,
    }
  );

  return {
    verdict: rules.verdict,
    flags: rules.flags,
    explanations,
    processingMs: Date.now() - startedAt,
    steps,
    insight,
    details,
    previewImage: mino.previewImage ?? null,
  };
}
