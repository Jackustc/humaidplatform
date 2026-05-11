"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [participantId, setParticipantId] = useState("");

  function handleStart() {
    if (!participantId.trim()) return;
    const sessionId = generateSessionId();
    sessionStorage.setItem("humaid_session_id", sessionId);
    sessionStorage.setItem("humaid_start_time", new Date().toISOString());
    sessionStorage.setItem("humaid_participant_id", participantId.trim());
    router.push("/task");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleStart();
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">HUMAID Study</p>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Welcome</h1>
          <p className="text-sm text-gray-500">Enter your participant ID to begin.</p>
        </div>

        <div className="border border-gray-200 rounded-lg p-6 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Participant ID</label>
            <input
              type="text"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="e.g. P001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>

          <button
            onClick={handleStart}
            disabled={!participantId.trim()}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            Start the task
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Your participant ID was provided by the researcher.
        </p>
      </div>
    </div>
  );
}
