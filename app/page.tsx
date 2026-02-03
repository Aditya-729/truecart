"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

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

type ActivityEvent = {
  id: string;
  message: string;
  time: string;
  kind?: "heartbeat" | "normal";
};

type LongStepToast = {
  id: string;
  title: string;
  icon: string;
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
  const [running, setRunning] = useState(false);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [liveRisk, setLiveRisk] = useState<string | null>(null);
  const [liveInsight, setLiveInsight] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<ProductInfo>({
    status: "idle",
    title: null,
    price: null,
    description: null,
  });
  const [longStepToasts, setLongStepToasts] = useState<LongStepToast[]>([]);
  const [showIdleHint, setShowIdleHint] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);
  const [glitchOffset, setGlitchOffset] = useState({ x: 0, y: 0 });
  const [expandedCompactIds, setExpandedCompactIds] = useState<Set<string>>(new Set());
  const [showEarlierSteps, setShowEarlierSteps] = useState(true);
  const sourceRef = useRef<EventSource | null>(null);
  const streamActiveRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const prefersReducedMotion = useReducedMotion();
  const totalSteps = 11;
  const easeOut = [0.16, 1, 0.3, 1] as const;
  const easeInOut = [0.4, 0, 0.2, 1] as const;
  const progressCount = activities.filter((item) => item.kind !== "heartbeat").length;
  const progress = result ? 1 : Math.min(progressCount / totalSteps, 1);
  const activeActivityId = running ? activities[0]?.id : null;

  const fallbackFlags: RuleFlag[] = ["analysis_failed"];

  const getLongStepIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes("document")) return "📄";
    if (lower.includes("product page")) return "🌐";
    if (lower.includes("policy")) return "🤖";
    if (lower.includes("eligibility") || lower.includes("rules")) return "🧠";
    return "⏳";
  };

  const pushLongStepToast = (title: string) => {
    const id = Math.random().toString(36).slice(2);
    const icon = getLongStepIcon(title);
    setLongStepToasts((prev) => [...prev, { id, title, icon }]);
    setTimeout(() => {
      setLongStepToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard errors silently.
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setRunning(true);
    setActivities([]);
    setLiveRisk(null);
    setLiveInsight(null);
    setShowIdleHint(false);
    setProductInfo({
      status: "idle",
      title: null,
      price: null,
      description: null,
    });
    setCardExpanded(true);
    setLongStepToasts([]);
    lastActivityRef.current = Date.now();

    try {
      try {
        new URL(url);
      } catch {
        throw new Error("Invalid URL");
      }

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

      if (sourceRef.current) {
        sourceRef.current.close();
      }

      const source = new EventSource(
        `/api/analyze-stream?url=${encodeURIComponent(url)}&t=${Date.now()}`
      );
      sourceRef.current = source;
      streamActiveRef.current = true;

      source.addEventListener("activity", (event) => {
        const data = JSON.parse((event as MessageEvent).data) as { message: string };
        const isHeartbeat = data.message.startsWith("Still working on:");
        setActivities((prev) => [
          {
            id: Math.random().toString(36).slice(2),
            message: data.message,
            time: new Date().toISOString(),
            kind: isHeartbeat ? "heartbeat" : "normal",
          },
          ...prev,
        ]);
        lastActivityRef.current = Date.now();
        setShowIdleHint(false);
        if (data.message.startsWith("Risk update:")) {
          setLiveRisk(data.message);
        }
        if (
          data.message.startsWith("Insight") ||
          data.message.startsWith("Insights") ||
          data.message.includes("hidden policy")
        ) {
          setLiveInsight(data.message);
        }
      });

      source.addEventListener("long-step", (event) => {
        const data = JSON.parse((event as MessageEvent).data) as { title: string };
        pushLongStepToast(data.title);
      });

      source.addEventListener("done", (event) => {
        const data = JSON.parse((event as MessageEvent).data) as AnalyzeResponse;
        setResult(data);
        setRunning(false);
        source.close();
        sourceRef.current = null;
        streamActiveRef.current = false;
        setShowIdleHint(false);
      });

      source.onerror = () => {
        source.close();
        sourceRef.current = null;
        setRunning(false);
        streamActiveRef.current = false;
        setShowIdleHint(false);
        setActivities((prev) => [
          {
            id: Math.random().toString(36).slice(2),
            message: "Analysis failed – see error details",
            time: new Date().toISOString(),
            kind: "normal",
          },
          ...prev,
        ]);
      };
    } catch {
      sourceRef.current?.close();
      sourceRef.current = null;
      streamActiveRef.current = false;
      setResult({
        verdict: "unclear",
        flags: fallbackFlags,
        explanations: [],
      });
      setActivities((prev) => [
        {
          id: Math.random().toString(36).slice(2),
          message: "Analysis failed – see error details",
          time: new Date().toISOString(),
          kind: "normal",
        },
        ...prev,
      ]);
      setRunning(false);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
      streamActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!streamActiveRef.current) {
        setShowIdleHint(false);
        return;
      }
      const idleFor = Date.now() - lastActivityRef.current;
      setShowIdleHint(idleFor > 3000);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const heroTitle = "TRUECART";
  const heroTitleLetters = useMemo(() => heroTitle.split(""), [heroTitle]);
  const heroSubtitle = "Product trust analysis for shopping links.";
  const trueCartSteps = useMemo(
    () => [
      "Analyzing product details…",
      "Checking pricing and discounts…",
      "Comparing similar products…",
      "Generating personalized recommendations…",
      "Preparing final insights…",
    ],
    []
  );

  const titleWordVariants = {
    hidden: (index: number) => ({
      opacity: 0,
      x: index % 2 === 0 ? -12 : 12,
      rotate: index % 2 === 0 ? -2 : 2,
      filter: "blur(6px)",
    }),
    visible: (index: number) => ({
      opacity: 1,
      x: 0,
      rotate: 0,
      filter: "blur(0px)",
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.35, delay: index * 0.06, ease: easeOut },
    }),
  };

  useEffect(() => {
    if (prefersReducedMotion) return;
    setGlitchOffset({
      x: Math.random() * 6 - 3,
      y: Math.random() * 6 - 3,
    });
  }, [prefersReducedMotion]);

  const recentActivities = useMemo(() => activities.slice(0, 4), [activities]);
  const olderActivities = useMemo(() => activities.slice(4), [activities]);

  const getActivityStatus = useCallback(
    (item: ActivityEvent) => {
      if (item.id === activeActivityId && running) return "running";
      const lower = item.message.toLowerCase();
      if (lower.includes("failed") || lower.includes("error")) return "error";
      return "done";
    },
    [activeActivityId, running]
  );

  const toggleCompact = useCallback((id: string) => {
    setExpandedCompactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <main className="relative min-h-screen w-full bg-[#0b0b0c] px-6 py-12 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-1/2 top-[-10%] h-64 w-64 -translate-x-1/2 rounded-full bg-white/10 blur-[140px]"
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
          className="absolute right-[-10%] top-[15%] h-72 w-72 rounded-full bg-slate-500/15 blur-[160px]"
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
          className="absolute bottom-[-20%] left-[10%] h-80 w-80 rounded-full bg-slate-400/10 blur-[180px]"
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

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 text-[10px] uppercase tracking-[0.45em] text-slate-500">
          <span>TRUECART</span>
          <span>Product trust analysis</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: easeOut }}
          className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.35, ease: easeOut }
              }
            >
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                Shopping trust analysis
              </p>
              <h1 className="mt-4 text-4xl font-semibold uppercase leading-tight tracking-[0.08em] text-white sm:text-5xl lg:text-6xl">
                <span
                  className={`glitch-title inline-flex flex-wrap gap-1 ${
                    prefersReducedMotion ? "" : "glitch-active"
                  }`}
                  data-text={heroTitle}
                  style={
                    {
                      "--glitch-x": `${glitchOffset.x}px`,
                      "--glitch-y": `${glitchOffset.y}px`,
                    } as CSSProperties
                  }
                >
                  {heroTitleLetters.map((letter, index) => (
                    <motion.span
                      key={`${letter}-${index}`}
                      initial={
                        prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 26, scale: 0.94 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { delay: index * 0.05, type: "spring", stiffness: 260, damping: 18 }
                      }
                      className="inline-block will-change-transform"
                    >
                      {letter}
                    </motion.span>
                  ))}
                </span>
              </h1>
              <div className="mt-4 h-px w-32 bg-gradient-to-r from-white/50 via-white/10 to-transparent" />
              <motion.p
                initial={
                  prefersReducedMotion
                    ? { opacity: 1, y: 0, letterSpacing: "0.08em", filter: "blur(0px)" }
                    : { opacity: 0, y: 10, letterSpacing: "0.3em", filter: "blur(8px)" }
                }
                animate={{ opacity: 1, y: 0, letterSpacing: "0.08em", filter: "blur(0px)" }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: easeOut }}
                className="mt-4 max-w-lg text-sm text-slate-400"
              >
                {heroSubtitle}
              </motion.p>
              <p className="mt-3 max-w-lg text-sm text-slate-500">
                Paste a shopping link to stream real-time analysis updates, risk snapshots, and a
                final verdict.
              </p>
            </motion.div>

            <motion.form
              onSubmit={onSubmit}
              className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur"
              animate={{
                rotateX: cardExpanded ? 0 : -4,
                scaleY: cardExpanded ? 1 : 0.92,
                boxShadow: cardExpanded
                  ? "0 18px 60px rgba(0,0,0,0.45)"
                  : "0 8px 30px rgba(0,0,0,0.25)",
              }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, ease: easeOut }}
              style={{ transformOrigin: "top center" }}
              onFocus={() => setCardExpanded(true)}
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <motion.div
                  animate={{
                    boxShadow: isFocused
                      ? "0 0 0 1px rgba(148, 163, 184, 0.45), 0 0 30px rgba(255,255,255,0.08)"
                      : "0 0 0 1px rgba(148, 163, 184, 0.15), 0 0 0 rgba(0,0,0,0)",
                    scale: pulseInput ? 1.01 : 1,
                  }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: easeOut }}
                  className="flex-1 rounded-2xl border border-white/10 bg-black/40 p-[1px]"
                >
                  <input
                    type="url"
                    required
                    placeholder="Paste product URL"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className="w-full rounded-[15px] border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </motion.div>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  animate={{
                    boxShadow: loading
                      ? "0 0 25px rgba(255, 255, 255, 0.2)"
                      : "0 0 18px rgba(15, 23, 42, 0.2)",
                  }}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition disabled:opacity-70"
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
                        ? { opacity: 0.4, backgroundPosition: ["0% 50%", "100% 50%"] }
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
              </div>
            </motion.form>

            <div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
                    Agent activity
                  </p>
                  <span className="text-xs text-slate-500">
                    {running ? "Live" : "Idle"}
                  </span>
                </div>
                {(liveRisk || liveInsight) && (
                  <div className="mt-3 space-y-2 text-xs text-slate-200">
                    {liveRisk ? (
                      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-rose-100">
                        {liveRisk}
                      </div>
                    ) : null}
                    {liveInsight ? (
                      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-emerald-100">
                        {liveInsight}
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400"
                      animate={{ width: `${progress * 100}%` }}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-3 text-xs text-slate-200">
                  {(loading || running) && trueCartSteps.length ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: easeOut }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200"
                    >
                      <div className="space-y-2">
                        {trueCartSteps.map((step, stepIndex) => (
                          <div key={step} className="flex flex-wrap gap-x-1">
                            {step.split(" ").map((word, wordIndex) => (
                              <motion.span
                                key={`${stepIndex}-${word}-${wordIndex}`}
                                initial={
                                  prefersReducedMotion
                                    ? { opacity: 1, y: 0, scale: 1, skewX: 0 }
                                    : { opacity: 0, y: 8, scale: 0.92, skewX: -6 }
                                }
                                animate={{ opacity: 1, y: 0, scale: 1, skewX: 0 }}
                                transition={
                                  prefersReducedMotion
                                    ? { duration: 0 }
                                    : {
                                        delay: stepIndex * 0.22 + wordIndex * 0.04,
                                        type: "spring",
                                        stiffness: 240,
                                        damping: 18,
                                      }
                                }
                                className="inline-block"
                              >
                                {word}
                              </motion.span>
                            ))}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                  <AnimatePresence initial={false}>
                    {activities.length ? (
                      <>
                        {recentActivities.map((item, index) => {
                          const status = getActivityStatus(item);
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 8 }}
                              transition={
                                prefersReducedMotion
                                  ? { duration: 0 }
                                  : { duration: 0.25, delay: index * 0.02 }
                              }
                              className={`rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                                item.id === activeActivityId ? "shadow-[0_0_20px_rgba(59,130,246,0.2)]" : ""
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-1 h-2 w-2 rounded-full ${
                                    status === "running"
                                      ? "bg-sky-300/80 animate-pulse"
                                      : status === "error"
                                        ? "bg-rose-400/80"
                                        : "bg-emerald-300/80"
                                  }`}
                                />
                                <div className="flex-1">
                                  <p className="text-sm text-slate-200">{item.message}</p>
                                  <p className="text-[11px] text-slate-500">
                                    {new Date(item.time).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                        {olderActivities.length ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setShowEarlierSteps((prev) => !prev)}
                              className="flex w-full items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400"
                            >
                              <span>Earlier steps</span>
                              <span className="text-[10px] text-slate-500">
                                {showEarlierSteps ? "Hide" : "Show"} · {olderActivities.length}
                              </span>
                            </button>
                            <AnimatePresence initial={false}>
                              {showEarlierSteps ? (
                                <motion.div
                                  key="earlier-steps"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={
                                    prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }
                                  }
                                  className="mt-3 space-y-2 overflow-hidden"
                                >
                                  {olderActivities.map((item, index) => {
                                    const status = getActivityStatus(item);
                                    const isExpanded = expandedCompactIds.has(item.id);
                                    return (
                                      <div key={item.id} className="rounded-xl border border-white/10 bg-white/5">
                                        <button
                                          type="button"
                                          onClick={() => toggleCompact(item.id)}
                                          className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] text-slate-300"
                                        >
                                          <span className="line-clamp-1">{item.message}</span>
                                          <span className="ml-3 inline-flex items-center gap-2 text-[11px] text-slate-500">
                                            <span
                                              className={`h-2 w-2 rounded-full ${
                                                status === "running"
                                                  ? "bg-sky-300/80 animate-pulse"
                                                  : status === "error"
                                                    ? "bg-rose-400/80"
                                                    : "bg-emerald-300/80"
                                              }`}
                                            />
                                            {status}
                                          </span>
                                        </button>
                                        <AnimatePresence initial={false}>
                                          {isExpanded ? (
                                            <motion.div
                                              key="details"
                                              initial={{ opacity: 0, height: 0 }}
                                              animate={{ opacity: 1, height: "auto" }}
                                              exit={{ opacity: 0, height: 0 }}
                                              transition={
                                                prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }
                                              }
                                              className="px-3 pb-2 text-[11px] text-slate-500"
                                            >
                                              {new Date(item.time).toLocaleTimeString()}
                                            </motion.div>
                                          ) : null}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        ) : null}
                      </>
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
                  {showIdleHint && running ? (
                    <motion.div
                      key="idle-hint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400"
                    >
                      Still working…
                    </motion.div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: easeOut }
              }
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.35)] backdrop-blur"
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            >
              <div className="flex items-center justify-between gap-3">
                <motion.p
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.6 }}
                  className="text-xs uppercase tracking-[0.3em] text-slate-400"
                >
                  {"Live product snapshot".split(" ").map((word, index) => (
                    <motion.span
                      key={`${word}-${index}`}
                      custom={index}
                      variants={titleWordVariants}
                      className="mr-2 inline-block"
                    >
                      {word}
                    </motion.span>
                  ))}
                </motion.p>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      [
                        productInfo.title ?? result?.details?.name ?? "",
                        productInfo.price ?? result?.details?.price ?? "",
                        productInfo.description ?? result?.details?.description ?? "",
                      ]
                        .filter(Boolean)
                        .join(" — ")
                    )
                  }
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
                >
                  Copy
                </button>
              </div>
              {productInfo.status === "blocked" ? (
                <p className="mt-3 text-sm text-amber-200">
                  Product page blocks automated access. Showing policy-only analysis.
                </p>
              ) : null}
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-500">Name</span>
                  <span className="text-right text-white">
                    {productInfo.title ?? result?.details?.name ?? "Waiting..."}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-500">Price</span>
                  <span className="text-right text-white">
                    {productInfo.price ?? result?.details?.price ?? "Waiting..."}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-500">Policy pages</span>
                  <span className="text-right text-white">
                    {result?.details?.policyStatus === "present"
                      ? "Detected"
                      : result?.details?.policyStatus === "missing"
                        ? "Not found"
                        : "Pending"}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-300">Description</p>
                <p className="mt-2 text-sm text-slate-300">
                  {productInfo.description ??
                    result?.details?.description ??
                    "Waiting for extraction..."}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: easeOut }
              }
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.35)] backdrop-blur"
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            >
              <motion.p
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.6 }}
                className="text-xs uppercase tracking-[0.3em] text-slate-400"
              >
                {"Live document checks".split(" ").map((word, index) => (
                  <motion.span
                    key={`${word}-${index}`}
                    custom={index}
                    variants={titleWordVariants}
                    className="mr-2 inline-block"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.p>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Eligibility rules</span>
                  <span>{result ? "Extracted" : "Pending"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Exclusion rules</span>
                  <span>{result ? "Extracted" : "Pending"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Contradictions</span>
                  <span>{result ? `${result.flags.length} flags` : "Pending"}</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: easeOut }
              }
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.35)] backdrop-blur"
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
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
                      className={`relative flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-black/30 px-8 py-8 shadow-2xl backdrop-blur ${verdictConfig.glow}`}
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
                        <div className="flex items-center justify-between gap-3">
                          <motion.p
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.6 }}
                            className="text-xs uppercase tracking-[0.3em] text-slate-500"
                          >
                            {"Details".split(" ").map((word, index) => (
                              <motion.span
                                key={`${word}-${index}`}
                                custom={index}
                                variants={titleWordVariants}
                                className="mr-2 inline-block"
                              >
                                {word}
                              </motion.span>
                            ))}
                          </motion.p>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                [
                                  result.insight?.message ?? "",
                                  result.insight?.summary ?? "",
                                  `Flags: ${
                                    result.details?.flags.length
                                      ? result.details.flags.join(", ")
                                      : "none"
                                  }`,
                                ]
                                  .filter(Boolean)
                                  .join(" — ")
                              )
                            }
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
                          >
                            Copy
                          </button>
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
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 space-y-2">
        <AnimatePresence>
          {longStepToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-xs text-slate-200 shadow-lg backdrop-blur"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{toast.icon}</span>
                <span>{toast.title}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}
