"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { COLLABORATIVE, TASK } from "@/lib/data";

type Step = 1 | 2 | 3;

const STEPS = [
  { step: 1 as Step, label: "Keywords", agent: COLLABORATIVE.agent1 },
  { step: 2 as Step, label: "Papers", agent: COLLABORATIVE.agent2 },
  { step: 3 as Step, label: "Summary", agent: COLLABORATIVE.agent3 },
];

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

export default function CollaborativePage() {
  const router = useRouter();
  const timer = useTimer();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Step[]>([]);
  const [finalText, setFinalText] = useState(COLLABORATIVE.agent3.summary);
  const [stepTimestamps, setStepTimestamps] = useState<Record<number, string>>({});
  useEffect(() => {
    setStepTimestamps({ 1: new Date().toISOString() });
    const t = setTimeout(() => setIsLoading(false), 1800);
    return () => clearTimeout(t);
  }, []);

  function advanceStep() {
    const next = (currentStep + 1) as Step;
    setCompletedSteps((prev) => [...prev, currentStep]);
    setCurrentStep(next);
    setIsLoading(true);
    setStepTimestamps((prev) => ({ ...prev, [next]: new Date().toISOString() }));
    setTimeout(() => setIsLoading(false), 1800);
  }

  function handleSubmit() {
    const sessionData = {
      sessionId: sessionStorage.getItem("humaid_session_id"),
      mode: "collaborative",
      task: TASK.topic,
      startTime: sessionStorage.getItem("humaid_start_time"),
      endTime: new Date().toISOString(),
      stepTimestamps,
      finalSubmission: finalText,
      wasEdited: finalText !== COLLABORATIVE.agent3.summary,
    };
    sessionStorage.setItem("humaid_session_data", JSON.stringify(sessionData));
    router.push("/submit");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
      <a
        href="/task"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </a>
      <span className="font-mono text-xs text-gray-400 tabular-nums">{timer}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Collaborative Mode</h1>
        <p className="text-sm text-gray-500">
          Follow the pipeline — each agent hands off to the next.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map(({ step, label }, i) => {
          const isDone = completedSteps.includes(step);
          const isCurrent = currentStep === step;
          return (
            <div key={step} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all flex-shrink-0
                    ${isDone ? "bg-gray-900 text-white" : isCurrent ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}
                >
                  {isDone ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={`text-xs hidden sm:inline ${
                    isCurrent ? "text-gray-900 font-medium" : isDone ? "text-gray-500" : "text-gray-300"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px mx-3 ${isDone ? "bg-gray-400" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Completed steps (collapsed) */}
      {completedSteps.map((step) => {
        const info = STEPS.find((s) => s.step === step)!;
        return (
          <div key={step} className="border border-gray-100 rounded-lg mb-3 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-600 font-medium">
                  {info.agent.name} — {info.agent.role}
                </span>
              </div>
              <span className="text-xs text-gray-400">Completed</span>
            </div>
            <div className="px-5 py-3">
              {step === 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {COLLABORATIVE.agent1.keywords.slice(0, 5).map((kw) => (
                    <span key={kw} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {kw}
                    </span>
                  ))}
                  <span className="text-xs text-gray-400 py-0.5">
                    +{COLLABORATIVE.agent1.keywords.length - 5} more
                  </span>
                </div>
              )}
              {step === 2 && (
                <p className="text-xs text-gray-500">
                  {COLLABORATIVE.agent2.papers.length} papers retrieved.
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Active step */}
      {(() => {
        const info = STEPS.find((s) => s.step === currentStep)!;
        return (
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {info.agent.name} — {info.agent.role}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{info.agent.description}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-mono ${isLoading ? "text-gray-400" : "text-gray-600 bg-gray-100"}`}>
                {isLoading ? "Running..." : "Ready"}
              </span>
            </div>

            <div className="p-5">
              {isLoading ? (
                <Skeleton />
              ) : (
                <>
                  {/* Step 1 */}
                  {currentStep === 1 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-3">
                        {COLLABORATIVE.agent1.keywords.length} keywords generated
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {COLLABORATIVE.agent1.keywords.map((kw) => (
                          <span
                            key={kw}
                            className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded border border-gray-200"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2 */}
                  {currentStep === 2 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-3">
                        {COLLABORATIVE.agent2.papers.length} papers found
                      </p>
                      <div className="space-y-3">
                        {COLLABORATIVE.agent2.papers.map((paper, i) => (
                          <div key={i} className="border border-gray-100 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <p className="text-sm font-medium text-gray-800 leading-snug">
                                {paper.title}
                              </p>
                              <span
                                className={`text-xs px-2 py-0.5 rounded flex-shrink-0 font-medium border ${
                                  paper.relevance === "High"
                                    ? "border-gray-300 text-gray-600 bg-gray-50"
                                    : "border-gray-200 text-gray-400"
                                }`}
                              >
                                {paper.relevance}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mb-1.5">
                              {paper.authors} ({paper.year}) — <em>{paper.journal}</em>
                            </p>
                            <p className="text-xs text-gray-600 leading-relaxed">{paper.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 3 */}
                  {currentStep === 3 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-3">
                        Synthesized from {COLLABORATIVE.agent2.papers.length} papers. You may edit before submitting.
                      </p>
                      <textarea
                        value={finalText}
                        onChange={(e) => setFinalText(e.target.value)}
                        rows={13}
                        className="w-full border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed resize-none focus:outline-none focus:border-gray-400 transition-colors"
                      />
                      {finalText !== COLLABORATIVE.agent3.summary && (
                        <p className="text-xs text-gray-400 mt-1.5">Modified from original</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {!isLoading && (
              <div className="px-5 pb-5 flex justify-center">
                {currentStep < 3 ? (
                  <button
                    onClick={advanceStep}
                    className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
                  >
                    {currentStep === 1 ? "Use these keywords" : "Use these papers"}
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-6 py-2.5 rounded-md transition-colors"
                  >
                    Submit final answer
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
