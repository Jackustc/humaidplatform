"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Read a URL query param, trying several common aliases. */
function readParam(params: URLSearchParams, names: string[]): string {
  for (const n of names) {
    const v = params.get(n);
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export default function LoginPage() {
  const router = useRouter();
  const [participantId, setParticipantId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Connect identifiers captured from the URL, carried through to the log.
  const [assignmentId, setAssignmentId] = useState("");
  const [projectId, setProjectId] = useState("");

  // Capture CloudResearch Connect parameters from the entry URL on first load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = readParam(params, ["participantId", "participant_id", "PID", "pid"]);
    const aid = readParam(params, ["assignmentId", "assignment_id", "AID", "aid"]);
    const proj = readParam(params, ["projectId", "project_id", "PROJECT_ID", "projectid"]);
    if (pid) setParticipantId(pid);
    if (aid) { setAssignmentId(aid); sessionStorage.setItem("humaid_assignment_id", aid); }
    if (proj) { setProjectId(proj); sessionStorage.setItem("humaid_project_id", proj); }
  }, []);

  async function handleStart() {
    const id = participantId.trim();
    if (!id || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/validate-participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: id }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setError("Could not verify your participant ID. Please try again.");
        setLoading(false);
        return;
      }
      if (!data.allowed) {
        setError(data.message ?? "This participant ID cannot start the study.");
        setLoading(false);
        return;
      }

      const sessionId = generateSessionId();
      sessionStorage.setItem("humaid_session_id", sessionId);
      sessionStorage.setItem("humaid_start_time", new Date().toISOString());
      sessionStorage.setItem("humaid_participant_id", id);
      if (assignmentId) sessionStorage.setItem("humaid_assignment_id", assignmentId);
      if (projectId) sessionStorage.setItem("humaid_project_id", projectId);
      router.push("/task");
    } catch {
      setError("Could not verify your participant ID. Please try again.");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleStart();
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full" style={{ maxWidth: "fit-content" }}>
        <div className="mb-8 text-center" style={{ textAlign: "center" }}>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">HUMAID Study</p>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Welcome</h1>
          <p className="text-sm text-gray-500">Enter your participant ID to begin.</p>
        </div>

        <div className="border border-gray-200 rounded-lg p-6 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">Participant ID</label>
            <input
              type="text"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={loading}
              placeholder="e.g., 686A9312ED364DD58027EE60BDA4XXXX"
              style={{ width: "calc(40ch + 1.5rem)" }}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-700 focus:outline-none focus:border-gray-400 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            onClick={handleStart}
            disabled={!participantId.trim() || loading}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? "Verifying…" : "Start the task"}
          </button>
        </div>

      </div>
    </div>
  );
}
