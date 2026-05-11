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
      <div className="mb-10 text-center">
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
            Work through a sequential pipeline where each agent builds on the previous output.
          </p>
          <div className="space-y-2 mb-6 text-xs text-gray-500 dark:text-gray-400 flex-1">
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">A.</span>
              <span>Agent A generates search keywords</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">B.</span>
              <span>Agent B finds relevant papers</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">C.</span>
              <span>Agent C synthesizes a summary</span>
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
            Three agents work independently on the same task. Compare and select the best output.
          </p>
          <div className="space-y-2 mb-6 text-xs text-gray-500 dark:text-gray-400 flex-1">
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">A.</span>
              <span>Agent A writes an analytical and structured report</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">B.</span>
              <span>Agent B writes a narrative and flowing report</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">C.</span>
              <span>Agent C writes a critical and concise report</span>
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

      <p className="text-xs text-gray-400 dark:text-gray-600 mt-8 text-center">
        Interactions are logged anonymously for research purposes.
      </p>
    </div>
  );
}
