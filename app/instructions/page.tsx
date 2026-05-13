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
    <div className="max-w-3xl mx-auto">

      {/* Centered header */}
      <div style={{ textAlign: "center" }} className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">
          {mode === "collaborative" ? "Collaborative Mode" : "Competitive Mode"}
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Before You Begin</h1>
        <p className="text-sm text-gray-500">Read the instructions carefully before starting.</p>
      </div>

      {mode === "collaborative" ? (
        <div className="space-y-4 mb-8">
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">How It Works</p>
            <div className="space-y-3">
              {[
                { label: "Agent A generates keywords", desc: "The first agent produces a set of search keywords for your literature review topic. Review them and proceed." },
                { label: "Agent B retrieves papers", desc: "The second agent uses those keywords to find relevant academic papers. Review the list and proceed." },
                { label: "Agent C synthesizes the summary", desc: "The third agent produces a literature review summary. You can edit it before submitting as your final answer." },
              ].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{step.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">What to Keep in Mind</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>Read each agent output carefully before moving to the next step.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>You may edit the final summary produced by Agent C before submitting.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">—</span>There are no right or wrong answers. Your judgment matters.</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">How It Works</p>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              Three AI agents will independently produce a literature review summary on the same topic at the same time. Each agent has a different writing style.
            </p>
            <div className="space-y-3">
              {[
                { label: "Agent A — ChatGPT", desc: "Powered by OpenAI's ChatGPT model." },
                { label: "Agent B — DeepSeek", desc: "Powered by DeepSeek's language model." },
                { label: "Agent C — Claude", desc: "Powered by Anthropic's Claude model." },
              ].map((agent, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">{String.fromCharCode(65 + i)}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{agent.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{agent.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
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
