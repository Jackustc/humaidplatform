"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TASK } from "@/lib/data";

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function Home() {
  useEffect(() => {
    if (!sessionStorage.getItem("humaid_session_id")) {
      sessionStorage.setItem("humaid_session_id", generateSessionId());
    }
    sessionStorage.setItem("humaid_start_time", new Date().toISOString());
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1 tracking-tight">
          {TASK.title}
        </h1>
        <p className="text-sm text-gray-500">
          A research study on Human Multi-Agent AI Interaction Dynamics
        </p>
      </div>

      {/* Task */}
      <div className="border border-gray-200 rounded-lg p-5 mb-8 bg-gray-50">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Your Task</p>
        <p className="text-sm text-gray-700 leading-relaxed">{TASK.description}</p>
        <p className="text-xs text-gray-400 mt-3">Estimated time: {TASK.estimatedTime}</p>
      </div>

      {/* Mode selection */}
      <div className="mb-3">
        <p className="text-sm font-medium text-gray-700 mb-4">Choose how you would like to work with the AI agents:</p>

        <div className="grid sm:grid-cols-2 gap-4 items-stretch">
          {/* Collaborative */}
          <div className="border border-gray-200 rounded-lg p-6 hover:border-gray-400 transition-colors flex flex-col">
            <h3 className="font-semibold text-gray-900 mb-1">Collaborative Mode</h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Work through a sequential pipeline where each agent builds on the previous output.
            </p>
            <div className="space-y-2 mb-6 text-xs text-gray-500 flex-1">
              <div className="flex items-start gap-2">
                <span className="font-mono text-gray-400 w-4 flex-shrink-0">1.</span>
                <span>Agent 1 generates search keywords</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-gray-400 w-4 flex-shrink-0">2.</span>
                <span>Agent 2 finds relevant papers</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-gray-400 w-4 flex-shrink-0">3.</span>
                <span>Agent 3 synthesizes a summary</span>
              </div>
            </div>
            <Link
              href="/collaborative"
              onClick={() => sessionStorage.setItem("humaid_mode", "collaborative")}
              className="block w-full text-center bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
            >
              Start Collaborative
            </Link>
          </div>

          {/* Competitive */}
          <div className="border border-gray-200 rounded-lg p-6 hover:border-gray-400 transition-colors flex flex-col">
            <h3 className="font-semibold text-gray-900 mb-1">Competitive Mode</h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Three agents work independently on the same task. Compare and select the best output.
            </p>
            <div className="space-y-2 mb-6 text-xs text-gray-500 flex-1">
              <div className="flex items-start gap-2">
                <span className="font-mono text-gray-400 w-4 flex-shrink-0">A.</span>
                <span>Agent A — analytical and structured</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-gray-400 w-4 flex-shrink-0">B.</span>
                <span>Agent B — narrative and flowing</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-gray-400 w-4 flex-shrink-0">C.</span>
                <span>Agent C — critical and concise</span>
              </div>
            </div>
            <Link
              href="/competitive"
              onClick={() => sessionStorage.setItem("humaid_mode", "competitive")}
              className="block w-full text-center bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
            >
              Start Competitive
            </Link>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-8 text-center">
        Interactions are logged anonymously for research purposes.
      </p>
    </div>
  );
}
