"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TASK } from "@/lib/data";
import { logEvent, getEvents } from "@/lib/event-logger";
import { computeProvenance, summariseProvenance } from "@/lib/provenance";

type Paper = {
  title: string;
  authors: string;
  year: number;
  journal: string;
  relevance: "High" | "Medium" | "Low";
  summary: string;
};

type Step = 1 | 2 | 3;

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3 py-2">
      {["w-2/3", "w-full", "w-5/6", "w-3/4", "w-full", "w-4/5"].map((w, i) => (
        <div key={i} className={`h-3 bg-gray-100 rounded ${w}`} />
      ))}
    </div>
  );
}

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-2.5 py-1 rounded transition-colors"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const STEP_META = [
  { step: 1 as Step, label: "Keywords", agentName: "Agent A", role: "Keyword Specialist", description: "Generates relevant search keywords for your literature review topic." },
  { step: 2 as Step, label: "Papers", agentName: "Agent B", role: "Paper Search Specialist", description: "Searches academic databases using the provided keywords." },
  { step: 3 as Step, label: "Summary", agentName: "Agent C", role: "Literature Summarizer", description: "Synthesizes the identified papers into a structured literature review." },
];

export default function CollaborativePage() {
  const router = useRouter();
  const timer = useTimer();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Step[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [finalText, setFinalText] = useState("");
  const [originalSummary, setOriginalSummary] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [stepTimestamps, setStepTimestamps] = useState<Record<number, string>>({});
  const submittingRef = useRef(false);
  const viewStartRef = useRef<number | null>(null);
  const editDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activePanelRef = useRef<HTMLDivElement | null>(null);

  // Step 1: load on mount
  useEffect(() => {
    setStepTimestamps({ 1: new Date().toISOString() });
    logEvent("session_start", { mode: "collaborative" });
    loadStep1();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStep1() {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/agents/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: TASK.topic }),
      });
      if (!res.ok) throw new Error("keywords API error");
      const data = await res.json();
      setKeywords(data.keywords ?? []);
      logEvent("agent_ready", { agentId: 1, keywordCount: data.keywords?.length });
    } catch {
      setApiError("Agent A failed to generate keywords. Please refresh and try again.");
      logEvent("agent_error", { agentId: 1 });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStep2() {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/agents/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, topic: TASK.topic }),
      });
      if (!res.ok) throw new Error("papers API error");
      const data = await res.json();
      setPapers(data.papers ?? []);
      logEvent("agent_ready", { agentId: 2, paperCount: data.papers?.length });
    } catch {
      setApiError("Agent B failed to retrieve papers. Please try again.");
      logEvent("agent_error", { agentId: 2 });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStep3() {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/agents/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papers, topic: TASK.topic }),
      });
      if (!res.ok) throw new Error("summary API error");
      const data = await res.json();
      const summary = data.summary ?? "";
      setFinalText(summary);
      setOriginalSummary(summary);
      logEvent("agent_ready", { agentId: 3, summaryLength: summary.length });
    } catch {
      setApiError("Agent C failed to generate a summary. Please try again.");
      logEvent("agent_error", { agentId: 3 });
    } finally {
      setIsLoading(false);
    }
  }

  // Dwell time tracking via IntersectionObserver
  useEffect(() => {
    const el = activePanelRef.current;
    if (!el || isLoading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          viewStartRef.current = Date.now();
          logEvent("agent_view_start", { agentId: currentStep });
        } else if (viewStartRef.current !== null) {
          const dwellMs = Date.now() - viewStartRef.current;
          logEvent("agent_view_end", { agentId: currentStep, dwellMs });
          viewStartRef.current = null;
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => {
      if (viewStartRef.current !== null) {
        logEvent("agent_view_end", { agentId: currentStep, dwellMs: Date.now() - viewStartRef.current });
        viewStartRef.current = null;
      }
      observer.disconnect();
    };
  }, [currentStep, isLoading]);

  // Beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (submittingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function handleAgentCopy(agentId: number) {
    const selectedText = window.getSelection()?.toString() ?? "";
    if (selectedText.length > 2) {
      logEvent("copy_from_agent", { agentId, textLength: selectedText.length, preview: selectedText.slice(0, 100) });
    }
  }

  function handleTextareaPaste(e: React.ClipboardEvent) {
    const pastedText = e.clipboardData.getData("text");
    logEvent("paste_to_textarea", { textLength: pastedText.length, preview: pastedText.slice(0, 100) });
  }

  function handleTextareaChange(text: string) {
    setFinalText(text);
    clearTimeout(editDebounceRef.current);
    editDebounceRef.current = setTimeout(() => {
      logEvent("textarea_edit", { charCount: text.length, wordCount: wordCount(text) });
    }, 1500);
  }

  async function advanceStep() {
    logEvent("step_advance", { fromStep: currentStep, toStep: currentStep + 1 });
    const next = (currentStep + 1) as Step;
    setCompletedSteps((prev) => [...prev, currentStep]);
    setCurrentStep(next);
    setStepTimestamps((prev) => ({ ...prev, [next]: new Date().toISOString() }));

    if (next === 2) await loadStep2();
    if (next === 3) await loadStep3();
  }

  function handleSubmit() {
    submittingRef.current = true;

    const provenanceSpans = computeProvenance(finalText, [
      { id: "agent_3_summary", text: originalSummary },
      { id: "agent_2_papers", text: papers.map((p) => p.summary).join(" ") },
    ]);
    const provenanceSummary = summariseProvenance(provenanceSpans);
    logEvent("session_end", { provenanceSummary });

    const events = getEvents();
    const sessionData = {
      sessionId: sessionStorage.getItem("humaid_session_id"),
      mode: "collaborative",
      task: TASK.topic,
      startTime: sessionStorage.getItem("humaid_start_time"),
      endTime: new Date().toISOString(),
      stepTimestamps,
      finalSubmission: finalText,
      wasEdited: finalText !== originalSummary,
      originalLength: originalSummary.length,
      finalLength: finalText.length,
      charsAdded: Math.max(0, finalText.length - originalSummary.length),
      charsRemoved: Math.max(0, originalSummary.length - finalText.length),
      provenanceSpans,
      provenanceSummary,
      events,
    };
    sessionStorage.setItem("humaid_session_data", JSON.stringify(sessionData));
    router.push("/submit");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <a href="/task" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </a>
        <span className="font-mono text-xs text-gray-400 tabular-nums">{timer}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Collaborative Mode</h1>
        <p className="text-sm text-gray-500">Follow the pipeline — each agent hands off to the next.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEP_META.map(({ step, label }, i) => {
          const isDone = completedSteps.includes(step);
          const isCurrent = currentStep === step;
          return (
            <div key={step} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all flex-shrink-0 ${isDone || isCurrent ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
                  {isDone ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : step}
                </div>
                <span className={`text-xs hidden sm:inline ${isCurrent ? "text-gray-900 font-medium" : isDone ? "text-gray-500" : "text-gray-300"}`}>{label}</span>
              </div>
              {i < STEP_META.length - 1 && <div className={`w-8 h-px mx-3 ${isDone ? "bg-gray-400" : "bg-gray-200"}`} />}
            </div>
          );
        })}
      </div>

      {/* Completed steps */}
      {completedSteps.map((step) => {
        const info = STEP_META.find((s) => s.step === step)!;
        return (
          <div key={step} className="border border-gray-100 rounded-lg mb-3 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-600 font-medium">{info.agentName} — {info.role}</span>
              </div>
              <span className="text-xs text-gray-400">Completed</span>
            </div>
            <div className="px-5 py-3" onCopy={() => handleAgentCopy(step)}>
              {step === 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.slice(0, 5).map((kw) => (
                    <span key={kw} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{kw}</span>
                  ))}
                  {keywords.length > 5 && (
                    <span className="text-xs text-gray-400 py-0.5">+{keywords.length - 5} more</span>
                  )}
                </div>
              )}
              {step === 2 && <p className="text-xs text-gray-500">{papers.length} papers retrieved.</p>}
            </div>
          </div>
        );
      })}

      {/* Active step */}
      {(() => {
        const info = STEP_META.find((s) => s.step === currentStep)!;
        return (
          <div ref={activePanelRef} className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">{info.agentName} — {info.role}</p>
                <p className="text-xs text-gray-400 mt-0.5">{info.description}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-mono ${isLoading ? "text-gray-400" : "text-gray-600 bg-gray-100"}`}>
                {isLoading ? "Running…" : "Ready"}
              </span>
            </div>

            <div className="p-5" onCopy={() => handleAgentCopy(currentStep)}>
              {isLoading ? (
                <Skeleton />
              ) : apiError ? (
                <div className="text-sm text-red-500 py-2">{apiError}</div>
              ) : (
                <>
                  {currentStep === 1 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-3">{keywords.length} keywords generated</p>
                      <div className="flex flex-wrap gap-2">
                        {keywords.map((kw) => (
                          <span key={kw} className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded border border-gray-200">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-3">{papers.length} papers found</p>
                      <div className="space-y-3">
                        {papers.map((paper, i) => (
                          <div key={i} className="border border-gray-100 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <p className="text-sm font-medium text-gray-800 leading-snug">{paper.title}</p>
                              <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 font-medium border ${paper.relevance === "High" ? "border-gray-300 text-gray-600 bg-gray-50" : "border-gray-200 text-gray-400"}`}>
                                {paper.relevance}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mb-1.5">{paper.authors} ({paper.year}) — <em>{paper.journal}</em></p>
                            <p className="text-xs text-gray-600 leading-relaxed">{paper.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-400">Synthesized from {papers.length} papers. You may edit before submitting.</p>
                        <CopyButton getText={() => finalText} />
                      </div>
                      <textarea
                        value={finalText}
                        onChange={(e) => handleTextareaChange(e.target.value)}
                        onPaste={handleTextareaPaste}
                        onFocus={() => logEvent("textarea_focus", { agentId: 3 })}
                        onBlur={() => logEvent("textarea_blur", { agentId: 3, charCount: finalText.length })}
                        rows={13}
                        className="w-full border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed resize-none focus:outline-none focus:border-gray-400 transition-colors"
                      />
                      <p className="text-xs text-gray-400 mt-1.5">
                        {finalText !== originalSummary ? "Modified from original — " : ""}
                        {wordCount(finalText)} words
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {!isLoading && !apiError && (
              <div className="px-5 pb-5 flex justify-center">
                {currentStep < 3 ? (
                  <button onClick={advanceStep} className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors">
                    {currentStep === 1 ? "Use these keywords" : "Use these papers"}
                  </button>
                ) : (
                  <button onClick={handleSubmit} className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-6 py-2.5 rounded-md transition-colors">
                    Submit final answer
                  </button>
                )}
              </div>
            )}

            {apiError && (
              <div className="px-5 pb-5 flex justify-center">
                <button
                  onClick={() => {
                    if (currentStep === 1) loadStep1();
                    else if (currentStep === 2) loadStep2();
                    else loadStep3();
                  }}
                  className="border border-gray-300 text-gray-600 hover:border-gray-500 text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
