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
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              In Collaborative Mode, three specialist agents work in sequence. Each agent hands its output to the next, building progressively toward a final report. An Orchestrator coordinates the entire pipeline and reviews each stage before passing it on.
            </p>
            <div className="space-y-4">
              {[
                {
                  label: "Agent A — Data Collection",
                  desc: "Agent A receives your task and gathers the relevant data, sources, and evidence needed to address it. You can review what it has collected before the process continues. If you want changes, you can provide feedback to the Orchestrator to revise this stage.",
                },
                {
                  label: "Agent B — Analysis & Statistics",
                  desc: "Agent B receives Agent A's collected data and performs the analytical work: identifying patterns, computing statistics, and drawing out the key findings. Again, you can review this output and request revisions before moving on.",
                },
                {
                  label: "Agent C — Summary Writing",
                  desc: "Agent C takes the analysis from Agent B and produces the final written report. This is your working draft. You can read it, edit it directly in the text editor, and revise it as much as you like before submitting.",
                },
              ].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{step.label}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Your Role</p>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>At the start, you can provide the Orchestrator with your task description and any specific requirements or constraints.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>After the pipeline completes, you will see the Orchestrator's full activity log showing every decision and handoff between agents.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>If you are not satisfied with the result, you can give the Orchestrator written feedback and it will re-run the full pipeline incorporating your guidance.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>Edit the final report from Agent C as you see fit before submitting it as your answer.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>There are no right or wrong answers — your judgment about quality and relevance is what matters.</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">How It Works</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              In Competitive Mode, all three agents tackle the same task independently and simultaneously, each bringing a different writing style and perspective. An Orchestrator manages the full process: assigning the task, collecting outputs, running a critique round in which the agents evaluate each other's work, and then selecting the strongest version.
            </p>
            <div className="space-y-4">
              {[
                { label: "Agent A", desc: "Independently works on the task and produces its own report." },
                { label: "Agent B", desc: "Independently works on the same task and produces its own report." },
                { label: "Agent C", desc: "Independently works on the same task and produces its own report." },
              ].map((agent, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-6 h-6 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">{String.fromCharCode(65 + i)}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{agent.label}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{agent.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">The Process</p>
            <div className="space-y-2.5 text-sm text-gray-600 mb-4">
              <p className="text-xs text-gray-600 leading-relaxed">Once the agents have submitted their reports, they each write a critique of the other two. The Orchestrator then reviews all outputs and critiques and selects the version it considers strongest, providing a written rationale for its decision.</p>
              <p className="text-xs text-gray-600 leading-relaxed mt-2">You will see the full Orchestrator log, all three agent outputs, and each agent's critique, so you can make a fully informed judgment.</p>
            </div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Your Role</p>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>At the start, you can describe your task and any preferences — such as desired tone, focus areas, or target audience.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>Read all three agent outputs and critiques carefully before deciding.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>Use the "Use this" button next to the agent whose output you prefer. You are not required to follow the Orchestrator's selection.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>Edit the selected report in the text editor before submitting it as your final answer.</li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>If none of the outputs satisfy you, you can ask the Orchestrator to run another round with your feedback.</li>
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
