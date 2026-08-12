import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { AppButton, Badge, SectionHeading, StatCard } from "../components/ui";
import { StructuredOutputView } from "../components/StructuredOutputView";
import { apiFetch } from "../lib/api";
import { mockAgents } from "../data/mock";
import { runPaidAgent } from "../lib/agent-run";

interface AgentDetailResponse {
  _id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  documentation: string;
  endpoint: string;
  price: number;
  currency: "USDC";
  averageRating: number;
  reviewCount: number;
  totalRuns: number;
  favoritesCount: number;
  featured: boolean;
  trending: boolean;
  status: string;
  tags: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  config?: {
    n8nWorkflowId?: string;
  };
  ownerDeveloperId?: {
    companyName?: string;
    bio?: string;
  };
  versions: Array<{ version: string; changelog: string; endpoint: string; active: boolean; createdAt: string }>;
  screenshots: string[];
  createdAt: string;
  updatedAt: string;
}

type PaymentState =
  | "IDLE"
  | "PAYMENT_REQUIRED"
  | "WALLET_OPEN"
  | "SIGNING"
  | "SUBMITTING"
  | "VERIFYING"
  | "PAID"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED";

const fallbackAgent = mockAgents[0]!;

export function AgentDetailsPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [execution, setExecution] = useState<Record<string, unknown> | null>(null);
  const [transaction, setTransaction] = useState<Record<string, unknown> | null>(null);
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [paymentTx, setPaymentTx] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>("IDLE");
  const [runError, setRunError] = useState("");
  const progressTimers = useRef<number[]>([]);
  const outputEndRef = useRef<HTMLDivElement>(null);

  function clearProgressTimers() {
    progressTimers.current.forEach(timer => window.clearTimeout(timer));
    progressTimers.current = [];
  }

  function startProgressAnimation() {
    clearProgressTimers();
    setPaymentState("PAYMENT_REQUIRED");
    const steps: Array<[number, PaymentState]> = [
      [250, "WALLET_OPEN"],
      [750, "SIGNING"],
      [1200, "SUBMITTING"],
      [1700, "VERIFYING"],
      [2400, "PAID"],
      [3000, "EXECUTING"],
    ];

    steps.forEach(([delay, state]) => {
      const timer = window.setTimeout(() => setPaymentState(state), delay);
      progressTimers.current.push(timer);
    });
  }

  useEffect(() => () => clearProgressTimers(), []);

  useEffect(() => {
    if (result || paymentState !== "IDLE") {
      outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [result, paymentState]);

  const { data: agent } = useQuery({
    queryKey: ["agent", params.id],
    queryFn: async () => {
      if (!params.id) {
        return null;
      }

      try {
        return await apiFetch<AgentDetailResponse>(`/agents/${params.id}`);
      } catch {
        const fallback = fallbackAgent;
        if (fallback.id === params.id) {
          return {
            _id: fallback.id,
            slug: fallback.slug,
            name: fallback.name,
            category: fallback.category,
            description: fallback.description,
            documentation: "Comprehensive AI agent documentation.",
            endpoint: `/api/v1/agents/${fallback.slug}/run`,
            price: fallback.pricing.amount,
            currency: "USDC" as const,
            averageRating: fallback.averageRating,
            reviewCount: fallback.reviewCount,
            totalRuns: fallback.totalRuns,
            favoritesCount: 12,
            featured: fallback.featured,
            trending: fallback.trending,
            status: fallback.status,
            tags: fallback.tags,
            inputSchema: {},
            outputSchema: {},
            versions: [{ version: "1.0.0", changelog: "Initial release", endpoint: `/api/v1/agents/${fallback.slug}/run`, active: true, createdAt: fallback.createdAt }],
            screenshots: [],
            createdAt: fallback.createdAt,
            updatedAt: fallback.updatedAt,
          };
        }
        return null;
      }
    },
  });

  const liveAgent = agent ?? {
    _id: params.id ?? fallbackAgent.id,
    slug: fallbackAgent.slug,
    name: fallbackAgent.name,
    category: fallbackAgent.category,
    description: fallbackAgent.description,
    documentation: "Comprehensive AI agent documentation.",
    endpoint: `/api/v1/agents/${fallbackAgent.slug}/run`,
    price: fallbackAgent.pricing.amount,
    currency: "USDC" as const,
    averageRating: fallbackAgent.averageRating,
    reviewCount: fallbackAgent.reviewCount,
    totalRuns: fallbackAgent.totalRuns,
    favoritesCount: 12,
    featured: fallbackAgent.featured,
    trending: fallbackAgent.trending,
    status: fallbackAgent.status,
    tags: fallbackAgent.tags,
    inputSchema: {},
    outputSchema: {},
    versions: [{ version: "1.0.0", changelog: "Initial release", endpoint: `/api/v1/agents/${fallbackAgent.slug}/run`, active: true, createdAt: fallbackAgent.createdAt }],
    screenshots: [],
    createdAt: fallbackAgent.createdAt,
    updatedAt: fallbackAgent.updatedAt,
  };

  // Determine Agent UI Input Type based on Category / Slug / Name
  const categoryKey = (liveAgent.category ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const slugKey = (liveAgent.slug ?? "").toLowerCase();
  const nameKey = (liveAgent.name ?? "").toLowerCase();

  const isResumeType =
    categoryKey === "resumeanalyzer" ||
    categoryKey === "career" ||
    slugKey.includes("resume") ||
    nameKey.includes("resume");

  const isTextSummarizerType =
    categoryKey === "textsummarizer" ||
    categoryKey === "writing" ||
    categoryKey === "productivity" ||
    slugKey.includes("summariz") ||
    nameKey.includes("summariz");

  const isCodeType =
    categoryKey === "code" ||
    categoryKey === "engineering" ||
    slugKey.includes("code") ||
    slugKey.includes("sql") ||
    nameKey.includes("code");

  // Determine dynamic UI text & hints
  const fileUploadLabel = isResumeType
    ? resumeFile ? resumeFile.name : "Attach Resume"
    : isTextSummarizerType
    ? resumeFile ? resumeFile.name : "Attach Document (Optional)"
    : isCodeType
    ? resumeFile ? resumeFile.name : "Attach Code File (Optional)"
    : resumeFile ? resumeFile.name : "Attach File (Optional)";

  const fileTypeBadge = isResumeType
    ? "PDF/DOCX"
    : isTextSummarizerType
    ? "TXT/PDF"
    : isCodeType
    ? "JS/PY/SQL"
    : "ALL FILES";

  const textPlaceholder = isResumeType
    ? "Enter target job title, career goals, or analysis notes..."
    : isTextSummarizerType
    ? "Enter or paste text/article content you want summarized..."
    : isCodeType
    ? "Paste code snippet, SQL query, or technical requirement..."
    : `Enter prompt or instructions for ${liveAgent.name}...`;

  const runMutation = useMutation({
    mutationFn: async () => {
      setRunError("");
      setResult(null);
      setExecution(null);
      setTransaction(null);
      setReceipt(null);
      setPaymentTx("");
      startProgressAnimation();
      const response = await runPaidAgent(liveAgent._id, { text: inputText }, { resumeFile });
      await queryClient.invalidateQueries({ queryKey: ["agent", params.id] });
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
      return response;
    },
    onSuccess: response => {
      clearProgressTimers();
      setPaymentState("COMPLETED");
      setResult(response.output);
      setExecution(response.execution ?? null);
      setTransaction(response.transaction ?? null);
      setReceipt(response.receipt ?? null);
      setPaymentTx(response.paymentResponse);
    },
    onError: error => {
      clearProgressTimers();
      setPaymentState("FAILED");
      setRunError(error instanceof Error ? error.message : "Failed to run agent");
    },
  });

  const isLiveAgent = useMemo(() => /^[a-f0-9]{24}$/i.test(liveAgent._id), [liveAgent._id]);
  const canRunPaid = liveAgent.status === "approved" && isLiveAgent;

  return (
    <div className="space-y-6">
      {/* Top Header & Agent Details Bar */}
      <div className="section-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{liveAgent.name}</h1>
              <Badge tone="mint">{liveAgent.category}</Badge>
              <Badge>{liveAgent.currency} ${liveAgent.price.toFixed(2)}</Badge>
              <Badge>★ {liveAgent.averageRating.toFixed(1)}</Badge>
              <Badge tone={isLiveAgent ? "mint" : "gold"}>{isLiveAgent ? "Live Agent" : "Demo Fallback"}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300 max-w-3xl">{liveAgent.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <StatCard label="Total Runs" value={String(liveAgent.totalRuns)} />
            <StatCard label="Rating" value={`★ ${liveAgent.averageRating.toFixed(1)}`} />
            <AppButton href="/marketplace" variant="secondary">
              Back to Marketplace
            </AppButton>
          </div>
        </div>
      </div>

      {/* Execution Progress Banner */}
      {paymentState !== "IDLE" && paymentState !== "COMPLETED" && paymentState !== "FAILED" ? (
        <div className="rounded-2xl border border-mint-300/30 bg-mint-300/10 p-4 text-center backdrop-blur-md animate-pulse">
          <div className="flex items-center justify-center gap-3">
            <span className="text-xl">⚡</span>
            <div>
              <p className="text-sm font-semibold text-mint-100">
                Executing AI Agent ({paymentState.replace(/_/g, " ")})
              </p>
              <p className="text-xs text-slate-400">Verifying Algorand x402 payment & running neural model...</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Output Stream Area */}
      <div className="section-card p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">Execution Output Stream</p>
            <h3 className="mt-1 font-display text-xl font-bold text-white">Analysis Results</h3>
          </div>
          <Badge tone={paymentState === "COMPLETED" ? "mint" : paymentState === "FAILED" ? "gold" : "neutral"}>
            {paymentState}
          </Badge>
        </div>

        <StructuredOutputView
          result={result}
          execution={execution}
          receipt={receipt}
          transaction={transaction}
          paymentState={paymentState}
          paymentTx={paymentTx}
        />

        <div ref={outputEndRef} />
      </div>

      {/* STICKY BOTTOM INPUT DOCK (STICKS AT BOTTOM OF VIEWPORT, RESTS CLEANLY ABOVE FOOTER) */}
      <div className="sticky bottom-4 z-40 w-full rounded-3xl border border-mint-300/30 bg-slate-950/95 p-4.5 shadow-2xl shadow-black/90 backdrop-blur-2xl transition-all">
        {runError ? (
          <div className="mb-2.5 rounded-xl border border-red-400/30 bg-red-400/10 p-2.5 text-xs text-red-300">
            ❌ {runError}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Dynamic File Upload Pill */}
          <div className="relative shrink-0">
            <input
              type="file"
              accept="*/*"
              onChange={event => setResumeFile(event.target.files?.[0] ?? null)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-medium text-slate-200 transition hover:border-mint-300/40 hover:bg-white/10">
              <span className="text-mint-300 text-base">📁</span>
              <span className="max-w-[160px] truncate font-semibold">
                {fileUploadLabel}
              </span>
              {resumeFile ? (
                <span className="text-[10px] text-mint-300 bg-mint-300/20 px-1.5 py-0.5 rounded font-mono">
                  {Math.round(resumeFile.size / 1024)}KB
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">{fileTypeBadge}</span>
              )}
            </div>
          </div>

          {/* Dynamic Input Text / Prompt Field */}
          <div className="flex-1">
            <input
              type="text"
              value={inputText}
              onChange={event => setInputText(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-mint-300/40 focus:bg-white/[0.08] placeholder:text-slate-500"
              placeholder={textPlaceholder}
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2 shrink-0">
            <AppButton
              onClick={() => {
                if (!isLiveAgent) {
                  setRunError("Open a real agent from the marketplace first.");
                  return;
                }

                if (!canRunPaid) {
                  setRunError("This agent is not approved for paid runs yet.");
                  return;
                }

                if (isResumeType && !resumeFile && !inputText.trim()) {
                  setRunError("Please attach a resume file or enter notes before running.");
                  return;
                }

                if (!isResumeType && !inputText.trim() && !resumeFile) {
                  setRunError("Please enter prompt text or attach a file before running.");
                  return;
                }

                runMutation.mutate();
              }}
              className={`py-3 px-6 text-sm font-bold shadow-lg shadow-mint-300/10 ${runMutation.isPending || !canRunPaid ? "opacity-70" : ""}`}
              disabled={!canRunPaid || runMutation.isPending}
            >
              {runMutation.isPending
                ? "⚡ Running..."
                : canRunPaid
                ? `🚀 Pay & Run ($${liveAgent.price.toFixed(2)})`
                : "Unavailable"}
            </AppButton>
            <AppButton href="/wallet" variant="secondary" className="py-3 px-3 text-xs">
              ⚙️
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
}
