"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RuleFlag } from "@/lib/rules";
import { extractProductInfoFromHTML } from "@/lib/client/extractProductInfo";

type AnalyzeResponse = {
  verdict: "good" | "caution" | "risk" | "unclear";
  flags: RuleFlag[];
  explanations: string[];
  processingMs?: number;
  previewImage?: string | null;
  steps?: Array<{
    name: string;
    status: "done" | "failed";
    durationMs?: number;
    detail?: string;
  }>;
  insight?: {
    message: string;
    summary: string;
    pros: string[];
    cons: string[];
    policyStatus: "present" | "missing";
  } | null;
  details?: {
    name: string;
    price: string | null;
    description: string;
    flags: RuleFlag[];
    hiddenFindings: string[];
    policyStatus: "present" | "missing";
  };
};

type LogEntry = {
  id: string;
  text: string;
  type: "info" | "success" | "warn";
};

type Toast = {
  id: string;
  message: string;
};

type ProductInfo = {
  status: "idle" | "ready" | "blocked" | "error";
  title: string | null;
  price: string | null;
  description: string | null;
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [pulseInput, setPulseInput] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [activity, setActivity] = useState<string[]>([]);
  const [productInfo, setProductInfo] = useState<ProductInfo>({
    status: "idle",
    title: null,
    price: null,
    description: null,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cardExpanded, setCardExpanded] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);
  const [ripple, setRipple] = useState<{ id: string; x: number; y: number } | null>(
    null
  );
  const runIdRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const easeOut = [0.16, 1, 0.3, 1] as const;
  const easeInOut = [0.4, 0, 0.2, 1] as const;

  const fallbackFlags: RuleFlag[] = ["analysis_failed"];

  const pushLog = (text: string, type: "info" | "success" | "warn" = "info") => {
    setLogs((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), text, type },
    ]);
  };

  const pushToast = (message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
  };

  function pushActivity(msg: string) {
    setActivity((prev) => [...prev, msg]);
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setLogs([]);
    setRunning(true);
    setActivity([]);
    setProductInfo({
      status: "idle",
      title: null,
      price: null,
      description: null,
    });
    setCardExpanded(true);
    pushToast("🚀 Analysis started");

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const pushLogSafe = (
      text: string,
      type: "info" | "success" | "warn" = "info"
    ) => {
      if (runIdRef.current !== runId) return;
      pushLog(text, type);
    };

    try {
      pushActivity("Validating URL… 🔍");
      try {
        new URL(url);
      } catch {
        pushActivity("Analysis failed – see error details ❌");
        throw new Error("Invalid URL");
      }

      pushActivity("Contacting Mino agent… 🤖");
      pushActivity("Fetching application page content… 🌐");
      const pageRes = await fetch("/api/fetch-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (pageRes.ok) {
        const pageData = (await pageRes.json()) as {
          blocked: boolean;
          html?: string;
        };
        if (pageData.blocked || !pageData.html) {
          setProductInfo((prev) => ({ ...prev, status: "blocked" }));
        } else {
          const extracted = extractProductInfoFromHTML(pageData.html, url);
          setProductInfo({
            status: "ready",
            title: extracted.title,
            price: extracted.price,
            description: extracted.description,
          });
        }
      } else {
        setProductInfo((prev) => ({ ...prev, status: "error" }));
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = (await res.json()) as AnalyzeResponse;
      pushActivity("Extracting eligibility rules… 📄");
      pushActivity("Extracting document text… 🧾");
      pushActivity("Running document quality checks… 🧪");
      pushActivity("Running rejection analysis engine… ⚙️");
      pushActivity("Preparing structured results… 📊");
      if (!res.ok) {
        throw new Error("Request failed.");
      }
      setResult(data);
      pushLogSafe("⚖️ Computing trust verdict…", "success");
      pushLogSafe("📊 Preparing report…", "success");
      pushLogSafe("✅ Trust report ready.", "success");
      pushToast("🎉 Trust report generated");
    } catch {
      setResult({
        verdict: "unclear",
        flags: fallbackFlags,
        explanations: [],
      });
      pushActivity("Analysis failed – see error details ❌");
      pushLogSafe("⚠️ Unable to complete analysis.", "warn");
    } finally {
      setLoading(false);
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!url) return;
    setPulseInput(true);
    const timer = setTimeout(() => setPulseInput(false), 150);
    return () => clearTimeout(timer);
  }, [url]);

  useEffect(() => {
    if (loading || result) {
      setCardExpanded(true);
      return;
    }
    setCardExpanded(false);
  }, [loading, result]);

  useEffect(() => {
    if (!loading) {
      setElapsedMs(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 120);
    return () => clearInterval(timer);
  }, [loading]);

  const verdictConfig = useMemo(() => {
    const verdict = result?.verdict ?? "unclear";
    return {
      label: verdict.toUpperCase(),
      ring:
        verdict === "good"
          ? "from-emerald-400/40 via-emerald-300/20 to-emerald-500/40"
          : verdict === "caution"
            ? "from-amber-400/40 via-orange-300/20 to-yellow-500/40"
            : verdict === "risk"
              ? "from-rose-500/50 via-red-400/25 to-fuchsia-500/40"
              : "from-slate-400/30 via-sky-300/20 to-slate-500/30",
      glow:
        verdict === "good"
          ? "shadow-emerald-400/30"
          : verdict === "caution"
            ? "shadow-amber-400/30"
            : verdict === "risk"
              ? "shadow-rose-500/40"
              : "shadow-slate-400/30",
      accent:
        verdict === "good"
          ? "text-emerald-300"
          : verdict === "caution"
            ? "text-amber-300"
            : verdict === "risk"
              ? "text-rose-300"
              : "text-slate-300",
    };
  }, [result]);

  const verdictMotion = useMemo(() => {
    switch (result?.verdict) {
      case "good":
        return {
          initial: { scale: 0.92, opacity: 0 },
          animate: {
            scale: 1,
            opacity: 1,
            boxShadow: [
              "0 0 0px rgba(52, 211, 153, 0.0)",
              "0 0 35px rgba(52, 211, 153, 0.35)",
              "0 0 10px rgba(52, 211, 153, 0.2)",
            ],
          },
          transition: {
            duration: 0.9,
            ease: easeOut,
            repeat: Infinity,
            repeatType: "mirror" as const,
          },
        };
      case "caution":
        return {
          initial: { scale: 0.92, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { duration: 0.8, ease: easeOut },
        };
      case "risk":
        return {
          initial: { scale: 0.92, opacity: 0 },
          animate: {
            scale: [1, 1.02, 1],
            opacity: 1,
            x: [0, -3, 3, -2, 2, 0],
            boxShadow: [
              "0 0 0px rgba(244, 63, 94, 0.0)",
              "0 0 30px rgba(244, 63, 94, 0.45)",
              "0 0 12px rgba(244, 63, 94, 0.25)",
            ],
          },
          transition: {
            duration: 0.6,
            ease: easeInOut,
            repeat: Infinity,
            repeatDelay: 2,
          },
        };
      default:
        return {
          initial: { scale: 0.96, opacity: 0 },
          animate: { scale: 1, opacity: [0.6, 1, 0.6] },
          transition: {
            duration: 2.2,
            ease: easeInOut,
            repeat: Infinity,
          },
        };
    }
  }, [easeInOut, easeOut, result?.verdict]);

  const ringMotion = useMemo(() => {
    if (result?.verdict === "caution") {
      return {
        initial: { opacity: 0.6, backgroundPosition: "0% 50%" },
        animate: { opacity: 1, backgroundPosition: "100% 50%" },
        transition: prefersReducedMotion
          ? { duration: 0 }
          : { duration: 4, ease: easeInOut, repeat: Infinity },
      };
    }
    return {
      initial: { opacity: 0.7 },
      animate: { opacity: 1 },
      transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: easeOut },
    };
  }, [easeInOut, easeOut, prefersReducedMotion, result?.verdict]);

  const heroWords = useMemo(
    () => "Instant trust signal for any product link".split(" "),
    []
  );

  const handleCardRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = Math.random().toString(36).slice(2);
    setRipple({ id, x, y });
    setTimeout(() => {
      setRipple((prev) => (prev?.id === id ? null : prev));
    }, 600);
  };

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-1/2 top-[-10%] h-64 w-64 -translate-x-1/2 rounded-full bg-sky-400/20 blur-[120px]"
          animate={
            prefersReducedMotion
              ? { opacity: 0.6 }
              : { x: [0, -20, 10, 0], opacity: [0.4, 0.7, 0.5, 0.6] }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 18, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <motion.div
          className="absolute right-[-10%] top-[20%] h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[140px]"
          animate={
            prefersReducedMotion
              ? { opacity: 0.5 }
              : { x: [0, 15, -10, 0], y: [0, -10, 10, 0], opacity: [0.5, 0.7, 0.4, 0.6] }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 22, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <motion.div
          className="absolute bottom-[-20%] left-[10%] h-80 w-80 rounded-full bg-emerald-400/10 blur-[160px]"
          animate={
            prefersReducedMotion
              ? { opacity: 0.5 }
              : { x: [0, 10, -20, 0], opacity: [0.3, 0.6, 0.4, 0.5] }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 26, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: easeOut, delay: 0.1 }}
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl animated-gradient"
        onMouseDown={handleCardRipple}
        style={{ transformStyle: "preserve-3d" }}
      >
        {ripple ? (
          <span
            className="pointer-events-none absolute h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 blur-2xl"
            style={{
              left: ripple.x,
              top: ripple.y,
              animation: prefersReducedMotion ? "none" : "ripple 0.6s ease-out",
            }}
          />
        ) : null}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: easeOut }
            }
            className="text-center"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              TrueCart
            </p>
            <h1 className="mt-3 flex flex-wrap justify-center gap-x-2 text-3xl font-semibold text-white sm:text-4xl">
              {heroWords.map((word, index) => (
                <motion.span
                  key={word}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.4, delay: 0.05 * index }
                  }
                >
                  {word}
                </motion.span>
              ))}
            </h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: easeOut }}
              className="mx-auto mt-3 h-1 w-24 origin-left rounded-full bg-gradient-to-r from-sky-400/80 via-indigo-400/60 to-transparent"
            />
            <p className="mt-3 text-sm text-slate-400">
              One URL in, one verdict out. Fast, clean, and confidence-first.
            </p>
          </motion.div>

          <motion.form
            onSubmit={onSubmit}
            className="mt-8 flex flex-col gap-4 sm:flex-row"
            animate={{
              rotateX: cardExpanded ? 0 : -6,
              scaleY: cardExpanded ? 1 : 0.85,
              boxShadow: cardExpanded
                ? "0 16px 60px rgba(0,0,0,0.45)"
                : "0 6px 30px rgba(0,0,0,0.25)",
            }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: easeOut }}
            style={{ transformOrigin: "top center" }}
            onFocus={() => setCardExpanded(true)}
          >
            <motion.div
              animate={{
                boxShadow: isFocused
                  ? "0 0 0 1px rgba(148, 163, 184, 0.4), 0 0 30px rgba(59, 130, 246, 0.35)"
                  : "0 0 0 1px rgba(148, 163, 184, 0.15), 0 0 0 rgba(0,0,0,0)",
                scale: pulseInput ? 1.01 : 1,
              }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: easeOut }}
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-[1px] backdrop-blur"
            >
              <input
                type="url"
                required
                placeholder="Paste product URL"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-full rounded-[15px] border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </motion.div>
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.03, boxShadow: "0 0 0 3px rgba(59,130,246,0.25)" }}
              whileTap={{ scale: 0.96 }}
              animate={{
                boxShadow: loading
                  ? "0 0 25px rgba(59, 130, 246, 0.35)"
                  : "0 0 18px rgba(15, 23, 42, 0.2)",
              }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500/90 via-blue-500/90 to-indigo-500/90 px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-70"
              onMouseEnter={() => setButtonHover(true)}
              onMouseLeave={() => setButtonHover(false)}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? "Analyzing" : "Analyze"}
                {loading ? (
                  <motion.span
                    animate={prefersReducedMotion ? { rotate: 0 } : { rotate: 360 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 2.4, repeat: Infinity, ease: "linear" }
                    }
                    className="text-base"
                  >
                    ⟳
                  </motion.span>
                ) : null}
              </span>
              <motion.span
                aria-hidden
                className="absolute inset-0 bg-white/10"
                animate={
                  loading
                    ? { opacity: 0.6, backgroundPosition: ["0% 50%", "100% 50%"] }
                    : { opacity: 0 }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                }
                style={{
                  backgroundImage:
                    "linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 100%)",
                  backgroundSize: "200% 200%",
                }}
              />
              <AnimatePresence>
                {buttonHover ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                    className="absolute -bottom-10 left-1/2 w-max -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[11px] text-slate-200 shadow-lg backdrop-blur"
                  >
                    We scan public sources only 🔍
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.button>
          </motion.form>

          <div className="mt-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
                  Agent activity
                </p>
                <span className="text-xs text-slate-500">
                  {running ? "Live" : "Idle"}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-200">
                <AnimatePresence initial={false}>
                  {activity.length ? (
                    activity.map((item, index) => (
                      <motion.div
                        key={`${item}-${index}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0 }
                            : { duration: 0.25, delay: index * 0.05 }
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono"
                      >
                        {item}
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      key="empty-activity"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-slate-500"
                    >
                      No activity yet. Paste a URL to begin.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <section className="mt-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: easeOut }
              }
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.35)] backdrop-blur"
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: easeOut }}
                    className="flex flex-col items-center justify-center gap-4 text-center"
                  >
                    <motion.div
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.5, 1, 0.5] }}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.4, repeat: Infinity }}
                      className="text-xs uppercase tracking-[0.3em] text-slate-400"
                    >
                      Live analysis
                    </motion.div>
                    <div className="text-3xl font-semibold text-white">
                      Analyzing...
                    </div>
                    <p className="text-sm text-slate-400">
                      Agent is exploring the product page and policy links.
                    </p>
                    <div className="mt-2 text-xs text-slate-500">
                      Elapsed: {(elapsedMs / 1000).toFixed(1)}s
                    </div>
                  </motion.div>
                ) : result ? (
                  <motion.div
                    layout
                    key={result.verdict}
                    initial={{ opacity: 0, x: 20, clipPath: "inset(0 100% 0 0)" }}
                    animate={{ opacity: 1, x: 0, clipPath: "inset(0 0% 0 0)" }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: easeOut }}
                    className="flex flex-col items-center justify-center gap-5 text-center"
                  >
                    <motion.div
                      layout
                      {...verdictMotion}
                      className={`relative flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-black/30 px-10 py-8 shadow-2xl backdrop-blur ${verdictConfig.glow}`}
                    >
                      <motion.div
                        {...ringMotion}
                        className={`pointer-events-none absolute inset-0 rounded-3xl border border-white/10 bg-gradient-to-r ${verdictConfig.ring} bg-[length:200%_200%]`}
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/10" />
                      <p
                        className={`text-4xl font-semibold tracking-[0.2em] sm:text-5xl ${verdictConfig.accent}`}
                      >
                        {verdictConfig.label}
                      </p>
                      <p className="max-w-sm text-sm text-slate-300">
                        {result.insight?.message ??
                          "No conflicting policy signals detected."}
                      </p>
                      {result.insight?.summary ? (
                        <p className="max-w-sm text-xs text-slate-400">
                          {result.insight.summary}
                        </p>
                      ) : null}
                    </motion.div>
                    {result.details ? (
                      <motion.div
                        layout
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left backdrop-blur"
                      >
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                          Product details
                        </p>
                        {productInfo.status === "blocked" ? (
                          <p className="mt-3 text-sm text-amber-200">
                            Product page blocks automated access. Showing
                            policy-only analysis.
                          </p>
                        ) : null}
                        <div className="mt-3 space-y-2 text-sm text-slate-200">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-slate-400">Name</span>
                            <span className="text-right text-white">
                              {productInfo.title ?? result.details.name}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-slate-400">Price</span>
                            <span className="text-right text-white">
                              {productInfo.price ?? result.details.price ?? "Not found"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-slate-400">Policy pages</span>
                            <span className="text-right text-white">
                              {result.details.policyStatus === "present"
                                ? "Detected"
                                : "Not found"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-slate-300">
                            Description
                          </p>
                          <p className="mt-2 text-sm text-slate-300">
                            {productInfo.description ?? result.details.description}
                          </p>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-slate-300">
                            Flags
                          </p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                            {result.details.flags.length ? (
                              result.details.flags.map((flag) => (
                                <li key={flag}>{flag}</li>
                              ))
                            ) : (
                              <li>none</li>
                            )}
                          </ul>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-slate-300">
                            Hidden costs or claims
                          </p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                            {result.details.hiddenFindings.length ? (
                              result.details.hiddenFindings.map((finding) => (
                                <li key={finding}>{finding}</li>
                              ))
                            ) : (
                              <li>none detected</li>
                            )}
                          </ul>
                        </div>
                      </motion.div>
                    ) : null}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex h-full flex-col items-center justify-center gap-2 text-center"
                  >
                    <p className="text-sm text-slate-500">
                      Paste a product URL to reveal its trust signal.
                    </p>
                    <p className="text-xs text-slate-600">
                      We compare product claims against policy pages.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </section>
        </div>
      </motion.div>

      <div className="pointer-events-none fixed right-5 top-5 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border border-white/10 bg-black/70 px-4 py-2 text-xs text-slate-200 shadow-lg backdrop-blur"
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}
