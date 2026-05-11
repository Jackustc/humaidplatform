"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TASK } from "@/lib/data";
import { logEvent, getEvents } from "@/lib/event-logger";
import { computeProvenance, summariseProvenance } from "@/lib/provenance";

type LogEntry = {
  id: string;
  timestamp: string;
  actor: "orchestrator" | "agent_a" | "agent_b" | "agent_c";
  type: "plan" | "assignment" | "output" | "review" | "final";
  content: string;
};

type Paper = {
  title: string;
  authors: string;
  year: number;
  journal: string;
  relevance: "High" | "Medium" | "Low";
  summary: string;
};

type Round = {
  roundNumber: number;
  userMessage: string;
  logs: LogEntry[];
  keywords: string[];
  papers: Paper[];
  summary: string;
};

const ACTOR_CONFIG: Record<LogEntry["actor"], { label: string; bg: string; text: string }> = {
  orchestrator: { label: "Orchestrator", bg: "bg-gray-900", text: "text-white" },
  agent_a:      { label: "Agent A",      bg: "bg-blue-100",   text: "text-blue-800" },
  agent_b:      { label: "Agent B",      bg: "bg-emerald-100", text: "text-emerald-800" },
  agent_c:      { label: "Agent C",      bg: "bg-violet-100", text: "text-violet-800" },
};

const TYPE_PREFIX: Record<LogEntry["type"], string> = {
  plan:       "📋 Plan",
  assignment: "→ Assigning",
  output:     "✓ Output",
  review:     "🔍 Review",
  final:      "✅ Complete",
};

function wordCount(t: string) { return t.trim().split(/\s+/).filter(Boolean).length; }

function useTimer() {
  const [s, setS] = useState(0);
  useEffect(() => { const i = setInterval(() => setS((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function LogBubble({ entry }: { entry: LogEntry }) {
  const cfg = ACTOR_CONFIG[entry.actor];
  const prefix = TYPE_PREFIX[entry.type];
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 h-fit mt-0.5 ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
      <div>
        <span className="text-xs font-medium text-gray-400 mr-1.5">{prefix}</span>
        <span className="text-xs text-gray-600 leading-relaxed">{entry.content}</span>
      </div>
    </div>
  );
}

function LogSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {["w-3/4", "w-full", "w-5/6", "w-2/3", "w-full", "w-4/5", "w-3/4", "w-full"].map((w, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-5 w-20 bg-gray-200 rounded animate-pulse flex-shrink-0" />
          <div className={`h-4 bg-gray-100 rounded animate-pulse ${w}`} />
        </div>
      ))}
    </div>
  );
}

export default function CollaborativePage() {
  const router = useRouter();
  const timer = useTimer();
  const submittingRef = useRef(false);
  const editDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [phase, setPhase] = useState<"brief" | "running" | "complete">("brief");
  const [userBrief, setUserBrief] = useState("");
  const [disagreeText, setDisagreeText] = useState("");
  const [showDisagree, setShowDisagree] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [finalText, setFinalText] = useState("");
  const [originalSummary, setOriginalSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());

  useEffect(() => {
    logEvent("session_start", { mode: "collaborative" });
    const handler = (e: BeforeUnloadEvent) => {
      if (submittingRef.current) return;
      e.preventDefault(); e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function runPipeline(message: string, roundNum: number) {
    setPhase("running");
    setError(null);
    logEvent("orchestrator_start", { round: roundNum, message });

    try {
      const res = await fetch("/api/orchestrator/collaborative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: TASK.topic,
          userMessage: message,
          previousSummary: currentRound?.summary ?? null,
          round: roundNum,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();

      const round: Round = {
        roundNumber: roundNum,
        userMessage: message,
        logs: data.logs ?? [],
        keywords: data.keywords ?? [],
        papers: data.papers ?? [],
        summary: data.summary ?? "",
      };
      setRounds((prev) => [...prev, round]);
      setCurrentRound(round);
      setFinalText(data.summary ?? "");
      if (roundNum === 1) setOriginalSummary(data.summary ?? "");
      setPhase("complete");
      setShowDisagree(false);
      setDisagreeText("");
      logEvent("orchestrator_complete", { round: roundNum, keywords: data.keywords?.length, papers: data.papers?.length });
    } catch {
      setError("The orchestrator encountered an error. Please try again.");
      setPhase(roundNum === 1 ? "brief" : "complete");
      logEvent("orchestrator_error", { round: roundNum });
    }
  }

  function handleStart() {
    if (!userBrief.trim() && rounds.length === 0) {
      runPipeline("No specific requirements.", 1);
    } else {
      runPipeline(userBrief.trim() || "No specific requirements.", 1);
    }
  }

  function handleDisagree() {
    const msg = disagreeText.trim();
    if (!msg) return;
    const nextRound = rounds.length + 1;
    logEvent("user_disagree", { round: nextRound, feedback: msg });
    runPipeline(msg, nextRound);
  }

  function handleTextareaChange(text: string) {
    setFinalText(text);
    clearTimeout(editDebounceRef.current);
    editDebounceRef.current = setTimeout(() => {
      logEvent("textarea_edit", { charCount: text.length, wordCount: wordCount(text) });
    }, 1500);
  }

  function handleSubmit() {
    submittingRef.current = true;
    const provenanceSources = [
      { id: "agent_c_summary", text: originalSummary },
      ...(currentRound?.papers.map((p, i) => ({ id: `paper_${i}`, text: p.summary })) ?? []),
    ];
    const provenanceSpans = computeProvenance(finalText, provenanceSources);
    const provenanceSummary = summariseProvenance(provenanceSpans);
    logEvent("session_end", { provenanceSummary, totalRounds: rounds.length });

    const sessionData = {
      sessionId: sessionStorage.getItem("humaid_session_id"),
      mode: "collaborative",
      task: TASK.topic,
      startTime: sessionStorage.getItem("humaid_start_time"),
      endTime: new Date().toISOString(),
      totalRounds: rounds.length,
      finalSubmission: finalText,
      wasEdited: finalText !== originalSummary,
      originalLength: originalSummary.length,
      finalLength: finalText.length,
      charsAdded: Math.max(0, finalText.length - originalSummary.length),
      charsRemoved: Math.max(0, originalSummary.length - finalText.length),
      provenanceSpans,
      provenanceSummary,
      rounds: rounds.map((r) => ({ roundNumber: r.roundNumber, userMessage: r.userMessage, keywordCount: r.keywords.length, paperCount: r.papers.length })),
      events: getEvents(),
    };
    sessionStorage.setItem("humaid_session_data", JSON.stringify(sessionData));
    router.push("/submit");
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <a href="/task" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
          Back
        </a>
        <span className="font-mono text-xs text-gray-400 tabular-nums">{timer}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Collaborative Mode</h1>
        <p className="text-sm text-gray-500">The Orchestrator coordinates Agent A, B, and C through a sequential pipeline. You can see every decision it makes.</p>
      </div>

      {/* Brief phase */}
      {phase === "brief" && (
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <p className="text-sm font-medium text-gray-900 mb-1">Brief the Orchestrator</p>
          <p className="text-xs text-gray-400 mb-4">Tell the Orchestrator any specific requirements or focus areas. Leave blank to let it decide.</p>
          <textarea
            value={userBrief}
            onChange={(e) => setUserBrief(e.target.value)}
            placeholder="e.g. Focus on enterprise adoption, include recent 2024 sources, keep the tone practical..."
            rows={4}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-gray-400 transition-colors mb-4"
          />
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <button onClick={handleStart} className="w-full bg-gray-900 hover:bg-gray-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            Start Pipeline
          </button>
        </div>
      )}

      {/* Running phase */}
      {phase === "running" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-900 rounded-full animate-pulse" />
              <p className="text-sm font-medium text-gray-700">Orchestrator is coordinating the pipeline…</p>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">This takes about 30 seconds. Each agent is being briefed and reviewed.</p>
          </div>
          <div className="p-5"><LogSkeleton /></div>
        </div>
      )}

      {/* Complete phase */}
      {phase === "complete" && currentRound && (
        <>
          {/* Past rounds (collapsed) */}
          {rounds.slice(0, -1).map((r) => (
            <div key={r.roundNumber} className="border border-gray-100 rounded-lg mb-3 overflow-hidden">
              <button
                onClick={() => setExpandedRounds((prev) => { const s = new Set(prev); s.has(r.roundNumber) ? s.delete(r.roundNumber) : s.add(r.roundNumber); return s; })}
                className="w-full px-5 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-sm text-gray-600 font-medium">Round {r.roundNumber} — "{r.userMessage.slice(0, 60)}{r.userMessage.length > 60 ? "…" : ""}"</span>
                </div>
                <span className="text-xs text-gray-400">{expandedRounds.has(r.roundNumber) ? "Hide" : "Show"} log</span>
              </button>
              {expandedRounds.has(r.roundNumber) && (
                <div className="px-5 py-3 divide-y divide-gray-50">
                  {r.logs.map((entry) => <LogBubble key={entry.id} entry={entry} />)}
                </div>
              )}
            </div>
          ))}

          {/* Current round log */}
          <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">Round {currentRound.roundNumber} — Orchestrator Log</p>
                <p className="text-xs text-gray-400 mt-0.5">{currentRound.logs.length} events · {currentRound.keywords.length} keywords · {currentRound.papers.length} sources</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">Complete</span>
            </div>
            <div className="px-5 py-3 divide-y divide-gray-50">
              {currentRound.logs.map((entry) => <LogBubble key={entry.id} entry={entry} />)}
            </div>
          </div>

          {/* Final output */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-medium text-gray-900 text-sm">Your Report</p>
              <p className="text-xs text-gray-400 mt-0.5">Produced by Agent C and reviewed by the Orchestrator. Edit before submitting.</p>
            </div>
            <div className="p-5">
              <textarea
                value={finalText}
                onChange={(e) => handleTextareaChange(e.target.value)}
                rows={13}
                className="w-full border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed resize-none focus:outline-none focus:border-gray-400 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                {finalText !== originalSummary ? "Modified from original — " : ""}
                {wordCount(finalText)} words
              </p>
            </div>
            <div className="px-5 pb-5 flex justify-center">
              <button onClick={handleSubmit} className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-6 py-2.5 rounded-md transition-colors">
                Submit final answer
              </button>
            </div>
          </div>

          {/* Disagree section */}
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <button
              onClick={() => setShowDisagree(!showDisagree)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${showDisagree ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              Not satisfied? Ask the Orchestrator to revise
            </button>
            {showDisagree && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">Tell the Orchestrator what to improve. It will run the full pipeline again with your feedback.</p>
                <textarea
                  value={disagreeText}
                  onChange={(e) => setDisagreeText(e.target.value)}
                  placeholder="e.g. The report is too academic. Make it more practical and focused on cost implications..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-gray-400 transition-colors mb-3"
                />
                {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
                <button
                  onClick={handleDisagree}
                  disabled={!disagreeText.trim()}
                  className="bg-gray-900 hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-md transition-colors"
                >
                  Submit feedback — Run Round {rounds.length + 1}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
