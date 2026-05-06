"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { COMPETITIVE, TASK } from "@/lib/data";

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
        <div key={i} className={`h-3 bg-gray-100 dark:bg-gray-800 rounded ${w}`} />
      ))}
    </div>
  );
}

export default function CompetitivePage() {
  const router = useRouter();
  const timer = useTimer();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");
  const [selectionTime, setSelectionTime] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 2200);
    return () => clearTimeout(t);
  }, []);

  function selectAgent(id: number, output: string) {
    setSelectedId(id);
    setEditedText(output);
    setSelectionTime(new Date().toISOString());
  }

  function handleSubmit() {
    const selected = COMPETITIVE.find((a) => a.id === selectedId);
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
      wasEdited: editedText !== selected?.output,
    };
    sessionStorage.setItem("humaid_session_data", JSON.stringify(sessionData));
    router.push("/submit");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
      <a
        href="/task"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </a>
      <span className="font-mono text-xs text-gray-400 dark:text-gray-500 tabular-nums">{timer}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Competitive Mode</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Three agents independently summarized the same literature. Read each and select the one you find most useful.
        </p>
      </div>

      {!isLoading && selectedId === null && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 border border-gray-100 dark:border-gray-800 rounded px-4 py-2.5 bg-gray-50 dark:bg-gray-900">
          Scroll through all three outputs before making your selection.
        </p>
      )}

      {!isLoading && selectedId !== null && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 border border-gray-200 dark:border-gray-700 rounded px-4 py-2.5 bg-gray-50 dark:bg-gray-900">
          You selected {COMPETITIVE.find((a) => a.id === selectedId)?.name}. Scroll down to review and edit your submission.
        </p>
      )}

      {/* Three agent cards */}
      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        {COMPETITIVE.map((agent) => {
          const isSelected = selectedId === agent.id;
          return (
            <div
              key={agent.id}
              className={`border rounded-lg overflow-hidden transition-all bg-white dark:bg-gray-950 ${
                isSelected ? "border-gray-900 dark:border-white shadow-sm" : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{agent.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{agent.style}</p>
                </div>
                {isSelected && (
                  <span className="text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-2 py-0.5 rounded font-medium flex-shrink-0">
                    Selected
                  </span>
                )}
              </div>

              <div className="p-4">
                {isLoading ? (
                  <Skeleton />
                ) : (
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
                    {agent.output}
                  </p>
                )}
              </div>

              {!isLoading && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => selectAgent(agent.id, agent.output)}
                    className={`w-full text-sm font-medium py-2 rounded-md transition-colors ${
                      isSelected
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                        : "border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    {isSelected ? "Selected" : "Select this response"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit and submit */}
      {selectedId !== null && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <p className="font-medium text-gray-900 dark:text-white text-sm">Your Submission</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Based on {COMPETITIVE.find((a) => a.id === selectedId)?.name}. You may edit before submitting.
            </p>
          </div>
          <div className="p-5">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={12}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed resize-none focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 transition-colors"
            />
            {editedText !== COMPETITIVE.find((a) => a.id === selectedId)?.output && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Modified from original</p>
            )}
          </div>
          <div className="px-5 pb-5 flex justify-center">
            <button
              onClick={handleSubmit}
              className="bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white text-sm font-medium px-6 py-2.5 rounded-md transition-colors"
            >
              Submit final answer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
