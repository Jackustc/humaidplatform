"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TASK } from "@/lib/data";

export default function TaskPage() {
  const router = useRouter();

  useEffect(() => {
    if (!sessionStorage.getItem("humaid_participant_id")) {
      router.push("/");
    }
  }, [router]);

  function startMode(mode: "collaborative" | "competitive") {
    sessionStorage.setItem("humaid_mode", mode);
    router.push("/instructions");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-10 text-center" style={{ textAlign: "center" }}>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1 tracking-tight">{TASK.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">A research study on Human Multi-Agent AI Interaction Dynamics</p>
      </div>

      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5 mb-8 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Your Task</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{TASK.description}</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">Estimated time: {TASK.estimatedTime}</p>
      </div>

      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        Choose how you would like to work with the AI agents:
      </p>

      <div className="grid sm:grid-cols-2 gap-4 items-stretch">
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:border-gray-400 dark:hover:border-gray-600 transition-colors flex flex-col bg-white dark:bg-gray-900">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Collaborative Mode</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed min-h-[4.5rem]">
            Three specialist agents work in sequence, each building on the previous agent's output. An Orchestrator coordinates the pipeline and you can review every step.
          </p>
          <div className="space-y-2 mb-6 text-xs text-gray-500 dark:text-gray-400 flex-1">
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">A.</span>
              <span>Agent A collects relevant data and sources</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">B.</span>
              <span>Agent B performs analysis and statistics on that data</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">C.</span>
              <span>Agent C writes the final summary, which you review and edit</span>
            </div>
          </div>
          <button
            onClick={() => startMode("collaborative")}
            className="w-full bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
          >
            Start Collaborative
          </button>
        </div>

        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:border-gray-400 dark:hover:border-gray-600 transition-colors flex flex-col bg-white dark:bg-gray-900">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Competitive Mode</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed min-h-[4.5rem]">
            Three agents independently produce reports on the same task, each with a different writing style. They then critique each other before you choose and edit the best output.
          </p>
          <div className="space-y-2 mb-6 text-xs text-gray-500 dark:text-gray-400 flex-1">
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">A.</span>
              <span>Agent A independently generates its own report</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">B.</span>
              <span>Agent B independently generates its own report</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">C.</span>
              <span>Agent C independently generates its own report</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">→</span>
              <span>You compare all three and select the one you find most useful</span>
            </div>
          </div>
          <button
            onClick={() => startMode("competitive")}
            className="w-full bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
          >
            Start Competitive
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600 mt-8 text-center" style={{ textAlign: "center" }}>
        Interactions are logged anonymously for research purposes.
      </p>
    </div>
  );
}
