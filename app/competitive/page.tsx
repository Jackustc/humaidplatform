"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TASK } from "@/lib/data";
import { logEvent, getEvents } from "@/lib/event-logger";
import { computeProvenance, summariseProvenance } from "@/lib/provenance";

type LogEntry = {
  id: string;
  timestamp: string;
  actor: "coordinator" | "agent_a" | "agent_b" | "agent_c";
  type: "plan" | "assignment" | "output" | "critique" | "decision" | "final";
  content: string;
};

type AgentOutput = {
  id: number;
  name: string;
  style: string;
  output: string;
  critique: string;
};

type Round = {
  roundNumber: number;
  userMessage: string;
  logs: LogEntry[];
  agentOutputs: AgentOutput[];
  finalVersion: string;
  coordinatorDecision: string;
  coordinatorRationale: string;
};

const ACTOR_CONFIG: Record<LogEntry["actor"], { label: string; bg: string; text: string }> = {
  coordinator: { label: "Coordinator", bg: "bg-gray-900",    text: "text-white" },
  agent_a:     { label: "Agent A",     bg: "bg-blue-100",    text: "text-blue-800" },
  agent_b:     { label: "Agent B",     bg: "bg-emerald-100", text: "text-emerald-800" },
  agent_c:     { label: "Agent C",     bg: "bg-violet-100",  text: "text-violet-800" },
};

const TYPE_PREFIX: Record<LogEntry["type"], string> = {
  plan:       "📋 Plan",
  assignment: "→ Brief",
  output:     "✓ Output",
  critique:   "💬 Critique",
  decision:   "⚖️ Decision",
  final:      "✅ Rationale",
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
      {["w-3/4", "w-full", "w-5/6", "w-2/3", "w-full", "w-4/5", "w-3/4", "w-full", "w-2/3", "w-full"].map((w, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-5 w-20 bg-gray-200 rounded animate-pulse flex-shrink-0" />
          <div className={`h-4 bg-gray-100 rounded animate-pulse ${w}`} />
        </div>
      ))}
    </div>
  );
}

export default function CompetitivePage() {
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
  const [originalFinal, setOriginalFinal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<number>>(new Set());

  useEffect(() => {
    logEvent("session_start", { mode: "competitive" });
    const handler = (e: BeforeUnloadEvent) => {
      if (submittingRef.current) return;
      e.preventDefault(); e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function runCompetition(message: string, roundNum: number) {
    setPhase("running");
    setError(null);
    logEvent("coordinator_start", { round: roundNum, message });

    try {
      const res = await fetch("/api/orchestrator/competitive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: TASK.topic,
          userMessage: message,
          previousFinal: currentRound?.finalVersion ?? null,
          round: roundNum,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();

      const round: Round = {
        roundNumber: roundNum,
        userMessage: message,
        logs: data.logs ?? [],
        agentOutputs: data.agentOutputs ?? [],
        finalVersion: data.finalVersion ?? "",
        coordinatorDecision: data.coordinatorDecision ?? "",
        coordinatorRationale: data.coordinatorRationale ?? "",
      };
      setRounds((prev) => [...prev, round]);
      setCurrentRound(round);
      setFinalText(data.finalVersion ?? "");
      if (roundNum === 1) setOriginalFinal(data.finalVersion ?? "");
      setPhase("complete");
      setShowDisagree(false);
      setDisagreeText("");
      logEvent("coordinator_complete", { round: roundNum });
    } catch {
      setError("The coordinator encountered an error. Please try again.");
      setPhase(roundNum === 1 ? "brief" : "complete");
      logEvent("coordinator_error", { round: roundNum });
    }
  }

  function handleStart() {
    runCompetition(userBrief.trim() || "No specific preferences.", 1);
  }

  function handleDisagree() {
    const msg = disagreeText.trim();
    if (!msg) return;
    const nextRound = rounds.length + 1;
    logEvent("user_disagree", { round: nextRound, feedback: msg });
    runCompetition(msg, nextRound);
  }

  function handleTextareaChange(text: string) {
    setFinalText(text);
    clearTimeout(editDebounceRef.current);
    editDebounceRef.current = setTimeout(() => {
      logEvent("textarea_edit", { charCount: text.length, wordCount: wordCount(text) });
    }, 1500);
  }

  function toggleAgent(id: number) {
    setExpandedAgents((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function handleSubmit() {
    submittingRef.current = true;
    const provenanceSources = currentRound?.agentOutputs.map((a) => ({
      id: `agent_${a.name.replace(/\s+/g, "_")}`,
      text: a.output,
    })) ?? [];
    const provenanceSpans = computeProvenance(finalText, provenanceSources);
    const provenanceSummary = summariseProvenance(provenanceSpans);
    logEvent("session_end", { provenanceSummary, totalRounds: rounds.length });

    const sessionData = {
      sessionId: sessionStorage.getItem("humaid_session_id"),
      mode: "competitive",
      task: TASK.topic,
      startTime: sessionStorage.getItem("humaid_start_time"),
      endTime: new Date().toISOString(),
      totalRounds: rounds.length,
      coordinatorDecision: currentRound?.coordinatorDecision,
      finalSubmission: finalText,
      wasEdited: finalText !== originalFinal,
      originalLength: originalFinal.length,
      finalLength: finalText.length,
      charsAdded: Math.max(0, finalText.length - originalFinal.length),
      charsRemoved: Math.max(0, originalFinal.length - finalText.length),
      provenanceSpans,
      provenanceSummary,
      rounds: rounds.map((r) => ({ roundNumber: r.roundNumber, userMessage: r.userMessage })),
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
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Competitive Mode</h1>
        <p className="text-sm text-gray-500">The Coordinator runs Agent A, B, and C in parallel, has them critique each other, then decides the best output. You see the full conversation.</p>
      </div>

      {/* Brief phase */}
      {phase === "brief" && (
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <p className="text-sm font-medium text-gray-900 mb-1">Brief the Coordinator</p>
          <p className="text-xs text-gray-400 mb-4">Tell the Coordinator your preferences for the report. Leave blank to let it decide.</p>
          <textarea
            value={userBrief}
            onChange={(e) => setUserBrief(e.target.value)}
            placeholder="e.g. I prefer a structured format, focus on manufacturing industry, include strategic recommendations..."
            rows={4}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-gray-400 transition-colors mb-4"
          />
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <button onClick={handleStart} className="w-full bg-gray-900 hover:bg-gray-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            Start Competition
          </button>
        </div>
      )}

      {/* Running phase */}
      {phase === "running" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-900 rounded-full animate-pulse" />
              <p className="text-sm font-medium text-gray-700">Coordinator is running the competition…</p>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Agents are generating outputs, critiquing each other, and the Coordinator is deciding the winner. ~45 seconds.</p>
          </div>
          <div className="p-5"><LogSkeleton /></div>
        </div>
      )}

      {/* Complete phase */}
      {phase === "complete" && currentRound && (
        <>
          {/* Past rounds */}
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
                <p className="font-medium text-gray-900 text-sm">Round {currentRound.roundNumber} — Coordinator Log</p>
                <p className="text-xs text-gray-400 mt-0.5">{currentRound.logs.length} events · 3 agents · critique round complete</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">Complete</span>
            </div>
            <div className="px-5 py-3 divide-y divide-gray-50">
              {currentRound.logs.map((entry) => <LogBubble key={entry.id} entry={entry} />)}
            </div>
          </div>

          {/* Agent outputs (collapsible) */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Agent Outputs &amp; Critiques</p>
            </div>
            {currentRound.agentOutputs.map((agent) => (
              <div key={agent.id} className="border-b border-gray-100 last:border-0">
                <button
                  onClick={() => toggleAgent(agent.id)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      agent.id === 1 ? "bg-blue-100 text-blue-800" :
                      agent.id === 2 ? "bg-emerald-100 text-emerald-800" :
                      "bg-violet-100 text-violet-800"
                    }`}>{agent.name}</span>
                    <span className="text-xs text-gray-500">{agent.style}</span>
                  </div>
                  <span className="text-xs text-gray-400">{expandedAgents.has(agent.id) ? "Hide" : "View output & critique"}</span>
                </button>
                {expandedAgents.has(agent.id) && (
                  <div className="px-5 pb-4 space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-400 mb-1.5">Output</p>
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{agent.output}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-600 mb-1.5">Critique from this agent on the others</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{agent.critique}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Coordinator's decision */}
          {currentRound.coordinatorDecision && (
            <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1.5">Coordinator Decision</p>
              <p className="text-sm text-gray-700">{currentRound.coordinatorDecision}</p>
            </div>
          )}

          {/* Final output */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-medium text-gray-900 text-sm">Final Report</p>
              <p className="text-xs text-gray-400 mt-0.5">Selected and synthesised by the Coordinator. Edit before submitting.</p>
            </div>
            <div className="p-5">
              <textarea
                value={finalText}
                onChange={(e) => handleTextareaChange(e.target.value)}
                rows={13}
                className="w-full border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed resize-none focus:outline-none focus:border-gray-400 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                {finalText !== originalFinal ? "Modified from original — " : ""}
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
              Not satisfied? Ask the Coordinator to run another round
            </button>
            {showDisagree && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">Tell the Coordinator what to improve. All three agents will compete again with your feedback incorporated.</p>
                <textarea
                  value={disagreeText}
                  onChange={(e) => setDisagreeText(e.target.value)}
                  placeholder="e.g. The output is too generic. I need more specific data and industry examples from the last 2 years..."
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
