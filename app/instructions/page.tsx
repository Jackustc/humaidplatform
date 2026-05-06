"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function InstructionsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    const m = sessionStorage.getItem("humaid_mode");
    if (!m) { router.push("/task"); return; }
    setMode(m);
  }, [router]);

  function handleBegin() {
    sessionStorage.setItem("humaid_mode_start_time", new Date().toISOString());
    router.push(mode === "collaborative" ? "/collaborative" : "/competitive");
  }

  if (!mode) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">
          {mode === "collaborative" ? "Collaborative Mode" : "Competitive Mode"}
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Before You Begin</h1>
        <p className="text-sm text-gray-500">Read the instructions carefully before starting.</p>
      </div>

      {mode === "collaborative" ? (
        <div className="space-y-4 mb-8">
          <div className="border border-gray-200 rounded-lg p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">How It Works</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">Agent 1 generates keywords</p>
                  <p className="text-xs text-gray-500 mt-0.5">The first agent produces a set of search keywords for your literature review topic. Review them and proceed.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">Agent 2 retrieves papers</p>
                  <p className="text-xs text-gray-500 mt-0.5">The second agent uses those keywords to find relevant academic papers. Review the list and proceed.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">Agent 3 synthesizes the summary</p>
                  <p className="text-xs text-gray-500 mt-0.5">The third agent produces a literature review summary. You can edit it before submitting as your final answer.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">What to Keep in Mind</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>Read each agent output carefully before moving to the next step.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>You may edit the final summary produced by Agent 3 before submitting.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>There are no right or wrong answers. Your judgment matters.</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          <div className="border border-gray-200 rounded-lg p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">How It Works</p>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              Three AI agents will independently produce a literature review summary on the same topic at the same time.
              Each agent has a different writing style.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">A</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">Agent A — Analytical and Structured</p>
                  <p className="text-xs text-gray-500 mt-0.5">Uses clear headers and evidence-based structure.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">B</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">Agent B — Narrative and Flowing</p>
                  <p className="text-xs text-gray-500 mt-0.5">Writes in cohesive prose that tells a story.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">C</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">Agent C — Critical and Concise</p>
                  <p className="text-xs text-gray-500 mt-0.5">Direct and critical, highlights key tensions.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">What to Keep in Mind</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>Read all three outputs before making your selection.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>Select the response you find most useful for the task.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>You may edit the selected response before submitting.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>There are no right or wrong answers. Your judgment matters.</li>
            </ul>
          </div>
        </div>
      )}

      <button
        onClick={handleBegin}
        className="w-full bg-gray-900 hover:bg-gray-700 text-white font-medium py-3 rounded-lg transition-colors text-sm"
      >
        I understand, begin the task
      </button>
    </div>
  );
}
