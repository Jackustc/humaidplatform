"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { COMPETITIVE, TASK } from "@/lib/data";
import { logEvent, getEvents } from "@/lib/event-logger";
import { computeProvenance, summariseProvenance } from "@/lib/provenance";

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
    <div className="animate-pulse space-y-2.5 py-2">
      {["w-3/4", "w-full", "w-5/6", "w-2/3", "w-full", "w-4/5", "w-3/4", "w-full"].map((w, i) => (
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

export default function CompetitivePage() {
  const router = useRouter();
  const timer = useTimer();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");
  const [selectionTime, setSelectionTime] = useState<string | null>(null);
  const [scrolledIds, setScrolledIds] = useState<Set<number>>(new Set());
  const scrollRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const hoverStartRef = useRef<Map<number, number>>(new Map());
  const submittingRef = useRef(false);
  const editDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    logEvent("session_start", { mode: "competitive" });
    const t = setTimeout(() => {
      setIsLoading(false);
      logEvent("agents_ready", { agentCount: COMPETITIVE.length });
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  // After load, auto-unlock cards too short to need scrolling
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        COMPETITIVE.forEach((agent) => {
          const el = scrollRefs.current.get(agent.id);
          if (el && el.scrollHeight <= el.clientHeight + 5) {
            setScrolledIds((prev) => new Set([...prev, agent.id]));
            logEvent("agent_scroll", { agentId: agent.id, scrollDepthPct: 100, autoUnlocked: true });
          }
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

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

  function handleCardScroll(agentId: number, e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const depthPct = Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100);
    logEvent("agent_scroll", { agentId, scrollDepthPct: depthPct });
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setScrolledIds((prev) => new Set([...prev, agentId]));
    }
  }

  function handleCardMouseEnter(agentId: number) {
    hoverStartRef.current.set(agentId, Date.now());
    logEvent("agent_hover_start", { agentId });
  }

  function handleCardMouseLeave(agentId: number) {
    const start = hoverStartRef.current.get(agentId);
    if (start !== undefined) {
      const dwellMs = Date.now() - start;
      logEvent("agent_hover_end", { agentId, dwellMs });
      hoverStartRef.current.delete(agentId);
    }
  }

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
    setEditedText(text);
    clearTimeout(editDebounceRef.current);
    editDebounceRef.current = setTimeout(() => {
      logEvent("textarea_edit", { charCount: text.length, wordCount: wordCount(text) });
    }, 1500);
  }

  function selectAgent(id: number, output: string) {
    setSelectedId(id);
    setEditedText(output);
    setSelectionTime(new Date().toISOString());
    logEvent("agent_selected", { agentId: id, agentName: COMPETITIVE.find((a) => a.id === id)?.name });
  }

  function handleSubmit() {
    submittingRef.current = true;
    const selected = COMPETITIVE.find((a) => a.id === selectedId);
    const original = selected?.output ?? "";

    // Provenance: compare final text against ALL agent outputs
    const provenanceSpans = computeProvenance(
      editedText,
      COMPETITIVE.map((a) => ({ id: `agent_${a.name.replace(/\s+/g, "_")}`, text: a.output }))
    );
    const provenanceSummary = summariseProvenance(provenanceSpans);
    logEvent("session_end", { provenanceSummary });

    const events = getEvents();
    const sessionData = {
      sessionId: sessionStorage.getItem("humaid_session_id"),
      mode: "competitive",
      task: TASK.topic,
      startTime: sessionStorage.getItem("humaid_start_time"),
      endTime: new Date().toISOString(),
      selectedAgent: selectedId,
      selectedAgentName: selected?.name,
      selectionTime,
      finalSubmission: editedText,
      wasEdited: editedText !== original,
      originalLength: original.length,
      finalLength: editedText.length,
      charsAdded: Math.max(0, editedText.length - original.length),
      charsRemoved: Math.max(0, original.length - editedText.length),
      provenanceSpans,
      provenanceSummary,
      events,
    };
    sessionStorage.setItem("humaid_session_data", JSON.stringify(sessionData));
    router.push("/submit");
  }

  const allScrolled = COMPETITIVE.every((a) => scrolledIds.has(a.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <a href="/task" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </a>
        <span className="font-mono text-xs text-gray-400 tabular-nums">{timer}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Competitive Mode</h1>
        <p className="text-sm text-gray-500">Three agents independently summarized the same literature. Read each and select the one you find most useful.</p>
      </div>

      {!isLoading && selectedId === null && (
        <p className="text-xs text-gray-400 mb-5 border border-gray-100 rounded px-4 py-2.5 bg-gray-50">
          {allScrolled ? "You have read all three outputs. Select the one you find most useful." : "Scroll to the bottom of each agent's output before selecting."}
        </p>
      )}

      {!isLoading && selectedId !== null && (
        <p className="text-xs text-gray-500 mb-5 border border-gray-200 rounded px-4 py-2.5 bg-gray-50">
          You selected {COMPETITIVE.find((a) => a.id === selectedId)?.name}. Scroll down to review and edit your submission.
        </p>
      )}

      {/* Three agent cards */}
      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        {COMPETITIVE.map((agent) => {
          const isSelected = selectedId === agent.id;
          const hasScrolled = scrolledIds.has(agent.id);
          return (
            <div
              key={agent.id}
              className={`border rounded-lg overflow-hidden transition-all ${isSelected ? "border-gray-900 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
              onMouseEnter={() => handleCardMouseEnter(agent.id)}
              onMouseLeave={() => handleCardMouseLeave(agent.id)}
              onCopy={() => handleAgentCopy(agent.id)}
            >
              <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{agent.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{agent.style}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!isLoading && !hasScrolled && <span className="text-xs text-gray-300 font-medium">scroll ↓</span>}
                  {isSelected && <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded font-medium">Selected</span>}
                </div>
              </div>

              <div className="p-4">
                {isLoading ? <Skeleton /> : (
                  <div
                    ref={(el) => { scrollRefs.current.set(agent.id, el); }}
                    onScroll={(e) => handleCardScroll(agent.id, e)}
                    className="text-xs text-gray-600 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto"
                  >
                    {agent.output}
                  </div>
                )}
              </div>

              {!isLoading && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => hasScrolled && selectAgent(agent.id, agent.output)}
                    disabled={!hasScrolled}
                    title={!hasScrolled ? "Scroll through the full output first" : undefined}
                    className={`w-full text-sm font-medium py-2 rounded-md transition-colors ${
                      isSelected ? "bg-gray-900 text-white"
                      : hasScrolled ? "border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
                      : "border border-gray-100 text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    {isSelected ? "Selected" : hasScrolled ? "Select this response" : "Read to unlock"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit and submit */}
      {selectedId !== null && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="font-medium text-gray-900 text-sm">Your Submission</p>
            <p className="text-xs text-gray-400 mt-0.5">Based on {COMPETITIVE.find((a) => a.id === selectedId)?.name}. You may edit before submitting.</p>
          </div>
          <div className="p-5">
            <div className="flex justify-end mb-2">
              <CopyButton getText={() => editedText} />
            </div>
            <textarea
              value={editedText}
              onChange={(e) => handleTextareaChange(e.target.value)}
              onPaste={handleTextareaPaste}
              onFocus={() => logEvent("textarea_focus", { agentId: selectedId })}
              onBlur={() => logEvent("textarea_blur", { agentId: selectedId, charCount: editedText.length })}
              rows={12}
              className="w-full border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed resize-none focus:outline-none focus:border-gray-400 transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              {editedText !== COMPETITIVE.find((a) => a.id === selectedId)?.output ? "Modified from original — " : ""}
              {wordCount(editedText)} words
            </p>
          </div>
          <div className="px-5 pb-5 flex justify-center">
            <button onClick={handleSubmit} className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-6 py-2.5 rounded-md transition-colors">
              Submit final answer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
