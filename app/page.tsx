"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import type { RuleFlag } from "@/lib/rules";

type AnalyzeResponse = {
  verdict: "good" | "caution" | "risk" | "unclear";
  flags: RuleFlag[];
  explanations: string[];
  processingMs?: number;
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
    flags: RuleFlag[];
    hiddenFindings: string[];
    policyStatus: "present" | "missing";
  };
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [pulseInput, setPulseInput] = useState(false);
  const easeOut = [0.16, 1, 0.3, 1] as const;
  const easeInOut = [0.4, 0, 0.2, 1] as const;

  const fallbackFlags: RuleFlag[] = ["analysis_failed"];

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!res.ok) {
        throw new Error("Request failed.");
      }
      setResult(data);
    } catch {
      setResult({
        verdict: "unclear",
        flags: fallbackFlags,
        explanations: [],
      });
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
        transition: { duration: 4, ease: easeInOut, repeat: Infinity },
      };
    }
    return {
      initial: { opacity: 0.7 },
      animate: { opacity: 1 },
      transition: { duration: 0.8, ease: easeOut },
    };
  }, [easeInOut, easeOut, result?.verdict]);

  return (
    <motion.main
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: easeOut }}
      className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-16"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-64 w-64 -translate-x-1/2 rounded-full bg-sky-400/20 blur-[120px]" />
        <div className="absolute right-[-10%] top-[20%] h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <div className="absolute bottom-[-20%] left-[10%] h-80 w-80 rounded-full bg-emerald-400/10 blur-[160px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: easeOut, delay: 0.1 }}
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
        <div className="relative">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Trust Verifier
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              Instant trust signal for any product link
            </h1>
            <p className="mt-3 text-sm text-slate-400">
              One URL in, one verdict out. Fast, clean, and confidence-first.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="mt-8 flex flex-col gap-4 sm:flex-row"
          >
            <motion.div
              animate={{
                boxShadow: isFocused
                  ? "0 0 0 1px rgba(148, 163, 184, 0.4), 0 0 30px rgba(59, 130, 246, 0.35)"
                  : "0 0 0 1px rgba(148, 163, 184, 0.15), 0 0 0 rgba(0,0,0,0)",
                scale: pulseInput ? 1.01 : 1,
              }}
              transition={{ duration: 0.2, ease: easeOut }}
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
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{
                boxShadow: loading
                  ? "0 0 25px rgba(59, 130, 246, 0.35)"
                  : "0 0 18px rgba(15, 23, 42, 0.2)",
              }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500/90 via-blue-500/90 to-indigo-500/90 px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-70"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <span className="flex items-center gap-1">
                    <span>Analyzing</span>
                    <span className="flex gap-1">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className="h-1.5 w-1.5 rounded-full bg-white/90"
                          animate={{ opacity: [0.2, 1, 0.2] }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: dot * 0.2,
                          }}
                        />
                      ))}
                    </span>
                  </span>
                ) : (
                  "Analyze"
                )}
              </span>
              <motion.span
                aria-hidden
                className="absolute inset-0 bg-white/10"
                animate={{ opacity: loading ? 0.5 : 0 }}
                transition={{ duration: 0.4 }}
              />
            </motion.button>
          </form>

          <section className="relative mt-10 min-h-[220px]">
            <AnimatePresence mode="wait">
              {result && !loading ? (
                <motion.div
                  key={result.verdict}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.6, ease: easeOut }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center"
                >
                  <motion.div
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
                    <div className="mt-6 w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left backdrop-blur">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Product details
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-slate-400">Name</span>
                          <span className="text-right text-white">
                            {result.details.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-slate-400">Price</span>
                          <span className="text-right text-white">
                            {result.details.price ?? "Not found"}
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
                    </div>
                  ) : null}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center text-center"
                >
                  <p className="text-sm text-slate-500">
                    Paste a product URL to reveal its trust signal.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </motion.div>
    </motion.main>
  );
}
